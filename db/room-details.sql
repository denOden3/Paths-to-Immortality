begin;
create or replace function private.save_room_setup(p_room uuid,p_date text,p_time text,p_location text,p_custom text,p_spot text,p_opening text,p_goals text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();place text;begin
 if v_owner is null then raise exception 'Owner authorization required';end if;
 perform 1 from public.rooms where id=p_room and owner_id=v_owner and session_state='active' for update;
 if not found then raise exception 'Select an ongoing owner room';end if;
 if length(btrim(coalesce(p_date,''))) not between 1 and 90 or p_time is null or length(p_time)>90 or length(btrim(coalesce(p_opening,''))) not between 1 and 2500 or p_goals is null or length(p_goals)>1200 or p_spot is null or length(p_spot)>90 then raise exception 'Check date, time, opening, goals and starting spot';end if;
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
create function private.save_room_details(p_room uuid,p_title text,p_date text,p_time text,p_location text,p_custom text,p_spot text,p_opening text,p_goals text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();begin
 if v_owner is null then raise exception 'Owner authorization required';end if;
 if length(btrim(coalesce(p_title,''))) not between 1 and 80 then raise exception 'Room name must contain 1 to 80 characters';end if;
 -- Existing setup validation checks ownership and locks the active room before either change.
 perform private.save_room_setup(p_room,p_date,p_time,p_location,p_custom,p_spot,p_opening,p_goals);
 update public.rooms set title=btrim(p_title) where id=p_room and owner_id=v_owner;
 return true;
end;$$;
create function public.save_room_details(p_room uuid,p_title text,p_date text,p_time text,p_location text,p_custom text,p_spot text,p_opening text,p_goals text) returns boolean language sql security invoker set search_path='' as $$select private.save_room_details(p_room,p_title,p_date,p_time,p_location,p_custom,p_spot,p_opening,p_goals);$$;
revoke all on function private.save_room_details(uuid,text,text,text,text,text,text,text,text),public.save_room_details(uuid,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.save_room_details(uuid,text,text,text,text,text,text,text,text),public.save_room_details(uuid,text,text,text,text,text,text,text,text) to authenticated;
commit;
