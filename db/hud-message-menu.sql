begin;
alter table public.messages add column deleted_at timestamptz;
create function private.manage_hud_messages(p_room uuid,p_ids uuid[],p_action text,p_kind text default null,p_character text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();is_owner boolean;requested int;eligible int;changed int;begin
 if auth.uid() is null or p_room is null then raise exception 'Room access required';end if;
 select owner_id=v_owner into is_owner from public.rooms where id=p_room and session_state='active' for update;
 if not found then raise exception 'Active room required';end if;
 is_owner:=coalesce(is_owner,false);
 if not is_owner and not exists(select 1 from public.room_members where room_id=p_room and user_id=auth.uid()) then raise exception 'Room access required';end if;
 select count(*) into requested from(select distinct unnest(p_ids))x;
 if requested not between 1 and 100 or array_position(p_ids,null) is not null then raise exception 'Select 1 to 100 messages';end if;
 if p_action not in ('delete','restore','speaker') or p_action is null then raise exception 'Unknown message action';end if;
 select count(*) into eligible from public.messages m where m.room_id=p_room and m.id=any(p_ids)
 and (is_owner or (m.sender_id=auth.uid() and m.kind in ('player','ooc')
 and ((p_action in ('delete','restore') and m.kind='ooc') or not exists(select 1 from public.messages n where n.room_id=p_room and n.kind='narrator' and (n.created_at,n.id)>(m.created_at,m.id)))))
 and (p_action='restore' or m.deleted_at is null);
 if eligible<>requested then raise exception 'Message unavailable or already narrated; refresh the selection';end if;
 if p_action='speaker' then
  if p_kind is null or p_kind not in ('player','ooc') or exists(select 1 from public.messages where id=any(p_ids) and kind='narrator') then raise exception 'Narrator messages keep their narrator identity';end if;
  if p_kind='player' and p_character is not null and not exists(
   select 1 from public.room_members m where room_id=p_room and (is_owner or user_id=auth.uid())
   and p_character=any(case when cardinality(allowed_characters)>0 then allowed_characters else array[character_name] end)
  ) then raise exception 'Choose a participating character';end if;
  if p_kind='player' and p_character is null and exists(select 1 from public.messages m where id=any(p_ids) and coalesce(m.character_name,(select character_name from public.room_members where room_id=p_room and user_id=m.sender_id)) is null) then raise exception 'Choose a participating character';end if;
  update public.messages m set kind=p_kind,character_name=case when p_kind='player' then coalesce(p_character,m.character_name,(select character_name from public.room_members where room_id=p_room and user_id=m.sender_id)) else m.character_name end,edited_at=clock_timestamp() where m.room_id=p_room and m.id=any(p_ids);
 elsif p_action='delete' then
  update public.messages set deleted_at=clock_timestamp(),edited_at=clock_timestamp() where room_id=p_room and id=any(p_ids);
 else
  update public.messages set deleted_at=null,edited_at=clock_timestamp() where room_id=p_room and id=any(p_ids);
 end if;
 get diagnostics changed=row_count;return changed;
end;$$;
create function public.manage_hud_messages(p_room uuid,p_ids uuid[],p_action text,p_kind text default null,p_character text default null) returns integer
language sql security invoker set search_path='' as $$select private.manage_hud_messages(p_room,p_ids,p_action,p_kind,p_character);$$;
revoke all on function private.manage_hud_messages(uuid,uuid[],text,text,text),public.manage_hud_messages(uuid,uuid[],text,text,text) from public,anon,authenticated;
grant execute on function private.manage_hud_messages(uuid,uuid[],text,text,text),public.manage_hud_messages(uuid,uuid[],text,text,text) to authenticated;
-- Hidden narrator rows remain timeline anchors; hidden player rows are not pending actions.
do $$declare name text;old text;updated text;begin
 foreach name in array array['public.publish_as_owner(uuid,text,uuid)','public.publish_narration(uuid,text,uuid)'] loop
  old:=pg_get_functiondef(name::regprocedure);
  updated:=replace(old,$find$m.kind in ('player','narrator')$find$,$replacement$m.kind in ('player','narrator') and (m.kind='narrator' or m.deleted_at is null)$replacement$);
  if updated=old then raise exception 'Publisher anchor check not found: %',name;end if;execute updated;
 end loop;
 old:=pg_get_functiondef('private.hud_narration_context(uuid)'::regprocedure);
 updated:=replace(old,$find$m.kind='player' and (previous.id$find$,$replacement$m.kind='player' and m.deleted_at is null and (previous.id$replacement$);
 if updated=old then raise exception 'Pending action query not found';end if;execute updated;
 old:=pg_get_functiondef('private.edit_hud_message(uuid,text,text)'::regprocedure);
 updated:=replace(old,'if m.body is distinct from p_expected_body then',$replacement$if m.deleted_at is not null then raise exception 'Message was deleted; refresh the room';end if; if m.body is distinct from p_expected_body then$replacement$);
 if updated=old then raise exception 'Edit check not found';end if;execute updated;
end;$$;
commit;
