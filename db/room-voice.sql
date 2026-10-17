-- Ephemeral signaling only. Audio travels via WebRTC, never through the database.
begin;
create table private.voice_peers(id uuid primary key default gen_random_uuid(),room_id uuid not null references public.rooms on delete cascade,user_id uuid not null references auth.users on delete cascade,generation uuid not null,seen_at timestamptz not null default now());
create index voice_peers_room on private.voice_peers(room_id);
create table private.voice_signals(id bigint generated always as identity primary key,room_id uuid not null references public.rooms on delete cascade,sender uuid not null references private.voice_peers on delete cascade,target uuid not null references private.voice_peers on delete cascade,payload jsonb not null,created_at timestamptz not null default now());
create index voice_signals_target on private.voice_signals(target,id);
alter table private.voice_peers enable row level security;
alter table private.voice_signals enable row level security;
revoke all on private.voice_peers,private.voice_signals from public,anon,authenticated;
create function private.voice_exchange(p_room uuid,p_operation text,p_peer uuid default null,p_target uuid default null,p_payload jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare gen uuid;peer uuid;peers jsonb;signals jsonb;begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 -- Leaving remains allowed after a kick/end, but only for the caller's own device.
 if p_operation='leave' then delete from private.voice_peers where id=p_peer and room_id=p_room and user_id=auth.uid();return '{}'::jsonb;end if;
 select session_generation into gen from public.rooms r where r.id=p_room and r.session_state='active' and exists(select 1 from public.room_members m where m.room_id=r.id and m.user_id=auth.uid()) for update;
 if gen is null then raise exception 'Active room membership required';end if;
 delete from private.voice_peers v where v.room_id=p_room and (v.seen_at<now()-interval '60 seconds' or v.generation<>gen or not exists(select 1 from public.room_members m where m.room_id=v.room_id and m.user_id=v.user_id));
 delete from private.voice_signals where room_id=p_room and created_at<now()-interval '60 seconds';
 if p_operation='join' then
 if (select count(*) from private.voice_peers where room_id=p_room)>=8 then raise exception 'Voice trial supports eight connected devices';end if;
 insert into private.voice_peers(room_id,user_id,generation) values(p_room,auth.uid(),gen) returning id into peer;
 return jsonb_build_object('peer',peer);end if;
 if not exists(select 1 from private.voice_peers where id=p_peer and room_id=p_room and user_id=auth.uid() and generation=gen) then raise exception 'Voice connection expired; rejoin';end if;
 update private.voice_peers set seen_at=now() where id=p_peer;
 if p_operation='signal' then
 if p_target=p_peer or not exists(select 1 from private.voice_peers where id=p_target and room_id=p_room and generation=gen) then raise exception 'Voice recipient unavailable';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or coalesce(p_payload->>'type','') not in ('offer','answer','ice') or octet_length(p_payload::text)>65536 then raise exception 'Invalid voice signal';end if;
 if (select count(*) from private.voice_signals where sender=p_peer)>256 then raise exception 'Too many pending voice signals';end if;
 insert into private.voice_signals(room_id,sender,target,payload) values(p_room,p_peer,p_target,p_payload);return '{}'::jsonb;
 elsif p_operation<>'poll' then raise exception 'Unknown voice operation';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',coalesce(m.player_alias,m.character_name,'Player')) order by v.id),'[]'::jsonb) into peers from private.voice_peers v join public.room_members m on m.room_id=v.room_id and m.user_id=v.user_id where v.room_id=p_room and v.id<>p_peer;
 with consumed as(delete from private.voice_signals where target=p_peer and room_id=p_room returning id,sender,payload) select coalesce(jsonb_agg(jsonb_build_object('sender',sender,'payload',payload) order by id),'[]'::jsonb) into signals from consumed;
 return jsonb_build_object('peers',peers,'signals',signals);end;$$;
create function public.voice_exchange(p_room uuid,p_operation text,p_peer uuid default null,p_target uuid default null,p_payload jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.voice_exchange(p_room,p_operation,p_peer,p_target,p_payload);$$;
revoke all on function private.voice_exchange(uuid,text,uuid,uuid,jsonb),public.voice_exchange(uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.voice_exchange(uuid,text,uuid,uuid,jsonb),public.voice_exchange(uuid,text,uuid,uuid,jsonb) to authenticated;
commit;
