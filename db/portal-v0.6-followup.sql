begin;
-- Allow the permanent administrator to use the same owner-scoped APIs as the paired HUD.
create or replace function private.monkey_owner() returns uuid language sql stable security definer set search_path='' as $$
 select case when private.is_jade_emperor() then auth.uid() else
 (select d.owner_id from private.monkey_delegations d join private.portal_admins a on a.user_id=d.owner_id
 where d.monkey_id=auth.uid() and d.revoked_at is null limit 1) end;
$$;
create or replace function private.portal_character_log() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pid uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to view your Characters Log';end if;
 select player_id into pid from private.portal_accounts where user_id=auth.uid();
 return coalesce((select jsonb_agg(jsonb_build_object('character',h.character_name,'kind',h.character_kind,'description',h.description,'objective',h.objective,'scene_title',h.scene_title,'scene_date',h.scene_date,'location',h.location,'room_id',h.room_id,'joined_at',h.joined_at,'can_open',exists(select 1 from public.room_members m where m.room_id=h.room_id and m.user_id=auth.uid())) order by h.joined_at desc) from private.character_appearances h where h.player_id=pid),'[]'::jsonb);
end;$$;
create or replace function private.attach_invitation_player() returns trigger language plpgsql security definer set search_path='' as $$
declare k text;
begin
 if not exists(select 1 from private.portal_admins where user_id=new.creator_id) then raise exception 'Only the Jade Emperor may invite players';end if;
 k:=case when new.invite_type='assigned' then 'established' else 'temporary' end;
 insert into private.portal_players(owner_id,alias,kind) values(new.creator_id,new.player_alias,k) on conflict(owner_id,lower(alias)) do nothing;
 select id,kind into new.player_id,k from private.portal_players where owner_id=new.creator_id and lower(alias)=lower(new.player_alias);
 if (k='established') is distinct from (new.invite_type='assigned') then raise exception 'Invitation type must match the player registry category';end if;
 return new;
end;$$;
commit;
