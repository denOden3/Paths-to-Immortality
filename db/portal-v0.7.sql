begin;
alter table public.rooms add column session_state text not null default 'active' check(session_state in ('active','ended'));
alter table public.rooms add column session_generation uuid not null default gen_random_uuid();
alter table public.rooms add column ended_at timestamptz;

-- Keep the old storage columns for older clients, but no category controls identity or selection.
create or replace function private.attach_invitation_player() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.portal_admins where user_id=new.creator_id) then raise exception 'Owner required';end if;
 if not exists(select 1 from public.rooms where id=new.room_id and session_state='active') then raise exception 'Session is closed';end if;
 insert into private.portal_players(owner_id,alias,kind) values(new.creator_id,new.player_alias,'established') on conflict(owner_id,lower(alias)) do nothing;
 select id into new.player_id from private.portal_players where owner_id=new.creator_id and lower(alias)=lower(new.player_alias);
 return new;
end;$$;

create or replace function private.portal_context() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p record;
begin
 if auth.uid() is null then return jsonb_build_object('is_admin',false);end if;
 if private.is_jade_emperor() then return jsonb_build_object('is_admin',true,'alias','Jade Emperor');end if;
 select r.* into p from private.portal_players r join private.portal_accounts a on a.player_id=r.id where a.user_id=auth.uid();
 if not found then return jsonb_build_object('is_admin',false);end if;
 return jsonb_build_object('is_admin',false,'player_id',p.id,'alias',p.alias);
end;$$;
create or replace function private.portal_manage_player(p_alias text default null,p_kind text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_jade_emperor() then raise exception 'Owner required';end if;
 if p_alias is not null then
  if length(btrim(p_alias)) not between 1 and 45 then raise exception 'Enter a player name';end if;
  insert into private.portal_players(owner_id,alias,kind) values(auth.uid(),btrim(p_alias),'established') on conflict(owner_id,lower(alias)) do update set alias=excluded.alias;
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'alias',alias) order by lower(alias)) from private.portal_players where owner_id=auth.uid()),'[]');
end;$$;

create function private.create_player_invitation(p_room_id uuid,p_player_alias text,p_character_details jsonb) returns text language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();names text[];item jsonb;token text;
begin
 if v_owner is null then raise exception 'Owner required';end if;
 perform 1 from public.rooms where id=p_room_id and owner_id=v_owner and session_state='active' for update;
 if not found then raise exception 'Select an ongoing owner session';end if;
 if jsonb_typeof(p_character_details) is distinct from 'array' or jsonb_array_length(p_character_details) not between 1 and 8 then raise exception 'Provide 1–8 character descriptions';end if;
 for item in select value from jsonb_array_elements(p_character_details) loop
  if jsonb_typeof(item) is distinct from 'object' or length(btrim(coalesce(item->>'name',''))) not between 1 and 40 or length(coalesce(item->>'description',''))>350 or length(coalesce(item->>'goal',''))>150 then raise exception 'Invalid character description';end if;
  names:=array_append(names,btrim(item->>'name'));
 end loop;
 token:=public.create_scene_invitation_as_owner(p_room_id,p_player_alias,'assigned',names);
 update private.scene_invitations set guest_role_details=p_character_details where token_hash=encode(extensions.digest(token,'sha256'),'hex');
 return token;
end;$$;
create function public.create_player_invitation(p_room_id uuid,p_player_alias text,p_character_details jsonb) returns text language sql security invoker set search_path='' as $$select private.create_player_invitation(p_room_id,p_player_alias,p_character_details);$$;

