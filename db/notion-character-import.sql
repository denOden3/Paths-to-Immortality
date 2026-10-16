begin;
alter table private.player_characters add column source_url text not null default '';
create or replace function private.hud_player_characters(p_player uuid,p_action text default 'list',p_character uuid default null,p_name text default null,p_description text default '',p_objective text default '') returns jsonb
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
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'goal',objective,'source_url',source_url) order by lower(name)) from private.player_characters where player_id=p_player and not hidden),'[]'::jsonb);
exception when unique_violation then raise exception 'This character name is already registered for this player';
end;$$;

create function private.hud_save_character_source(p_player uuid,p_character uuid default null,p_name text default null,p_description text default '',p_objective text default '',p_source_url text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if private.monkey_owner() is null then raise exception 'Owner authorization required';end if;
 if p_source_url is null or (p_source_url<>'' and p_source_url !~ '^https://www[.]notion[.]so/[a-f0-9]{32}$') then raise exception 'Use a checked Notion page link';end if;
 result:=private.hud_player_characters(p_player,'save',p_character,p_name,p_description,p_objective);
 update private.player_characters set source_url=p_source_url where player_id=p_player and not hidden and (id=p_character or (p_character is null and lower(name)=lower(btrim(p_name))));
 return private.hud_player_characters(p_player);
end;$$;
create function public.hud_save_character_source(p_player uuid,p_character uuid default null,p_name text default null,p_description text default '',p_objective text default '',p_source_url text default '') returns jsonb
language sql security invoker set search_path='' as $$select private.hud_save_character_source(p_player,p_character,p_name,p_description,p_objective,p_source_url);$$;
revoke all on function private.hud_save_character_source(uuid,uuid,text,text,text,text),public.hud_save_character_source(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function private.hud_save_character_source(uuid,uuid,text,text,text,text),public.hud_save_character_source(uuid,uuid,text,text,text,text) to authenticated;
commit;
