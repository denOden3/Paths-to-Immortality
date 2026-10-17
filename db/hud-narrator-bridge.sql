begin;
-- A request contains a frozen gameplay snapshot, never a login credential.
create table private.hud_narration_requests (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 actor_id uuid not null references auth.users(id), room_id uuid not null references public.rooms(id) on delete cascade,
 generation uuid not null, context jsonb not null, message_id uuid,
 created_at timestamptz not null default clock_timestamp()
);
alter table private.hud_narration_requests enable row level security;
revoke all on private.hud_narration_requests from public,anon,authenticated;
create function private.hud_narration_context(p_room uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.rooms; previous public.messages; actions jsonb; panels jsonb; participants jsonb;begin
 select * into r from public.rooms where id=p_room and session_state='active';
 if not found or private.monkey_owner() is distinct from r.owner_id then raise exception 'Authorized active owner room required';end if;
 select * into previous from public.messages where room_id=p_room and kind='narrator' order by created_at desc,id desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'character',coalesce(m.character_name,(select character_name from public.room_members where room_id=p_room and user_id=m.sender_id)),'body',m.body,'created_at',m.created_at,'edited_at',m.edited_at) order by m.created_at,m.id),'[]') into actions
 from public.messages m where m.room_id=p_room and m.kind='player' and (previous.id is null or (m.created_at,m.id)>(previous.created_at,previous.id));
 if jsonb_array_length(actions)=0 then raise exception 'No pending character actions';end if;
 select coalesce(jsonb_agg(jsonb_build_object('character',name,'panel',public.room_player_panel(p_room,name)) order by name),'[]') into panels
 from (select distinct x->>'character' as name from jsonb_array_elements(actions)x) names;
 select coalesce(jsonb_agg(jsonb_build_object('character',character_name,'allowed_characters',allowed_characters,'role',role) order by user_id),'[]') into participants from public.room_members where room_id=p_room;
 return jsonb_build_object('room_id',r.id,'title',r.title,'generation',r.session_generation,
 'introduction',(select to_jsonb(s)-'updated_at' from private.scene_introductions s where room_id=p_room),
 'previous_narration',case when previous.id is null then null else jsonb_build_object('id',previous.id,'body',previous.body,'edited_at',previous.edited_at) end,
 'actions',actions,'participants',participants,'characters',panels,'after_message_id',actions->-1->>'id');