create or replace function private.portal_preview(p_code text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i record;prior jsonb;bound uuid;
begin
 if p_code is null or p_code !~ '^[0-9a-f]{48}$' then return null;end if;
 select v.*,p.alias as player_name,r.title,r.session_generation,s.scene_date,s.location_name,s.opening_text into i
 from private.scene_invitations v join private.portal_players p on p.id=v.player_id
 join public.rooms r on r.id=v.room_id left join private.scene_introductions s on s.room_id=r.id
 where token_hash=encode(extensions.digest(p_code,'sha256'),'hex') and consumed_at is null and expires_at>now() and r.session_state='active';
 if not found then return null;end if;
 select player_id into bound from private.portal_accounts where user_id=auth.uid();
 if bound is not null and bound<>i.player_id then return null;end if;
 select coalesce(jsonb_agg(to_jsonb(h)),'[]') into prior from (
  select distinct on(lower(character_name)) character_name as name,description,objective as goal,scene_title,scene_date,location
  from private.character_appearances where player_id=i.player_id order by lower(character_name),joined_at desc)h;
 return jsonb_build_object('player_alias',i.player_name,'characters',to_jsonb(i.assigned_characters||i.guest_roles),
 'character_details',i.guest_role_details,'previous_characters',prior,'title',i.title,'session_generation',i.session_generation,
 'scene_date',coalesce(i.scene_date,''),'location',coalesce(i.location_name,''),'opening',coalesce(i.opening_text,''));
end;$$;

create or replace function private.portal_redeem(p_code text,p_characters text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare i record;who uuid:=auth.uid();bound uuid;names text[];allowed text[];nm text;det jsonb;generation uuid;
begin
 if who is null or private.is_jade_emperor() then raise exception 'Player identity required';end if;
 if p_code is null or p_code !~ '^[0-9a-f]{48}$' then raise exception 'Invalid invitation';end if;
 -- Room lock comes before invitation lock, matching reset/end/kick and preventing deadlocks.
 select room_id into generation from private.scene_invitations where token_hash=encode(extensions.digest(p_code,'sha256'),'hex');
 perform 1 from public.rooms where id=generation and session_state='active' for update;
 if not found then raise exception 'Session unavailable';end if;
 select v.*,p.alias as player_name into i from private.scene_invitations v join private.portal_players p on p.id=v.player_id
 where token_hash=encode(extensions.digest(p_code,'sha256'),'hex') and consumed_at is null and expires_at>now() for update of v;
 if not found then raise exception 'Invitation unavailable';end if;
 perform 1 from private.portal_players where id=i.player_id for update;
 select session_generation into generation from public.rooms where id=i.room_id;
 select player_id into bound from private.portal_accounts where user_id=who;
 if bound is not null and bound<>i.player_id then raise exception 'Player identity mismatch';end if;
 if exists(select 1 from public.room_members m where m.room_id=i.room_id and (m.user_id=who or m.user_id in(select user_id from private.portal_accounts where player_id=i.player_id))) then raise exception 'Already joined';end if;
 select array_agg(btrim(x)) into names from unnest(p_characters)x;
 if names is null or cardinality(names) not between 1 and 64 or cardinality(names)<>(select count(distinct lower(x)) from unnest(names)x) or array_position(names,null) is not null then raise exception 'Choose valid unique characters';end if;
 select coalesce(array_agg(character_name),'{}') into allowed from private.character_appearances where player_id=i.player_id;
 allowed:=allowed||i.assigned_characters||i.guest_roles;
 if not(names<@allowed) then raise exception 'Character not available';end if;
 if exists(select 1 from public.room_members m cross join lateral unnest(case when cardinality(m.allowed_characters)>0 then m.allowed_characters else array[m.character_name] end)c where m.room_id=i.room_id and lower(c) in(select lower(x) from unnest(names)x)) then raise exception 'Character already in this room';end if;
 insert into private.portal_accounts(user_id,player_id) values(who,i.player_id) on conflict do nothing;
 insert into public.room_members(room_id,user_id,character_name,role,player_alias,allowed_characters) values(i.room_id,who,names[1],'member',i.player_name,names);
 foreach nm in array names loop
  select value into det from jsonb_array_elements(i.guest_role_details) where value->>'name'=nm limit 1;
  if det is null then select jsonb_build_object('description',description,'goal',objective) into det from private.character_appearances where player_id=i.player_id and character_name=nm order by joined_at desc limit 1;end if;
  insert into private.character_appearances(player_id,room_id,scene_key,character_name,character_kind,description,objective,scene_title,scene_date,location)
  select i.player_id,r.id,generation,nm,'established',coalesce(det->>'description',''),coalesce(det->>'goal',''),r.title,coalesce(s.scene_date,''),coalesce(s.location_name,'') from public.rooms r left join private.scene_introductions s on s.room_id=r.id where r.id=i.room_id
  on conflict(player_id,scene_key,character_name) do nothing;
 end loop;
 update private.scene_invitations set consumed_at=now(),claimed_by=who where id=i.id;
 return i.room_id;
end;$$;
create or replace function public.redeem_scene_invitation(p_code text,p_role text default null,p_character_name text default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare v jsonb;names text[];
begin
 v:=private.portal_preview(p_code);if v is null then raise exception 'Invitation unavailable';end if;
 if p_character_name is not null or p_role is not null then names:=array[coalesce(p_character_name,p_role)];else select array_agg(x) into names from jsonb_array_elements_text(v->'characters')x;end if;
 return private.portal_redeem(p_code,names);
end;$$;

create or replace function private.control_session(p_room_id uuid,p_action text,p_user_id uuid default null) returns boolean language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();pid uuid;
begin
 if v_owner is null then raise exception 'Owner required';end if;
 perform 1 from public.rooms r where r.id=p_room_id and r.owner_id=v_owner for update;
 if not found then raise exception 'Owner room required';end if;
 if p_action='kick' then
  if p_user_id is null or p_user_id=v_owner or not exists(select 1 from public.room_members where room_id=p_room_id and user_id=p_user_id and role<>'owner') then raise exception 'Select a player in this room';end if;
  select player_id into pid from private.portal_accounts where user_id=p_user_id;
  update private.scene_invitations set expires_at=least(expires_at,now()),consumed_at=coalesce(consumed_at,clock_timestamp()) where room_id=p_room_id and (claimed_by=p_user_id or (pid is not null and player_id=pid));
  delete from public.room_members where room_id=p_room_id and role<>'owner' and (user_id=p_user_id or (pid is not null and user_id in(select user_id from private.portal_accounts where player_id=pid)));
 elsif p_action in ('end','reset') then
  update private.scene_invitations set expires_at=least(expires_at,now()),consumed_at=coalesce(consumed_at,clock_timestamp()) where room_id=p_room_id;
  update private.room_invites set remaining_uses=0 where room_id=p_room_id;
  delete from public.room_members where room_id=p_room_id and role<>'owner';
  if p_action='reset' then
   delete from public.messages where room_id=p_room_id;
   delete from private.scene_introductions where room_id=p_room_id;
   update public.rooms set session_state='active',session_generation=gen_random_uuid(),ended_at=null where id=p_room_id;
  else update public.rooms set session_state='ended',ended_at=now() where id=p_room_id;end if;
 else raise exception 'Unknown session action';end if;
 return true;
end;$$;
create function public.control_session(p_room_id uuid,p_action text,p_user_id uuid default null) returns boolean language sql security invoker set search_path='' as $$select private.control_session(p_room_id,p_action,p_user_id);$$;

create or replace function private.is_room_member(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.room_members m join public.rooms r on r.id=m.room_id where m.room_id=p_room and m.user_id=auth.uid() and (r.session_state='active' or m.role='owner'));
$$;
-- A final write guard covers every message route, including legacy APIs and direct inserts.
create function private.require_active_session() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.rooms where id=new.room_id and session_state='active' for update;
 if not found then raise exception 'Session unavailable';end if;
 if not exists(select 1 from public.room_members where room_id=new.room_id and user_id=new.sender_id) then raise exception 'Participant access ended';end if;
 return new;
end;$$;
create trigger require_active_session before insert on public.messages for each row execute function private.require_active_session();

revoke all on function private.create_player_invitation(uuid,text,jsonb),private.control_session(uuid,text,uuid),private.require_active_session(),public.create_player_invitation(uuid,text,jsonb),public.control_session(uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.create_player_invitation(uuid,text,jsonb),private.control_session(uuid,text,uuid),public.create_player_invitation(uuid,text,jsonb),public.control_session(uuid,text,uuid) to authenticated;
-- These private implementation functions are not exposed through the Data API.
commit;
