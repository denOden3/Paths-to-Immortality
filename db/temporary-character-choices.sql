begin;
CREATE OR REPLACE FUNCTION private.invite_registered_player(p_room uuid, p_player uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner uuid:=private.monkey_owner();player_name text;token text;begin
 if v_owner is null then raise exception 'Owner authorization required';end if;
 perform 1 from public.rooms where id=p_room and owner_id=v_owner and session_state='active' for update;
 if not found then raise exception 'Select an ongoing owner room';end if;
 select alias into player_name from private.portal_players where id=p_player and owner_id=v_owner for update;
 if player_name is null then raise exception 'Select a registered player';end if;
 token:=encode(extensions.gen_random_bytes(24),'hex');
 insert into private.scene_invitations(room_id,creator_id,token_hash,player_alias,invite_type,assigned_characters,guest_roles)
 values(p_room,v_owner,encode(extensions.digest(token,'sha256'),'hex'),player_name,'assigned',array[]::text[],array[]::text[]);
 return token;
end;$function$
;
CREATE OR REPLACE FUNCTION private.portal_preview(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i record;prior jsonb;bound uuid;
begin
 if p_code is null or p_code !~ '^[0-9a-f]{48}$' then return null;end if;
 select v.*,p.alias as player_name,r.title,r.session_generation,s.scene_date,s.location_name,s.opening_text,s.time_of_day,s.session_goals into i
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
 return jsonb_build_object('player_alias',i.player_name,'characters',to_jsonb(i.assigned_characters),
 'character_details',i.guest_role_details,'temporary_characters',i.guest_role_details,'previous_characters',prior,'title',i.title,'session_generation',i.session_generation,
 'scene_date',coalesce(i.scene_date,''),'location',coalesce(i.location_name,''),'opening',coalesce(i.opening_text,''),'time_of_day',coalesce(i.time_of_day,''),'session_goals',coalesce(i.session_goals,''));
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
 if (select count(*) from unnest(names)x where x=any(i.guest_roles))>1 then raise exception 'Choose at most one temporary character';end if;
 if not(names<@allowed) then raise exception 'Character not available';end if;
 if exists(select 1 from public.room_members m cross join lateral unnest(case when cardinality(m.allowed_characters)>0 then m.allowed_characters else array[m.character_name] end)c where m.room_id=i.room_id and lower(c) in(select lower(x) from unnest(names)x)) then raise exception 'Character already in this room';end if;
 insert into private.portal_accounts(user_id,player_id) values(who,i.player_id) on conflict do nothing;
 insert into public.room_members(room_id,user_id,character_name,role,player_alias,allowed_characters) values(i.room_id,who,names[1],'member',i.player_name,names);
 foreach nm in array names loop
  select value into det from jsonb_array_elements(i.guest_role_details) where value->>'name'=nm limit 1;
  if det is null then select jsonb_build_object('description',description,'goal',objective) into det from private.player_characters where player_id=i.player_id and name=nm and not hidden;end if;
  insert into private.character_appearances(player_id,room_id,scene_key,character_name,character_kind,description,objective,scene_title,scene_date,location)
  select i.player_id,r.id,generation,nm,case when nm=any(i.guest_roles) then 'temporary' else 'established' end,coalesce(det->>'description',''),coalesce(det->>'goal',''),r.title,coalesce(s.scene_date,''),coalesce(s.location_name,'') from public.rooms r left join private.scene_introductions s on s.room_id=r.id where r.id=i.room_id
  on conflict(player_id,scene_key,character_name) do nothing;
 end loop;
 update private.scene_invitations set consumed_at=now(),claimed_by=who where id=i.id;
 return i.room_id;
end;$function$
;
CREATE OR REPLACE FUNCTION private.remember_player_character()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.character_kind='temporary' then return new;end if;
 insert into private.player_characters(player_id,name,description,objective,history_names)
 values(new.player_id,new.character_name,left(new.description,350),left(new.objective,150),array[new.character_name])
 on conflict(player_id,lower(name)) do update set hidden=false;
 return new;
end;$function$
;
create function private.suggest_temporary_characters(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i record;rid uuid;slug text;place text;roles text[];descriptions text[];result jsonb:='[]';names text[]:='{}';nm text;seed int;n int;attempt int;
 surnames text[]:=array['Lin','Zhou','Chen','Luo','He','Wei','Han','Song','Lu','Meng','Qiao','Tang','Bai','Du','Gu','Li','Wu','Ye','Jin','Zhu'];
 given_names text[]:=array['An','Ping','Fu','Ning','Qing','Shun','Min','Yu','Rong','Lan','Bo','Tao','Yun','Xin','Xiu','Liang','Chun','Hui','Shan','Ren'];
begin
 if p_code is null or p_code !~ '^[0-9a-f]{48}$' then return null;end if;
 select room_id into rid from private.scene_invitations where token_hash=encode(extensions.digest(p_code,'sha256'),'hex');
 perform 1 from public.rooms where id=rid and session_state='active' for update;
 if not found then return null;end if;
 if private.portal_preview(p_code) is null then return null;end if;
 select * into i from private.scene_invitations where token_hash=encode(extensions.digest(p_code,'sha256'),'hex') and consumed_at is null and expires_at>now() for update;
 if not found then return null;end if;
 -- Explicit owner-authored guest roles are preserved rather than replaced.
 if cardinality(i.guest_roles)>0 and not exists(select 1 from jsonb_array_elements(i.guest_role_details)x where x->>'suggested'='true') then return i.guest_role_details;end if;
 select location_slug,location_name into slug,place from private.scene_introductions where room_id=rid;
 if coalesce(place,'')='' then raise exception 'The host must save the session location first';end if;
 case
 when slug in ('mountain-gate','mountain-path','lower-trail-junction') then
 roles:=array['path sweeper','bundle carrier','passing traveller'];descriptions:=array['An ordinary worker clearing leaves from the path; patient and observant.','A porter delivering everyday supplies along the route; practical and talkative.','An ordinary traveller pausing on the public route; curious but cautious.'];
 when slug in ('dining-hall','communal-kitchens') then
 roles:=array['kitchen helper','dish washer','meal runner'];descriptions:=array['A helper preparing vegetables and carrying bowls; cheerful and easily distracted.','A quiet worker washing everyday dishes; notices small practical troubles.','A junior helper carrying meals and water; brisk and eager to finish the task.'];
 when slug='bathhouse' then
 roles:=array['water carrier','laundry helper','bath attendant'];descriptions:=array['A worker carrying fresh water for the baths; steady and reserved.','A helper sorting clean towels; friendly and fond of harmless conversation.','A junior attendant tidying the entrance; polite, with no authority over visitors.'];
 when slug in ('verdant-pill','practice-garden') then
 roles:=array['basket carrier','garden helper','watering helper'];descriptions:=array['A helper carrying ordinary herb baskets; careful and curious, with no special knowledge.','A junior worker weeding the paths; patient and down to earth.','A helper watering common plants; earnest and slightly forgetful.'];
 when slug='spirit-beast' then
 roles:=array['feed carrier','yard cleaner','errand runner'];descriptions:=array['A junior helper carrying everyday animal feed; cautious around the enclosures.','A worker sweeping the outer service yard; practical and good humoured.','An ordinary runner delivering mundane supplies to the entrance; lively and inquisitive.'];
 when slug='registration-hall' then
 roles:=array['paper sorter','ink grinder','queue helper'];descriptions:=array['A helper sorting blank forms; diligent, with no access to private records.','A junior assistant preparing ordinary ink; quiet and meticulous.','A helper showing visitors where to wait; friendly, with no admission authority.'];
 when slug='central-assembly' then
 roles:=array['bench arranger','water carrier','message runner'];descriptions:=array['A junior helper arranging seats before or after gatherings; sociable and hardworking.','A worker carrying drinking water to the public hall; calm and attentive.','A runner carrying an ordinary delivery; impatient to finish, with no privileged information.'];
 when slug in ('sword-peak','talisman-formation','wuxing-peak','disciplinary-hall','outer-courtyard','east-dormitories','ginkgo-notice-board','cloudveil') then
 roles:=array['courtyard sweeper','supply carrier','errand runner'];descriptions:=array['A junior helper sweeping the outer courtyard; ordinary skills and a dry sense of humour.','A worker bringing mundane supplies to the entrance; careful and approachable.','A junior runner waiting at the public entrance; curious, with no special access or authority.'];
 else
 roles:=array['local helper','errand courier','waiting visitor'];descriptions:=array['An ordinary helper tidying the accessible area; practical and quietly friendly.','An ordinary courier bringing a mundane delivery to the entrance; talkative and in a hurry.','An unimportant visitor waiting in an accessible area; curious and cautious, without special access.'];
 end case;
 seed:=get_byte(decode(i.token_hash,'hex'),0)*256+get_byte(decode(i.token_hash,'hex'),1);
 for n in 1..3 loop
  attempt:=0;
  loop
   nm:=surnames[1+((seed+n*37+attempt)%20)]||' '||given_names[1+(((seed+n*37+attempt)/20)%20)]||' — '||roles[n];
   exit when not exists(select 1 from public.room_members m cross join lateral unnest(m.allowed_characters)c where m.room_id=rid and lower(c)=lower(nm)) and not exists(select 1 from private.player_characters c where c.player_id=i.player_id and lower(c.name)=lower(nm) and not c.hidden);
   attempt:=attempt+1;if attempt>400 then raise exception 'No temporary role available';end if;
  end loop;
  names:=array_append(names,nm);result:=result||jsonb_build_array(jsonb_build_object('name',nm,'description',descriptions[n],'goal','','suggested',true));
 end loop;
 update private.scene_invitations set guest_roles=names,guest_role_details=result where id=i.id;
 return result;
end;$$;
create function public.suggest_temporary_characters(p_code text) returns jsonb language sql security invoker set search_path='' as $$select private.suggest_temporary_characters(p_code);$$;
revoke all on function private.suggest_temporary_characters(text),public.suggest_temporary_characters(text) from public,anon,authenticated;
grant execute on function private.suggest_temporary_characters(text),public.suggest_temporary_characters(text) to anon,authenticated;
commit;
