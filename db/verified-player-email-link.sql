-- Verified-email player claim, without any player's private email in GitHub.
-- Install this file in Supabase; configure reservations separately in the private database.
-- Example reservation must be authorized by the owner and use a verified personal email.
create table if not exists private.portal_email_reservations (
  player_id uuid primary key references private.portal_players(id) on delete cascade,
  email text not null unique check (email = lower(btrim(email)) and position('@' in email) > 1),
  created_at timestamptz not null default now()
);
alter table private.portal_email_reservations enable row level security;
revoke all on private.portal_email_reservations from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.claim_reserved_player_identity()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_player uuid;
  v_existing uuid;
  v_guest uuid;
  v_moved integer := 0;
  v_rows integer := 0;
begin
  if v_actor is null then
    return jsonb_build_object('linked',false);
  end if;
  -- Read verified identity from auth.users, never from caller parameters or mutable metadata.
  select lower(btrim(u.email))
    into v_email
  from auth.users u
  where u.id=v_actor
    and u.email_confirmed_at is not null
    and u.is_anonymous is false;
  if v_email is null then
    return jsonb_build_object('linked',false);
  end if;

  select r.player_id into v_player
  from private.portal_email_reservations r
  join private.portal_players p on p.id=r.player_id
  join private.portal_admins ad on ad.user_id=p.owner_id
  where r.email=v_email
  for update of r;

  if v_player is null then
    return jsonb_build_object('linked',false);
  end if;
  if exists (select 1 from private.portal_admins ad where ad.user_id=v_actor) then
    raise exception 'An administrator account cannot claim a player identity';
  end if;

  select a.player_id into v_existing
  from private.portal_accounts a where a.user_id=v_actor for update;
  if v_existing is not null and v_existing <> v_player then
    raise exception 'This login already belongs to another player';
  end if;

  insert into private.portal_accounts(user_id,player_id)
  values (v_actor,v_player) on conflict(user_id) do nothing;

  -- Transfer only anonymous, browser-bound identities of this SAME player.
  -- Room messages retain their original sender IDs for historical integrity.
  for v_guest in
    select a.user_id
    from private.portal_accounts a
    join auth.users u on u.id=a.user_id
    where a.player_id=v_player and a.user_id<>v_actor and u.is_anonymous is true
    order by a.user_id
    for update of a
  loop
    insert into public.room_members(
      room_id,user_id,character_name,role,joined_at,
      player_alias,allowed_characters,guest_role
    )
    select m.room_id,v_actor,m.character_name,'member',m.joined_at,
           m.player_alias,m.allowed_characters,m.guest_role
    from public.room_members m
    where m.user_id=v_guest and m.role='member'
    on conflict (room_id,user_id) do nothing;
    get diagnostics v_rows = row_count;
    v_moved := v_moved + v_rows;

    delete from public.room_members
    where user_id=v_guest and role='member';
    delete from private.portal_accounts
    where user_id=v_guest and player_id=v_player;
  end loop;

  return jsonb_build_object('linked',true,'rooms_recovered',v_moved);
end;
$function$


CREATE OR REPLACE FUNCTION public.claim_reserved_player_identity()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.claim_reserved_player_identity();
$function$


revoke all on function public.claim_reserved_player_identity() from public, anon;
grant execute on function public.claim_reserved_player_identity() to authenticated;
revoke all on function private.claim_reserved_player_identity() from public, anon;
grant execute on function private.claim_reserved_player_identity() to authenticated;
