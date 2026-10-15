begin;
-- A managed character list is separate from immutable past scene appearances.
create table private.player_characters(
 id uuid primary key default gen_random_uuid(),player_id uuid not null references private.portal_players(id),
 name text not null check(length(btrim(name)) between 1 and 40),description text not null default '' check(length(description)<=350),
 objective text not null default '' check(length(objective)<=150),history_names text[] not null,hidden boolean not null default false
);
create unique index player_character_name on private.player_characters(player_id,lower(name));
alter table private.player_characters enable row level security;
revoke all on private.player_characters from public,anon,authenticated;
insert into private.player_characters(player_id,name,description,objective,history_names)
select distinct on(player_id,lower(character_name)) player_id,character_name,left(description,350),left(objective,150),array[character_name]
from private.character_appearances order by player_id,lower(character_name),joined_at desc;
create function private.remember_player_character() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.player_characters(player_id,name,description,objective,history_names)
 values(new.player_id,new.character_name,left(new.description,350),left(new.objective,150),array[new.character_name])
 on conflict(player_id,lower(name)) do update set hidden=false;
 return new;
end;$$;
revoke all on function private.remember_player_character() from public,anon,authenticated;
create trigger remember_player_character after insert on private.character_appearances for each row execute function private.remember_player_character();
create function private.hud_player_characters(p_player uuid,p_action text default 'list',p_character uuid default null,p_name text default null,p_description text default '',p_objective text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();v_name text:=btrim(p_name);existing uuid;
begin
 if v_owner is null then raise exception 'Owner authorization required';end if;
 perform 1 from private.portal_players where id=p_player and owner_id=v_owner for update;
 if not found then raise exception 'Player not found';end if;
 if p_action='save' then
  if v_name is null or length(v_name) not between 1 and 40 or p_description is null or length(p_description)>350 or p_objective is null or length(p_objective)>150 then raise exception 'Check character name, description and objective lengths';end if;
  if p_character is null then
   select id into existing from private.player_characters where player_id=p_player and lower(name)=lower(v_name) and not hidden;
   if existing is not null then raise exception 'This character is already registered for this player';end if;
   insert into private.player_characters(player_id,name,description,objective,history_names) values(p_player,v_name,p_description,p_objective,array[v_name])
   on conflict(player_id,lower(name)) do update set hidden=false,description=excluded.description,objective=excluded.objective;
  else
   update private.player_characters set history_names=case when v_name=any(history_names) then history_names else array_append(history_names,v_name) end,
    name=v_name,description=p_description,objective=p_objective where id=p_character and player_id=p_player and not hidden;
   if not found then raise exception 'Character not found';end if;
  end if;
 elsif p_action='remove' then
  update private.player_characters set hidden=true where id=p_character and player_id=p_player and not hidden;
  if not found then raise exception 'Character not found';end if;
 elsif p_action is distinct from 'list' then raise exception 'Unknown character action';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'goal',objective) order by lower(name)) from private.player_characters where player_id=p_player and not hidden),'[]'::jsonb);
