begin;
create table private.scene_archive_links(
 room_id uuid not null references public.rooms(id) on delete cascade,
 session_generation uuid not null,notion_url text not null check(length(notion_url) between 1 and 2000),
 recorded_at timestamptz not null default now(),primary key(room_id,session_generation)
);
alter table private.scene_archive_links enable row level security;
revoke all on private.scene_archive_links from public,anon,authenticated;

create function private.portal_room_log() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_jade_emperor() then raise exception 'Administrator access required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'session_state',r.session_state,'created_at',r.created_at,'ended_at',r.ended_at,'notion_url',a.notion_url,'notion_recorded_at',a.recorded_at) order by (r.session_state='active') desc,r.created_at desc)
 from public.rooms r left join private.scene_archive_links a on a.room_id=r.id and a.session_generation=r.session_generation where r.owner_id=auth.uid()),'[]');
end;$$;
create function public.portal_room_log() returns jsonb language sql security invoker set search_path='' as $$select private.portal_room_log();$$;

create function private.portal_concluded_room(p_room_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_jade_emperor() then raise exception 'Administrator access required';end if;
 select jsonb_build_object('id',r.id,'title',r.title,'session_generation',r.session_generation,'ended_at',r.ended_at,
 'scene_date',coalesce(s.scene_date,''),'location',coalesce(s.location_name,''),'opening',coalesce(s.opening_text,''),
 'notion_url',a.notion_url,'notion_recorded_at',a.recorded_at) into result
 from public.rooms r left join private.scene_introductions s on s.room_id=r.id
 left join private.scene_archive_links a on a.room_id=r.id and a.session_generation=r.session_generation
 where r.id=p_room_id and r.owner_id=auth.uid() and r.session_state='ended';
 return result;
end;$$;
create function public.portal_concluded_room(p_room_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.portal_concluded_room(p_room_id);$$;

create function private.portal_record_notion_archive(p_room_id uuid,p_generation uuid,p_url text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not private.is_jade_emperor() then raise exception 'Administrator access required';end if;
 perform 1 from public.rooms where id=p_room_id and owner_id=auth.uid() and session_state='ended' and session_generation=p_generation for update;
 if not found then raise exception 'This room has changed. Reopen its concluded scene before saving.';end if;
 if p_url is null or length(btrim(p_url)) not between 1 and 2000 or btrim(p_url) !~ '^https://([a-zA-Z0-9-]+\.)*(notion\.so|notion\.site|notion\.com)/[^[:space:]]+$' then raise exception 'Paste a valid HTTPS Notion page link';end if;
 insert into private.scene_archive_links(room_id,session_generation,notion_url,recorded_at) values(p_room_id,p_generation,btrim(p_url),clock_timestamp())
 on conflict(room_id,session_generation) do update set notion_url=excluded.notion_url,recorded_at=excluded.recorded_at;
 return true;
end;$$;
create function public.portal_record_notion_archive(p_room_id uuid,p_generation uuid,p_url text) returns boolean language sql security invoker set search_path='' as $$select private.portal_record_notion_archive(p_room_id,p_generation,p_url);$$;
revoke all on function private.portal_room_log(),public.portal_room_log(),private.portal_concluded_room(uuid),public.portal_concluded_room(uuid),private.portal_record_notion_archive(uuid,uuid,text),public.portal_record_notion_archive(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.portal_room_log(),public.portal_room_log(),private.portal_concluded_room(uuid),public.portal_concluded_room(uuid),private.portal_record_notion_archive(uuid,uuid,text),public.portal_record_notion_archive(uuid,uuid,text) to authenticated;
commit;
