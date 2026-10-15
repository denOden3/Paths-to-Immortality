begin;
-- Owner-only read model. Browser sessions and invitations are deliberately not treated as online presence.
create function private.portal_player_roster() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_jade_emperor() then raise exception 'Administrator access required';end if;
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
 where p.owner_id=auth.uid()),'[]'::jsonb);
end;$$;
create function public.portal_player_roster() returns jsonb language sql security invoker set search_path='' as $$select private.portal_player_roster();$$;
revoke all on function private.portal_player_roster(),public.portal_player_roster() from public,anon,authenticated;
grant execute on function private.portal_player_roster(),public.portal_player_roster() to authenticated;
commit;
