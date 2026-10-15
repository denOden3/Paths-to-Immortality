-- Additive portal upgrade. Private tables are accessed through narrowly granted RPCs.
begin;
create table private.portal_admins(user_id uuid primary key references auth.users(id));
insert into private.portal_admins select owner_id from private.monkey_delegations;
alter table private.portal_admins enable row level security;
revoke all on private.portal_admins from public,anon,authenticated;
create function private.is_jade_emperor() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.portal_admins where user_id=auth.uid());
$$;
revoke all on function private.is_jade_emperor() from public;
grant execute on function private.is_jade_emperor() to authenticated;

create table private.portal_players(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 alias text not null check(length(btrim(alias)) between 1 and 45),
 kind text not null check(kind in ('established','temporary')),created_at timestamptz not null default now()
);
create unique index portal_player_alias on private.portal_players(owner_id,lower(alias));
create table private.portal_accounts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 player_id uuid not null references private.portal_players(id),created_at timestamptz not null default now()
);
create index portal_accounts_player on private.portal_accounts(player_id);
create table private.character_appearances(
 id uuid primary key default gen_random_uuid(),player_id uuid not null references private.portal_players(id),
 room_id uuid references public.rooms(id) on delete set null,scene_key uuid not null,
 character_name text not null,character_kind text not null check(character_kind in ('established','temporary')),
 description text not null default '',objective text not null default '',
 scene_title text not null,scene_date text not null default '',location text not null default '',
 joined_at timestamptz not null default now(),unique(player_id,scene_key,character_name)
);
create index character_history_player on private.character_appearances(player_id,joined_at desc);
create index character_history_room on private.character_appearances(room_id);
alter table private.portal_players enable row level security;
alter table private.portal_accounts enable row level security;
alter table private.character_appearances enable row level security;
revoke all on private.portal_players,private.portal_accounts,private.character_appearances from public,anon,authenticated;
alter table private.scene_invitations add column player_id uuid references private.portal_players(id);
create index scene_invitations_player on private.scene_invitations(player_id);
-- Preserve invitations issued before this upgrade.
insert into private.portal_players(owner_id,alias,kind)
 select distinct on (creator_id,lower(player_alias)) creator_id,player_alias,
 case when invite_type='assigned' then 'established' else 'temporary' end
 from private.scene_invitations order by creator_id,lower(player_alias),created_at desc
 on conflict do nothing;
update private.scene_invitations i set player_id=p.id from private.portal_players p
 where p.owner_id=i.creator_id and lower(p.alias)=lower(i.player_alias);
insert into private.portal_accounts(user_id,player_id)
 select distinct on (claimed_by) claimed_by,player_id from private.scene_invitations
 where claimed_by is not null and player_id is not null order by claimed_by,consumed_at desc
 on conflict do nothing;

create table public.portal_presentation(
 id boolean primary key default true check(id),settings jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),check(jsonb_typeof(settings)='object' and octet_length(settings::text)<16000)
);
alter table public.portal_presentation enable row level security;
revoke all on public.portal_presentation from public,anon,authenticated;
grant select on public.portal_presentation to anon,authenticated;
grant update(settings,updated_at) on public.portal_presentation to authenticated;
create policy "Everyone reads presentation" on public.portal_presentation for select using(true);
create policy "Jade Emperor edits presentation" on public.portal_presentation for update to authenticated
 using(private.is_jade_emperor()) with check(private.is_jade_emperor());
insert into public.portal_presentation(id) values(true);

create function private.portal_context() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p record;
begin
 if auth.uid() is null then return jsonb_build_object('is_admin',false);end if;
 if private.is_jade_emperor() then return jsonb_build_object('is_admin',true,'alias','Jade Emperor');end if;
 select r.* into p from private.portal_players r join private.portal_accounts a on a.player_id=r.id where a.user_id=auth.uid();
 if not found then return jsonb_build_object('is_admin',false);end if;
 return jsonb_build_object('is_admin',false,'player_id',p.id,'alias',p.alias,'kind',p.kind);
end;$$;
create function public.portal_context() returns jsonb language sql security invoker set search_path='' as $$ select private.portal_context(); $$;