end;$$;
revoke all on function private.hud_narration_context(uuid) from public,anon,authenticated;
create function private.prepare_hud_narration(p_room uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare snapshot jsonb; request uuid;begin
 perform 1 from public.rooms where id=p_room for update;
 snapshot:=private.hud_narration_context(p_room);
 insert into private.hud_narration_requests(owner_id,actor_id,room_id,generation,context)
 values(private.monkey_owner(),auth.uid(),p_room,(snapshot->>'generation')::uuid,snapshot) returning id into request;
 return jsonb_build_object('request_id',request,'context',snapshot);
end;$$;
create function private.publish_hud_narration(p_request uuid,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare q private.hud_narration_requests; mid uuid;begin
 select * into q from private.hud_narration_requests where id=p_request;
 if not found or private.monkey_owner() is distinct from q.owner_id or auth.uid() is distinct from q.actor_id then raise exception 'Authorized narration request required';end if;
 perform 1 from public.rooms where id=q.room_id and owner_id=q.owner_id for update;
 select * into q from private.hud_narration_requests where id=p_request for update;
 if q.message_id is not null then
  if not exists(select 1 from public.messages where id=q.message_id and body=btrim(p_body)) then raise exception 'This request was already published with different text';end if;
  return q.message_id;
 end if;
 if q.created_at < clock_timestamp()-interval '2 hours' then raise exception 'Narration request expired; prepare Narrate again';end if;
 if private.hud_narration_context(q.room_id) is distinct from q.context then raise exception 'Scene, actions or character state changed; prepare Narrate again';end if;
 if p_body is null or p_body !~ '(?s)\[PATHS_STATE\].*\[/PATHS_STATE\]\s*$' or (length(p_body)-length(replace(p_body,'[PATHS_STATE]','')))/length('[PATHS_STATE]')<>1 then raise exception 'Exactly one final PATHS_STATE block is required';end if;
 mid:=public.publish_as_owner(q.room_id,p_body,(q.context->>'after_message_id')::uuid);
 update private.hud_narration_requests set message_id=mid where id=q.id;
 return mid;
end;$$;
-- Include the message id so clients verify the exact publication, not the latest unrelated receipt.
create or replace function private.narration_state_status(p_room uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if private.monkey_owner() is null or not exists(select 1 from public.rooms where id=p_room and owner_id=private.monkey_owner()) then raise exception 'Owner authorization required';end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from(select message_id,status,error,created_at from private.narration_state_receipts where room_id=p_room order by created_at desc,message_id desc limit 5)x),'[]');end;$$;
create function private.edit_hud_message(p_message_id uuid,p_new_body text,p_expected_body text) returns boolean
language plpgsql security definer set search_path='' as $$
declare m public.messages; rid uuid; owner uuid:=private.monkey_owner(); suffix text:='';begin
 if auth.uid() is null then raise exception 'Sign in before editing';end if;
 select room_id into rid from public.messages where id=p_message_id;
 perform 1 from public.rooms where id=rid and session_state='active' for update;
 if not found then raise exception 'Active room required';end if;
 select * into m from public.messages where id=p_message_id for update;
 if not exists(select 1 from public.rooms where id=rid and owner_id=owner) then
  -- Regular players retain the existing own-message and narrated-action restrictions.
  if m.body is distinct from p_expected_body then raise exception 'Message changed; reopen the editor';end if;
  perform public.edit_own_message(p_message_id,p_new_body);return true;
 end if;
 if m.body is distinct from p_expected_body then raise exception 'Message changed; reopen the editor';end if;
 if p_new_body is null or length(btrim(p_new_body))<1 or position('[PATHS_STATE]' in p_new_body)>0 or position('[/PATHS_STATE]' in p_new_body)>0 then raise exception 'Edit message text only; state records cannot be edited';end if;
 if m.kind='narrator' then suffix:=coalesce(substring(m.body from '(?s)\s*\[PATHS_STATE\].*\[/PATHS_STATE\]\s*$'),'');end if;
 if length(btrim(p_new_body)||suffix)>8000 then raise exception 'Message must be at most 8000 characters including its saved state record';end if;
 update public.messages set body=btrim(p_new_body)||suffix,edited_at=clock_timestamp() where id=m.id;
 return true;
end;$$;
create function public.prepare_hud_narration(p_room uuid) returns jsonb language sql security invoker set search_path='' as $$select private.prepare_hud_narration(p_room);$$;
create function public.publish_hud_narration(p_request uuid,p_body text) returns uuid language sql security invoker set search_path='' as $$select private.publish_hud_narration(p_request,p_body);$$;
create function public.edit_hud_message(p_message_id uuid,p_new_body text,p_expected_body text) returns boolean language sql security invoker set search_path='' as $$select private.edit_hud_message(p_message_id,p_new_body,p_expected_body);$$;
revoke all on function private.prepare_hud_narration(uuid),private.publish_hud_narration(uuid,text),private.edit_hud_message(uuid,text,text),public.prepare_hud_narration(uuid),public.publish_hud_narration(uuid,text),public.edit_hud_message(uuid,text,text) from public,anon,authenticated;
grant execute on function private.prepare_hud_narration(uuid),private.publish_hud_narration(uuid,text),private.edit_hud_message(uuid,text,text),public.prepare_hud_narration(uuid),public.publish_hud_narration(uuid,text),public.edit_hud_message(uuid,text,text) to authenticated;
commit;
