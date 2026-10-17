begin;
create table private.room_typing(room_id uuid not null references public.rooms on delete cascade,actor_id uuid not null references auth.users on delete cascade,user_id uuid not null references auth.users on delete cascade,generation uuid not null,label text not null,expires_at timestamptz not null,primary key(room_id,actor_id));
alter table private.room_typing enable row level security;
revoke all on private.room_typing from public,anon,authenticated;
create function private.set_room_typing(p_room uuid,p_active boolean,p_character text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare gen uuid;v_owner uuid;m public.room_members;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if not p_active then delete from private.room_typing where room_id=p_room and actor_id=auth.uid();return true;end if;
 select r.session_generation,r.owner_id into gen,v_owner from public.rooms r where r.id=p_room and r.session_state='active';
 if gen is null then raise exception 'Session unavailable';end if;
 select * into m from public.room_members where room_id=p_room and (user_id=auth.uid() or (user_id=v_owner and private.monkey_owner()=v_owner)) order by (user_id=auth.uid()) desc limit 1;
 if m.user_id is null then raise exception 'Room membership required';end if;
 if p_character is not null and not(p_character=any(case when cardinality(m.allowed_characters)>0 then m.allowed_characters else array[m.character_name] end)) then raise exception 'Character not participating for this player';end if;
 delete from private.room_typing where room_id=p_room and expires_at<now()-interval '1 minute';
 insert into private.room_typing values(p_room,auth.uid(),m.user_id,gen,coalesce(p_character,nullif(m.player_alias,''),case when m.role='owner' then 'Jade Emperor' else 'Player' end),clock_timestamp()+interval '7 seconds') on conflict(room_id,actor_id) do update set user_id=excluded.user_id,generation=excluded.generation,label=excluded.label,expires_at=excluded.expires_at;
 return true;end;$$;
create function private.room_activity_status(p_room uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare writing boolean;names jsonb;begin
 writing:=private.narration_activity_status(p_room);
 select coalesce(jsonb_agg(label order by label),'[]'::jsonb) into names from(select distinct t.label from private.room_typing t join public.rooms r on r.id=t.room_id join public.room_members m on m.room_id=t.room_id and m.user_id=t.user_id where t.room_id=p_room and t.actor_id<>auth.uid() and r.session_state='active' and t.generation=r.session_generation and t.expires_at>now() and (t.actor_id=t.user_id or exists(select 1 from private.monkey_delegations d where d.monkey_id=t.actor_id and d.owner_id=t.user_id and d.revoked_at is null)) limit 4)x;
 return jsonb_build_object('narrating',writing,'typing',names);end;$$;
create function public.set_room_typing(p_room uuid,p_active boolean,p_character text default null) returns boolean language sql security invoker set search_path='' as $$select private.set_room_typing(p_room,p_active,p_character);$$;
create function public.room_activity_status(p_room uuid) returns jsonb language sql security invoker set search_path='' as $$select private.room_activity_status(p_room);$$;
revoke all on function private.set_room_typing(uuid,boolean,text),private.room_activity_status(uuid),public.set_room_typing(uuid,boolean,text),public.room_activity_status(uuid) from public,anon,authenticated;
grant execute on function private.set_room_typing(uuid,boolean,text),private.room_activity_status(uuid),public.set_room_typing(uuid,boolean,text),public.room_activity_status(uuid) to authenticated;
-- Preserve the existing owner-publishing checks, with a validated chosen character.
create function private.post_character_as_owner(p_room uuid,p_body text,p_kind text,p_client_message_id uuid,p_character text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid;m public.room_members;mid uuid;prior record;begin
 v_owner:=private.monkey_owner();
 if auth.uid() is null or v_owner is null or not exists(select 1 from public.rooms where id=p_room and public.rooms.owner_id=v_owner and session_state='active') then raise exception 'Active owner room required';end if;
 select * into m from public.room_members where room_id=p_room and user_id=v_owner and role='owner';
 if m.user_id is null then raise exception 'Owner character unavailable';end if;
 if p_kind='player' and (p_character is null or not(p_character=any(case when cardinality(m.allowed_characters)>0 then m.allowed_characters else array[m.character_name] end))) then raise exception 'Choose an owner character participating in this room';end if;
 select id,character_name into prior from public.messages where sender_id=v_owner and client_message_id=p_client_message_id;
 if found and p_kind='player' and prior.character_name is distinct from p_character then raise exception 'Message identifier already used for another character';end if;
 mid:=public.post_as_owner(p_room,p_body,p_kind,p_client_message_id);
 if p_kind='player' then update public.messages set character_name=p_character where id=mid;end if;
 delete from private.room_typing where room_id=p_room and actor_id=auth.uid();return mid;end;$$;
create function public.post_character_as_owner(p_room uuid,p_body text,p_kind text,p_client_message_id uuid,p_character text default null) returns uuid language sql security invoker set search_path='' as $$select private.post_character_as_owner(p_room,p_body,p_kind,p_client_message_id,p_character);$$;
revoke all on function private.post_character_as_owner(uuid,text,text,uuid,text),public.post_character_as_owner(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function private.post_character_as_owner(uuid,text,text,uuid,text),public.post_character_as_owner(uuid,text,text,uuid,text) to authenticated;
commit;
