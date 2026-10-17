-- Shared GM preparation indicator; never pretends to observe ChatGPT generation.
begin;
create table private.narration_activity(room_id uuid primary key references public.rooms(id) on delete cascade,generation uuid not null,started_at timestamptz not null,expires_at timestamptz not null);
alter table private.narration_activity enable row level security;
revoke all on private.narration_activity from public,anon,authenticated;
create function private.set_narration_activity(p_room uuid,p_active boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare gen uuid;begin
 if auth.uid() is null or private.monkey_owner() is null then raise exception 'Owner authorization required';end if;
 select session_generation into gen from public.rooms where id=p_room and owner_id=private.monkey_owner() and session_state='active' for update;
 if gen is null then raise exception 'Active owner room required';end if;
 if p_active then
 insert into private.narration_activity values(p_room,gen,clock_timestamp(),clock_timestamp()+interval '10 minutes') on conflict(room_id) do update set generation=excluded.generation,started_at=excluded.started_at,expires_at=excluded.expires_at;
 else delete from private.narration_activity where room_id=p_room;end if;return true;end;$$;
create function private.narration_activity_status(p_room uuid) returns boolean language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null or not exists(select 1 from public.rooms r where r.id=p_room and (r.owner_id=private.monkey_owner() or exists(select 1 from public.room_members m where m.room_id=r.id and m.user_id=auth.uid()))) then raise exception 'Room access required';end if;
 return exists(select 1 from private.narration_activity a join public.rooms r on r.id=a.room_id where a.room_id=p_room and r.session_state='active' and r.session_generation=a.generation and a.expires_at>now());end;$$;
create function public.set_narration_activity(p_room uuid,p_active boolean) returns boolean language sql security invoker set search_path='' as $$select private.set_narration_activity(p_room,p_active);$$;
create function public.narration_activity_status(p_room uuid) returns boolean language sql security invoker set search_path='' as $$select private.narration_activity_status(p_room);$$;
revoke all on function private.set_narration_activity(uuid,boolean),private.narration_activity_status(uuid),public.set_narration_activity(uuid,boolean),public.narration_activity_status(uuid) from public,anon,authenticated;
grant execute on function private.set_narration_activity(uuid,boolean),private.narration_activity_status(uuid),public.set_narration_activity(uuid,boolean),public.narration_activity_status(uuid) to authenticated;
create function private.finish_narration_activity() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.kind='narrator' then delete from private.narration_activity where room_id=new.room_id;end if;return new;end;$$;
revoke all on function private.finish_narration_activity() from public,anon,authenticated;
create trigger finish_narration_activity after insert on public.messages for each row execute function private.finish_narration_activity();
commit;
