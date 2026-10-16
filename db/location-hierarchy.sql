begin;
alter table private.location_catalog add column ancestry text[] not null default '{}',add column access_context text not null default 'unspecified' check(access_context in ('sect','public','wilderness','unspecified'));
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains'],access_context='sect',parent='Qingluan Mountains' where id='cloudveil';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect'],access_context='sect',parent='Cloudveil Sect' where id='mountain-gate';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Mountain Gate'],access_context='sect',parent='Cloudveil Sect → Mountain Gate' where id='mountain-path';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect'],access_context='sect',parent='Cloudveil Sect' where id='central-assembly';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect'],access_context='sect',parent='Cloudveil Sect' where id='outer-courtyard';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Outer Disciples’ Courtyard'],access_context='sect',parent='Cloudveil Sect → Outer Disciples’ Courtyard' where id='registration-hall';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Outer Disciples’ Courtyard'],access_context='sect',parent='Cloudveil Sect → Outer Disciples’ Courtyard' where id='dining-hall';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Outer Disciples’ Courtyard'],access_context='sect',parent='Cloudveil Sect → Outer Disciples’ Courtyard' where id='bathhouse';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Outer Disciples’ Courtyard'],access_context='sect',parent='Cloudveil Sect → Outer Disciples’ Courtyard' where id='east-dormitories';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Outer Disciples’ Courtyard'],access_context='sect',parent='Cloudveil Sect → Outer Disciples’ Courtyard' where id='west-dormitories';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Outer Disciples’ Courtyard'],access_context='sect',parent='Cloudveil Sect → Outer Disciples’ Courtyard' where id='practice-square';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Outer Disciples’ Courtyard'],access_context='sect',parent='Cloudveil Sect → Outer Disciples’ Courtyard' where id='ginkgo-notice-board';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Outer Disciples’ Courtyard'],access_context='sect',parent='Cloudveil Sect → Outer Disciples’ Courtyard' where id='lower-trail-junction';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Outer Disciples’ Courtyard'],access_context='sect',parent='Cloudveil Sect → Outer Disciples’ Courtyard' where id='communal-kitchens';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Outer Disciples’ Courtyard'],access_context='sect',parent='Cloudveil Sect → Outer Disciples’ Courtyard' where id='practice-garden';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Five Peaks'],access_context='sect',parent='Cloudveil Sect → Five Peaks' where id='sword-peak';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Five Peaks'],access_context='sect',parent='Cloudveil Sect → Five Peaks' where id='verdant-pill';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Five Peaks'],access_context='sect',parent='Cloudveil Sect → Five Peaks' where id='talisman-formation';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Five Peaks'],access_context='sect',parent='Cloudveil Sect → Five Peaks' where id='spirit-beast';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect','Five Peaks'],access_context='sect',parent='Cloudveil Sect → Five Peaks' where id='wuxing-peak';
update private.location_catalog set ancestry=array['Yunzhou','Qingluan Mountains','Cloudveil Sect'],access_context='sect',parent='Cloudveil Sect' where id='disciplinary-hall';
create or replace function private.suggest_temporary_characters(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i record;rid uuid;slug text;place text;context text;roles text[];descriptions text[];result jsonb:='[]';names text[]:='{}';nm text;seed int;n int;attempt int;
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
 select access_context into context from private.location_catalog where id=slug;
 if context is null and slug is null then select access_context,id into context,slug from private.location_catalog where name=split_part(place,' · ',1) limit 1;end if;
 if coalesce(place,'')='' then raise exception 'The host must save the session location first';end if;
 case
 when context='sect' and slug in ('mountain-gate','mountain-path','lower-trail-junction') then
 roles:=array['path-duty disciple','supply-duty disciple','resting disciple'];descriptions:=array['A Cloudveil disciple clearing leaves from the supervised sect path; patient and observant.','A Cloudveil disciple carrying mundane sect supplies along the authorized route; practical and talkative.','A Cloudveil disciple resting after a routine errand on sect grounds; curious but cautious.'];
 when context='wilderness' then
 roles:=array['local hunter','herb gatherer','petty bandit'];descriptions:=array['A mortal hunter following familiar trails for ordinary game; cautious and practical.','A mortal gathering common herbs on a familiar wild trail; patient and observant.','An unimportant mortal roadside bandit looking for easy pickings; nervous, with no exceptional strength or secret influence.'];
 when slug in ('mountain-gate','mountain-path','lower-trail-junction') and context='public' then
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
 when context='sect' then
 roles:=array['sweeping disciple','supply-duty disciple','errand disciple'];descriptions:=array['A junior disciple tidying the permitted area; practical and quietly friendly.','A junior disciple bringing mundane supplies along an authorized route; careful and approachable.','A junior disciple completing a routine errand within permitted sect grounds; curious and in a hurry.'];
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
  if context='sect' and slug not in ('mountain-gate','mountain-path','lower-trail-junction') then descriptions[n]:='A Cloudveil disciple on routine duty. '||descriptions[n];end if;
  names:=array_append(names,nm);result:=result||jsonb_build_array(jsonb_build_object('name',nm,'description',descriptions[n],'goal','','suggested',true));
 end loop;
 update private.scene_invitations set guest_roles=names,guest_role_details=result where id=i.id;
 return result;
end;$$;
-- Discard only unclaimed generated drafts for sect locations; played characters/history are untouched.
update private.scene_invitations v set guest_roles='{}',guest_role_details='[]'
from private.scene_introductions s join private.location_catalog l on l.id=s.location_slug
where v.room_id=s.room_id and v.consumed_at is null and l.access_context='sect'
and exists(select 1 from jsonb_array_elements(v.guest_role_details)x where x->>'suggested'='true');
commit;