create function private.portal_manage_player(p_alias text default null,p_kind text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_jade_emperor() then raise exception 'Jade Emperor access required';end if;
 if p_alias is not null then
  if length(btrim(p_alias)) not between 1 and 45 or p_kind not in ('established','temporary') or p_kind is null then raise exception 'Enter a player name and category';end if;
  insert into private.portal_players(owner_id,alias,kind) values(auth.uid(),btrim(p_alias),p_kind)
  on conflict(owner_id,lower(alias)) do update set alias=excluded.alias,kind=excluded.kind;
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'alias',alias,'kind',kind) order by lower(alias)) from private.portal_players where owner_id=auth.uid()),'[]'::jsonb);
end;$$;
create function public.portal_manage_player(p_alias text default null,p_kind text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.portal_manage_player(p_alias,p_kind); $$;

create function private.portal_character_log() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pid uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to view your Characters Log';end if;
 select player_id into pid from private.portal_accounts where user_id=auth.uid();
 return coalesce((select jsonb_agg(jsonb_build_object('character',character_name,'kind',character_kind,'description',description,'objective',objective,'scene_title',scene_title,'scene_date',scene_date,'location',location,'room_id',room_id,'joined_at',joined_at) order by joined_at desc) from private.character_appearances where player_id=pid),'[]'::jsonb);
end;$$;
create function public.portal_character_log() returns jsonb language sql security invoker set search_path='' as $$ select private.portal_character_log(); $$;

-- Register every new HUD invitation against the owner's stable player record.
create function private.attach_invitation_player() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.portal_admins where user_id=new.creator_id) then raise exception 'Only the Jade Emperor may invite players';end if;
 insert into private.portal_players(owner_id,alias,kind) values(new.creator_id,new.player_alias,case when new.invite_type='assigned' then 'established' else 'temporary' end)
 on conflict(owner_id,lower(alias)) do nothing;
 select id into new.player_id from private.portal_players where owner_id=new.creator_id and lower(alias)=lower(new.player_alias);
 return new;
end;$$;
create trigger attach_invitation_player before insert on private.scene_invitations for each row execute function private.attach_invitation_player();

create function private.portal_preview(p_code text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i record;prior jsonb;bound uuid;
begin
 if p_code is null or p_code !~ '^[0-9a-f]{48}$' then return null;end if;
 select v.*,p.kind as player_kind,p.alias as player_name,r.title,s.scene_date,s.location_name,s.opening_text into i
 from private.scene_invitations v join private.portal_players p on p.id=v.player_id
 join public.rooms r on r.id=v.room_id left join private.scene_introductions s on s.room_id=r.id
 where token_hash=encode(extensions.digest(p_code,'sha256'),'hex') and consumed_at is null and expires_at>now();
 if not found then return null;end if;
 select player_id into bound from private.portal_accounts where user_id=auth.uid();
 if bound is not null and bound<>i.player_id then raise exception 'This invitation belongs to a different player. Sign out first.';end if;
 -- A private one-use invitation authorizes preview of this player's permitted names only.
 select coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb) into prior from (
 select distinct on (lower(character_name)) character_name as name,description,objective as goal
 from private.character_appearances where player_id=i.player_id and character_kind='temporary' order by lower(character_name),joined_at desc)h;
 return jsonb_build_object('player_alias',i.player_name,'player_kind',i.player_kind,'invite_type',i.invite_type,
 'characters',case when i.player_kind='established' then to_jsonb(i.assigned_characters) else '[]'::jsonb end,
 'roles',case when i.player_kind='temporary' then to_jsonb(i.guest_roles) else '[]'::jsonb end,
 'role_details',i.guest_role_details,'previous_characters',prior,'title',i.title,
 'scene_date',coalesce(i.scene_date,''),'location',coalesce(i.location_name,''),'opening',coalesce(i.opening_text,''));
end;$$;
-- Replace the old preview too so previous clients cannot bypass player identity checks.
create or replace function public.preview_scene_invitation(p_code text) returns jsonb language sql security invoker set search_path='' as $$ select private.portal_preview(p_code); $$;