exception when unique_violation then raise exception 'This character name is already registered for this player';
end;$$;
create function public.hud_player_characters(p_player uuid,p_action text default 'list',p_character uuid default null,p_name text default null,p_description text default '',p_objective text default '') returns jsonb
language sql security invoker set search_path='' as $$select private.hud_player_characters(p_player,p_action,p_character,p_name,p_description,p_objective);$$;
revoke all on function private.hud_player_characters(uuid,text,uuid,text,text,text),public.hud_player_characters(uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.hud_player_characters(uuid,text,uuid,text,text,text),public.hud_player_characters(uuid,text,uuid,text,text,text) to authenticated;

create or replace function private.hud_player_registry(p_id uuid default null,p_alias text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();v_alias text:=btrim(p_alias);
begin
 if v_owner is null then raise exception 'Owner authorization required';end if;
 if p_alias is not null then
  if length(v_alias) not between 1 and 45 then raise exception 'Enter a player name (1–45 characters)';end if;
  if p_id is null then
   insert into private.portal_players(owner_id,alias,kind) values(v_owner,v_alias,'established');
  else
   update private.portal_players set alias=v_alias where id=p_id and owner_id=v_owner;
   if not found then raise exception 'Player not found';end if;
   update public.room_members m set player_alias=v_alias
   where exists(select 1 from private.portal_accounts a where a.player_id=p_id and a.user_id=m.user_id)
    and exists(select 1 from public.rooms r where r.id=m.room_id and r.owner_id=v_owner);
  end if;
 elsif p_id is not null then raise exception 'Provide a player name';
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
   'id',p.id,'alias',p.alias,'registered_at',p.created_at,
   'in_session',jsonb_array_length(current_sessions.items)>0,
   'sessions',current_sessions.items
 ) order by lower(p.alias))
 from private.portal_players p
 cross join lateral (
  select coalesce(jsonb_agg(jsonb_build_object('room_id',q.id,'title',q.title,'characters',q.characters) order by q.title),'[]'::jsonb) as items
  from (
   select r.id,r.title,array_agg(distinct ch.name order by ch.name) as characters
   from private.portal_accounts a
   join public.room_members m on m.user_id=a.user_id and m.role<>'owner'
   join public.rooms r on r.id=m.room_id and r.session_state='active' and r.owner_id=p.owner_id
   cross join lateral unnest(case when cardinality(m.allowed_characters)>0 then m.allowed_characters else array[m.character_name] end)ch(name)
   where a.player_id=p.id group by r.id,r.title
  )q
 )current_sessions
 where p.owner_id=v_owner),'[]'::jsonb);
exception when unique_violation then raise exception 'This player name is already registered';
end;$$;

CREATE OR REPLACE FUNCTION private.portal_preview(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  select c.name,c.description,c.objective as goal,h.scene_title,h.scene_date,h.location
  from private.player_characters c left join lateral (
   select scene_title,scene_date,location from private.character_appearances a where a.player_id=c.player_id and a.character_name=any(c.history_names) order by joined_at desc limit 1
  )h on true where c.player_id=i.player_id and not c.hidden order by lower(c.name))h;
 return jsonb_build_object('player_alias',i.player_name,'characters',to_jsonb(i.assigned_characters||i.guest_roles),
 'character_details',i.guest_role_details,'previous_characters',prior,'title',i.title,'session_generation',i.session_generation,
 'scene_date',coalesce(i.scene_date,''),'location',coalesce(i.location_name,''),'opening',coalesce(i.opening_text,''));
end;$function$
;
CREATE OR REPLACE FUNCTION private.portal_redeem(p_code text, p_characters text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 select coalesce(array_agg(name),'{}') into allowed from private.player_characters where player_id=i.player_id and not hidden;
 allowed:=allowed||i.assigned_characters||i.guest_roles;
 if not(names<@allowed) then raise exception 'Character not available';end if;
 if exists(select 1 from public.room_members m cross join lateral unnest(case when cardinality(m.allowed_characters)>0 then m.allowed_characters else array[m.character_name] end)c where m.room_id=i.room_id and lower(c) in(select lower(x) from unnest(names)x)) then raise exception 'Character already in this room';end if;
 insert into private.portal_accounts(user_id,player_id) values(who,i.player_id) on conflict do nothing;
 insert into public.room_members(room_id,user_id,character_name,role,player_alias,allowed_characters) values(i.room_id,who,names[1],'member',i.player_name,names);
 foreach nm in array names loop
  select value into det from jsonb_array_elements(i.guest_role_details) where value->>'name'=nm limit 1;
  if det is null then select jsonb_build_object('description',description,'goal',objective) into det from private.player_characters where player_id=i.player_id and name=nm and not hidden;end if;
  insert into private.character_appearances(player_id,room_id,scene_key,character_name,character_kind,description,objective,scene_title,scene_date,location)
  select i.player_id,r.id,generation,nm,'established',coalesce(det->>'description',''),coalesce(det->>'goal',''),r.title,coalesce(s.scene_date,''),coalesce(s.location_name,'') from public.rooms r left join private.scene_introductions s on s.room_id=r.id where r.id=i.room_id
  on conflict(player_id,scene_key,character_name) do nothing;
 end loop;
 update private.scene_invitations set consumed_at=now(),claimed_by=who where id=i.id;
 return i.room_id;
end;$function$
;
commit;

