begin;
-- Private implementation; the exposed wrapper retains invoker permissions.
create function private.hud_player_registry(p_id uuid default null,p_alias text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();v_alias text:=btrim(p_alias);
begin
 if v_owner is null then raise exception 'Owner authorization required';end if;
 if p_alias is not null then
  if length(v_alias) not between 1 and 45 then raise exception 'Enter a player name (1–45 characters)';end if;
  if p_id is null then
   insert into private.portal_players(owner_id,alias,kind) values(v_owner,v_alias,'established')
   on conflict(owner_id,lower(alias)) do nothing;
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
exception when unique_violation then raise exception 'That player name is already registered';
end;$$;
create function public.hud_player_registry(p_id uuid default null,p_alias text default null) returns jsonb
language sql security invoker set search_path='' as $$select private.hud_player_registry(p_id,p_alias);$$;
revoke all on function private.hud_player_registry(uuid,text),public.hud_player_registry(uuid,text) from public,anon,authenticated;
grant execute on function private.hud_player_registry(uuid,text),public.hud_player_registry(uuid,text) to authenticated;
commit;