create function private.portal_redeem(p_code text,p_characters text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare i record;who uuid:=auth.uid();bound uuid;names text[];nm text;det jsonb;vrole text;
begin
 if who is null or private.is_jade_emperor() then raise exception 'Use your player identity to enter a session';end if;
 if p_code is null or p_code !~ '^[0-9a-f]{48}$' then raise exception 'Invalid invitation';end if;
 select v.*,p.kind as player_kind,p.alias as player_name into i from private.scene_invitations v join private.portal_players p on p.id=v.player_id
 where token_hash=encode(extensions.digest(p_code,'sha256'),'hex') and consumed_at is null and expires_at>now() for update of v;
 if not found then raise exception 'Invitation already used or expired';end if;
 -- Serialize entrants for this room to prevent two people claiming the same character concurrently.
 perform 1 from public.rooms where id=i.room_id for update;
 perform 1 from private.portal_players where id=i.player_id for update;
 select player_id into bound from private.portal_accounts where user_id=who;
 if bound is not null and bound<>i.player_id then raise exception 'This invitation belongs to another player';end if;
 if exists(select 1 from public.room_members m where m.room_id=i.room_id and (m.user_id=who or m.user_id in (select user_id from private.portal_accounts where player_id=i.player_id))) then raise exception 'You already joined this session; open it from Your sessions';end if;
 select array_agg(btrim(x)) into names from unnest(p_characters)x;
 if names is null or cardinality(names) not between 1 and 8 or cardinality(names)<>(select count(distinct lower(x)) from unnest(names)x) or array_position(names,null) is not null then raise exception 'Select valid, unique characters';end if;
 if i.player_kind='established' then
  if i.invite_type<>'assigned' or not(names <@ i.assigned_characters) then raise exception 'Select only established characters assigned to you';end if;
 else
  if cardinality(names)<>1 then raise exception 'Temporary players must choose exactly one character';end if;
  if not(names[1]=any(i.guest_roles)) and not exists(select 1 from private.character_appearances where player_id=i.player_id and character_kind='temporary' and character_name=names[1]) then raise exception 'Choose a pre-established character or one you played before';end if;
  vrole:=names[1];
 end if;
 if exists(select 1 from public.room_members m cross join lateral unnest(case when cardinality(m.allowed_characters)>0 then m.allowed_characters else array[m.character_name] end)c where m.room_id=i.room_id and lower(c) in (select lower(x) from unnest(names)x)) then raise exception 'A selected character is already in this session';end if;
 insert into private.portal_accounts(user_id,player_id) values(who,i.player_id) on conflict do nothing;
 insert into public.room_members(room_id,user_id,character_name,role,player_alias,allowed_characters,guest_role) values(i.room_id,who,names[1],'member',i.player_name,names,vrole);
 foreach nm in array names loop
  select value into det from jsonb_array_elements(i.guest_role_details) where value->>'name'=nm limit 1;
  if det is null then select jsonb_build_object('description',description,'goal',objective) into det from private.character_appearances where player_id=i.player_id and character_name=nm order by joined_at desc limit 1;end if;
  insert into private.character_appearances(player_id,room_id,scene_key,character_name,character_kind,description,objective,scene_title,scene_date,location)
  select i.player_id,r.id,r.id,nm,i.player_kind,coalesce(det->>'description',''),coalesce(det->>'goal',''),r.title,coalesce(s.scene_date,''),coalesce(s.location_name,'') from public.rooms r left join private.scene_introductions s on s.room_id=r.id where r.id=i.room_id;
 end loop;
 update private.scene_invitations set consumed_at=now(),claimed_by=who where id=i.id;
 return i.room_id;
end;$$;
create function public.portal_redeem(p_code text,p_characters text[]) returns uuid language sql security invoker set search_path='' as $$ select private.portal_redeem(p_code,p_characters); $$;
-- Compatibility route is subject to the same new rules; free-form guest creation is removed.
create or replace function public.redeem_scene_invitation(p_code text,p_role text default null,p_character_name text default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare v jsonb;ch text[];
begin
 v:=private.portal_preview(p_code);
 if v is null then raise exception 'Invalid or expired invitation';end if;
 if v->>'player_kind'='established' then select array_agg(x) into ch from jsonb_array_elements_text(v->'characters')x;
 else ch:=array[coalesce(p_character_name,p_role)];end if;
 return private.portal_redeem(p_code,ch);
end;$$;
-- Room creation through Web is now a reserved administration operation.
create or replace function public.create_room(p_title text,p_character_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if not private.is_jade_emperor() then raise exception 'Only the Jade Emperor can create sessions';end if;
 if length(btrim(coalesce(p_title,''))) not between 1 and 80 or length(btrim(coalesce(p_character_name,''))) not between 1 and 40 then raise exception 'Enter a room title and character';end if;
 insert into public.rooms(title,owner_id) values(btrim(p_title),auth.uid()) returning id into rid;
 insert into public.room_members(room_id,user_id,character_name,role,allowed_characters) values(rid,auth.uid(),btrim(p_character_name),'owner',array[btrim(p_character_name)]);
 return rid;
end;$$;

-- Explicit grants: no new privileged function is implicitly executable by PUBLIC.
revoke all on function private.portal_context(),private.portal_manage_player(text,text),private.portal_character_log(),private.attach_invitation_player(),private.portal_preview(text),private.portal_redeem(text,text[]) from public,anon,authenticated;
grant usage on schema private to anon,authenticated;
grant execute on function private.portal_context(),private.portal_manage_player(text,text),private.portal_character_log(),private.portal_redeem(text,text[]) to authenticated;
grant execute on function private.portal_preview(text) to anon,authenticated;
revoke all on function public.portal_context(),public.portal_manage_player(text,text),public.portal_character_log(),public.portal_redeem(text,text[]),public.preview_scene_invitation(text),public.redeem_scene_invitation(text,text,text),public.create_room(text,text) from public,anon,authenticated;
grant execute on function public.portal_context(),public.portal_manage_player(text,text),public.portal_character_log(),public.portal_redeem(text,text[]),public.redeem_scene_invitation(text,text,text),public.create_room(text,text) to authenticated;
grant execute on function public.preview_scene_invitation(text) to anon,authenticated;
commit;
