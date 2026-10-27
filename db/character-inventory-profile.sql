-- Profile read endpoint for the same private inventory used by room_player_panel.
begin;
create or replace function private.character_inventory_profile(p_character_key uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare permitted boolean;
begin
 if auth.uid() is null then raise exception 'Sign in to view inventory' using errcode='42501'; end if;
 select exists(select 1 from private.owner_character_keys k where k.id=p_character_key and k.owner_id=auth.uid())
 or exists(select 1 from private.player_characters c join private.portal_players p on p.id=c.player_id where c.id=p_character_key and
 (p.owner_id=auth.uid() or exists(select 1 from private.portal_accounts a where a.player_id=c.player_id and a.user_id=auth.uid()))) into permitted;
 if not permitted then raise exception 'This inventory is available to its player and game owner' using errcode='42501'; end if;
 return jsonb_build_object('inventory',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'quantity',quantity,'note',note) order by lower(name)) from private.character_inventory where character_key=p_character_key and quantity>0),'[]'::jsonb));
end;$$;
create or replace function public.character_inventory_profile(p_character_key uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select private.character_inventory_profile(p_character_key);$$;
revoke all on function private.character_inventory_profile(uuid),public.character_inventory_profile(uuid) from public,anon,authenticated;
grant execute on function private.character_inventory_profile(uuid),public.character_inventory_profile(uuid) to authenticated;
commit;
