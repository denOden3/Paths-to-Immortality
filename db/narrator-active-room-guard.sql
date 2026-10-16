create or replace function private.require_active_session() returns trigger language plpgsql security definer set search_path='' as $$
declare v_owner uuid;begin
 select owner_id into v_owner from public.rooms where id=new.room_id and session_state='active' for update;
 if not found then raise exception 'Session unavailable';end if;
 if new.kind='narrator' then
  if new.sender_id is not null or not(coalesce(auth.uid()=v_owner,false) or coalesce(private.monkey_owner()=v_owner,false)) then raise exception 'Authorized owner narration required';end if;
 elsif not exists(select 1 from public.room_members where room_id=new.room_id and user_id=new.sender_id) then raise exception 'Participant access ended';end if;
 return new;
end;$$;
