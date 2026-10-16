begin;
create table private.location_catalog(id text primary key,name text not null,region text not null,parent text not null,source_url text not null,checked_at date not null);
alter table private.location_catalog enable row level security;
revoke all on private.location_catalog from public,anon,authenticated;
insert into private.location_catalog(id,name,region,parent,source_url,checked_at)
select id,name,region,parent,source_url,'2026-10-16'::date from jsonb_to_recordset($catalog$[{"id": "cloudveil", "name": "Cloudveil Sect", "region": "Yunzhou", "parent": "Qingluan Mountains", "source_url": "https://www.notion.so/3fab0ac52efe81dbbcebff0ce90ed500"}, {"id": "mountain-gate", "name": "Mountain Gate", "region": "Yunzhou", "parent": "Cloudveil Sect", "source_url": "https://www.notion.so/3f7b0ac52efe81f6bd6efed19f06fc25"}, {"id": "mountain-path", "name": "Mountain Path", "region": "Yunzhou", "parent": "Cloudveil Sect", "source_url": "https://www.notion.so/3f7b0ac52efe81f6bd6efed19f06fc25"}, {"id": "central-assembly", "name": "Central Assembly Hall", "region": "Yunzhou", "parent": "Cloudveil Sect", "source_url": "https://www.notion.so/3f7b0ac52efe81f6bd6efed19f06fc25"}, {"id": "outer-courtyard", "name": "Outer Disciples’ Courtyard", "region": "Yunzhou", "parent": "Cloudveil Sect", "source_url": "https://www.notion.so/3fab0ac52efe8124b86af975b66003d1"}, {"id": "registration-hall", "name": "Registration Hall", "region": "Yunzhou", "parent": "Cloudveil Sect → Outer Courtyard", "source_url": "https://www.notion.so/3fab0ac52efe81ff838cdb788c2bc62f"}, {"id": "dining-hall", "name": "Dining Hall", "region": "Yunzhou", "parent": "Cloudveil Sect → Outer Courtyard", "source_url": "https://www.notion.so/3fab0ac52efe818fa4f2e3a926dbea9b"}, {"id": "bathhouse", "name": "Bathhouse", "region": "Yunzhou", "parent": "Cloudveil Sect → Outer Courtyard", "source_url": "https://www.notion.so/3fab0ac52efe8180b64eca7b12161bf5"}, {"id": "east-dormitories", "name": "East Dormitories", "region": "Yunzhou", "parent": "Cloudveil Sect → Outer Courtyard", "source_url": "https://www.notion.so/3fab0ac52efe8124b86af975b66003d1"}, {"id": "west-dormitories", "name": "West Dormitories", "region": "Yunzhou", "parent": "Cloudveil Sect → Outer Courtyard", "source_url": "https://www.notion.so/3fab0ac52efe8124b86af975b66003d1"}, {"id": "practice-square", "name": "Practice Square", "region": "Yunzhou", "parent": "Cloudveil Sect → Outer Courtyard", "source_url": "https://www.notion.so/3fab0ac52efe8124b86af975b66003d1"}, {"id": "ginkgo-notice-board", "name": "Ginkgo Notice Board", "region": "Yunzhou", "parent": "Cloudveil Sect → Outer Courtyard", "source_url": "https://www.notion.so/3fab0ac52efe8124b86af975b66003d1"}, {"id": "lower-trail-junction", "name": "Lower Trail Junction", "region": "Yunzhou", "parent": "Cloudveil Sect → Outer Courtyard", "source_url": "https://www.notion.so/3fab0ac52efe8124b86af975b66003d1"}, {"id": "communal-kitchens", "name": "Communal Kitchens", "region": "Yunzhou", "parent": "Cloudveil Sect → Outer Courtyard", "source_url": "https://www.notion.so/3fab0ac52efe8124b86af975b66003d1"}, {"id": "practice-garden", "name": "Practice Garden", "region": "Yunzhou", "parent": "Cloudveil Sect → Outer Courtyard", "source_url": "https://www.notion.so/3fab0ac52efe8124b86af975b66003d1"}, {"id": "sword-peak", "name": "Sword Peak", "region": "Yunzhou", "parent": "Cloudveil Sect → Five Peaks", "source_url": "https://www.notion.so/3f8b0ac52efe81538f9af31ad48125b9"}, {"id": "verdant-pill", "name": "Verdant Pill Hall", "region": "Yunzhou", "parent": "Cloudveil Sect → Five Peaks", "source_url": "https://www.notion.so/3f8b0ac52efe8170a0a3c7b335e86330"}, {"id": "talisman-formation", "name": "Talisman & Formation Hall", "region": "Yunzhou", "parent": "Cloudveil Sect → Five Peaks", "source_url": "https://www.notion.so/3f8b0ac52efe81bcbb40e8d0b9dc0014"}, {"id": "spirit-beast", "name": "Spirit Beast Vale", "region": "Yunzhou", "parent": "Cloudveil Sect → Five Peaks", "source_url": "https://www.notion.so/3f8b0ac52efe81b8a8a2e3ef5d4d2f97"}, {"id": "wuxing-peak", "name": "Wuxing Peak", "region": "Yunzhou", "parent": "Cloudveil Sect → Five Peaks", "source_url": "https://www.notion.so/3f8b0ac52efe810aa1d1ff3618da0323"}, {"id": "disciplinary-hall", "name": "Disciplinary Hall", "region": "Yunzhou", "parent": "Cloudveil Sect", "source_url": "https://www.notion.so/3f7b0ac52efe81b6bd0cf18b20da655c"}]$catalog$::jsonb) as x(id text,name text,region text,parent text,source_url text);
alter table private.scene_introductions add column time_of_day text not null default '',add column session_goals text not null default '',add column location_slug text,add column custom_location text not null default '',add column starting_spot text not null default '';
create table private.room_setup_requests(owner_id uuid not null references auth.users(id),request_id uuid not null,room_id uuid not null references public.rooms(id) on delete cascade,fingerprint text not null,primary key(owner_id,request_id));
alter table private.room_setup_requests enable row level security;
revoke all on private.room_setup_requests from public,anon,authenticated;
create function private.hud_room_setup() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();begin
 if v_owner is null then raise exception 'Owner authorization required';end if;
 return jsonb_build_object('locations',coalesce((select jsonb_agg(to_jsonb(l) order by region,parent,name) from private.location_catalog l),'[]'::jsonb),
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'alias',p.alias,'character_count',(select count(*) from private.player_characters c where c.player_id=p.id and not c.hidden)) order by lower(p.alias)) from private.portal_players p where p.owner_id=v_owner),'[]'::jsonb));
end;$$;
create function public.hud_room_setup() returns jsonb language sql security invoker set search_path='' as $$select private.hud_room_setup();$$;
create function private.save_room_setup(p_room uuid,p_date text,p_time text,p_location text,p_custom text,p_spot text,p_opening text,p_goals text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();place text;begin
 if v_owner is null then raise exception 'Owner authorization required';end if;
 perform 1 from public.rooms where id=p_room and owner_id=v_owner and session_state='active' for update;
 if not found then raise exception 'Select an ongoing owner room';end if;
 if length(btrim(coalesce(p_date,''))) not between 1 and 90 or p_time is null or p_time not in ('','Morning','Midday','Afternoon','Evening','Night') or length(btrim(coalesce(p_opening,''))) not between 1 and 2500 or p_goals is null or length(p_goals)>1200 or p_spot is null or length(p_spot)>90 then raise exception 'Check date, time, opening, goals and starting spot';end if;
 if p_location='__custom__' then
  if length(btrim(coalesce(p_custom,''))) not between 1 and 100 then raise exception 'Enter a custom location';end if;place:=btrim(p_custom);
 elsif p_location='__legacy__' then
  -- An existing free-text location can be kept while editing an older session.
  select location_name into place from private.scene_introductions where room_id=p_room;
  if place is null then raise exception 'Choose a location';end if;
 else select name into place from private.location_catalog where id=p_location;
  if place is null then raise exception 'Choose an established or custom location';end if;
 end if;
 if p_location<>'__legacy__' and btrim(p_spot)<>'' then place:=place||' · '||btrim(p_spot);end if;
 if length(place)>150 then raise exception 'Location and starting spot must fit within 150 characters';end if;
 insert into private.scene_introductions(room_id,scene_date,location_name,opening_text,time_of_day,session_goals,location_slug,custom_location,starting_spot,updated_at)
 values(p_room,btrim(p_date),place,btrim(p_opening),p_time,btrim(p_goals),p_location,case when p_location='__custom__' then btrim(p_custom) else '' end,btrim(p_spot),now())
 on conflict(room_id) do update set scene_date=excluded.scene_date,location_name=excluded.location_name,opening_text=excluded.opening_text,time_of_day=excluded.time_of_day,session_goals=excluded.session_goals,location_slug=excluded.location_slug,custom_location=excluded.custom_location,starting_spot=excluded.starting_spot,updated_at=now();
 return true;
end;$$;
create function public.save_room_setup(p_room uuid,p_date text,p_time text,p_location text,p_custom text,p_spot text,p_opening text,p_goals text) returns boolean language sql security invoker set search_path='' as $$select private.save_room_setup(p_room,p_date,p_time,p_location,p_custom,p_spot,p_opening,p_goals);$$;
create function private.invite_registered_player(p_room uuid,p_player uuid) returns text language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();player_name text;token text;begin
 if v_owner is null then raise exception 'Owner authorization required';end if;
 perform 1 from public.rooms where id=p_room and owner_id=v_owner and session_state='active' for update;
 if not found then raise exception 'Select an ongoing owner room';end if;
 select alias into player_name from private.portal_players where id=p_player and owner_id=v_owner for update;
 if player_name is null then raise exception 'Select a registered player';end if;
 if not exists(select 1 from private.player_characters where player_id=p_player and not hidden) then raise exception 'Add saved characters for % in Players Registry first',player_name;end if;
 token:=encode(extensions.gen_random_bytes(24),'hex');
 insert into private.scene_invitations(room_id,creator_id,token_hash,player_alias,invite_type,assigned_characters,guest_roles)
 values(p_room,v_owner,encode(extensions.digest(token,'sha256'),'hex'),player_name,'assigned',array[]::text[],array[]::text[]);
 return token;
end;$$;
create function public.invite_registered_player(p_room uuid,p_player uuid) returns text language sql security invoker set search_path='' as $$select private.invite_registered_player(p_room,p_player);$$;
create function private.create_prepared_room(p_request uuid,p_title text,p_character text,p_date text,p_time text,p_location text,p_custom text,p_spot text,p_opening text,p_goals text,p_players uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();rid uuid;fp text;prior record;pid uuid;token text;invitations jsonb:='[]'::jsonb;begin
 if v_owner is null or p_request is null then raise exception 'Owner authorization and request ID required';end if;
 fp:=encode(extensions.digest(jsonb_build_array(p_title,p_character,p_date,p_time,p_location,p_custom,p_spot,p_opening,p_goals,p_players)::text,'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||p_request::text,0));
 select * into prior from private.room_setup_requests where owner_id=v_owner and request_id=p_request;
 if found then if prior.fingerprint<>fp then raise exception 'This creation request has changed. Start a new request';end if;return jsonb_build_object('id',prior.room_id,'recovered',true,'invitations','[]'::jsonb);end if;
 if p_players is null or cardinality(p_players)>32 or cardinality(p_players)<>(select count(distinct x) from unnest(p_players)x) or array_position(p_players,null) is not null then raise exception 'Choose up to 32 unique registered players';end if;
 if exists(select 1 from unnest(p_players)x where not exists(select 1 from private.portal_players p where p.id=x and p.owner_id=v_owner)) then raise exception 'A selected player is not in your registry';end if;
 perform 1 from private.portal_players where id=any(p_players) and owner_id=v_owner order by id for update;
 rid:=public.create_room_as_owner(p_title,p_character);
 perform private.save_room_setup(rid,p_date,p_time,p_location,p_custom,p_spot,p_opening,p_goals);
 foreach pid in array p_players loop
  token:=private.invite_registered_player(rid,pid);
  invitations:=invitations||jsonb_build_array(jsonb_build_object('player_id',pid,'alias',(select alias from private.portal_players where id=pid),'code',token));
 end loop;
 insert into private.room_setup_requests values(v_owner,p_request,rid,fp);
 return jsonb_build_object('id',rid,'recovered',false,'invitations',invitations);
end;$$;
create function public.create_prepared_room(p_request uuid,p_title text,p_character text,p_date text,p_time text,p_location text,p_custom text,p_spot text,p_opening text,p_goals text,p_players uuid[]) returns jsonb language sql security invoker set search_path='' as $$select private.create_prepared_room(p_request,p_title,p_character,p_date,p_time,p_location,p_custom,p_spot,p_opening,p_goals,p_players);$$;
revoke all on function private.hud_room_setup(),public.hud_room_setup() from public,anon,authenticated;
grant execute on function private.hud_room_setup(),public.hud_room_setup() to authenticated;
revoke all on function private.save_room_setup(uuid,text,text,text,text,text,text,text),public.save_room_setup(uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.save_room_setup(uuid,text,text,text,text,text,text,text),public.save_room_setup(uuid,text,text,text,text,text,text,text) to authenticated;
revoke all on function private.invite_registered_player(uuid,uuid),public.invite_registered_player(uuid,uuid) from public,anon,authenticated;
grant execute on function private.invite_registered_player(uuid,uuid),public.invite_registered_player(uuid,uuid) to authenticated;
revoke all on function private.create_prepared_room(uuid,text,text,text,text,text,text,text,text,text,uuid[]),public.create_prepared_room(uuid,text,text,text,text,text,text,text,text,text,uuid[]) from public,anon,authenticated;
grant execute on function private.create_prepared_room(uuid,text,text,text,text,text,text,text,text,text,uuid[]),public.create_prepared_room(uuid,text,text,text,text,text,text,text,text,text,uuid[]) to authenticated;

CREATE OR REPLACE FUNCTION public.get_scene_introduction_as_owner(p_room_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid;v_scene record;
begin
 v_owner:=private.monkey_owner();
 if v_owner is null or not exists(select 1 from public.rooms where id=p_room_id and owner_id=v_owner)
 then raise exception 'HUD is not authorized for this room';end if;
 select scene_date,location_name,opening_text,time_of_day,session_goals,location_slug,custom_location,starting_spot into v_scene from private.scene_introductions where room_id=p_room_id;
 if not found then return jsonb_build_object('scene_date','','location','','opening','');end if;
 return jsonb_build_object('scene_date',v_scene.scene_date,'location',v_scene.location_name,'opening',v_scene.opening_text,'time_of_day',v_scene.time_of_day,'session_goals',v_scene.session_goals,'location_slug',v_scene.location_slug,'custom_location',v_scene.custom_location,'starting_spot',v_scene.starting_spot);
end;
$function$
;
CREATE OR REPLACE FUNCTION private.portal_preview(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i record;prior jsonb;bound uuid;
begin
 if p_code is null or p_code !~ '^[0-9a-f]{48}$' then return null;end if;
 select v.*,p.alias as player_name,r.title,r.session_generation,s.scene_date,s.location_name,s.opening_text,s.time_of_day,s.session_goals into i
 from private.scene_invitations v join private.portal_players p on p.id=v.player_id
 join public.rooms r on r.id=v.room_id left join private.scene_introductions s on s.room_id=r.id
 where token_hash=encode(extensions.digest(p_code,'sha256'),'hex') and consumed_at is null and expires_at>now() and r.session_state='active';
 if not found then return null;end if;
 select player_id into bound from private.portal_accounts where user_id=auth.uid();
 if bound is not null and bound<>i.player_id then return null;end if;
 select coalesce(jsonb_agg(to_jsonb(h)),'[]') into prior from (
  select c.name,c.description,c.objective as goal,h.scene_title,h.scene_date,h.location
  from private.player_characters c left join lateral (
   select scene_title,scene_date,location from private.character_appearances a where a.player_id=c.player_id and a.character_name=any(c.history_names) order by joined_at desc limit 1
  )h on true where c.player_id=i.player_id and not c.hidden order by lower(c.name))h;
 return jsonb_build_object('player_alias',i.player_name,'characters',to_jsonb(i.assigned_characters||i.guest_roles),
 'character_details',i.guest_role_details,'previous_characters',prior,'title',i.title,'session_generation',i.session_generation,
 'scene_date',coalesce(i.scene_date,''),'location',coalesce(i.location_name,''),'opening',coalesce(i.opening_text,''),'time_of_day',coalesce(i.time_of_day,''),'session_goals',coalesce(i.session_goals,''));
end;$function$
;
CREATE OR REPLACE FUNCTION private.portal_concluded_room(p_room_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if not private.is_jade_emperor() then raise exception 'Administrator access required';end if;
 select jsonb_build_object('id',r.id,'title',r.title,'session_generation',r.session_generation,'ended_at',r.ended_at,
 'scene_date',coalesce(s.scene_date,''),'location',coalesce(s.location_name,''),'opening',coalesce(s.opening_text,''),'time_of_day',coalesce(s.time_of_day,''),'session_goals',coalesce(s.session_goals,''),
 'notion_url',a.notion_url,'notion_recorded_at',a.recorded_at) into result
 from public.rooms r left join private.scene_introductions s on s.room_id=r.id
 left join private.scene_archive_links a on a.room_id=r.id and a.session_generation=r.session_generation
 where r.id=p_room_id and r.owner_id=auth.uid() and r.session_state='ended';
 return result;
end;$function$
;
commit;

