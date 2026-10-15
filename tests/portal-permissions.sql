-- Integration checks run against the real schema, entirely rolled back.
begin;
create temp table qa_state(owner_id uuid,a uuid,b uuid,c uuid,r1 uuid,r2 uuid,r3 uuid,assigned text,guest text,repeat_guest text);
insert into qa_state(owner_id,a,b,c) select (select user_id from private.portal_admins limit 1),ids[1],ids[2],ids[3] from (select array_agg(id order by id) ids from auth.users where is_anonymous and id not in(select monkey_id from private.monkey_delegations))u;
grant select,update on qa_state to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;v uuid;begin
 select * into s from qa_state;
 assert (public.portal_context()->>'is_admin')::boolean,'owner not recognized';
 perform public.portal_manage_player('__QA Established','established');perform public.portal_manage_player('__QA Temporary','temporary');
 v:=public.create_room('__QA Portal scene','QA Owner');update qa_state set r1=v;
 assert public.set_scene_introduction_as_owner(v,'Early Spring, 2nd','Courtyard','The mist rises.');
 update qa_state set assigned=public.create_detailed_scene_invitation_as_owner(v,'__QA Established','assigned',array['QA One','QA Two'],'[]');
 update qa_state set guest=public.create_detailed_scene_invitation_as_owner(v,'__QA Temporary','guest',array['QA Applicant'],'[{"name":"QA Applicant","description":"A hopeful recruit","goal":"Complete the trial"}]');
 update public.portal_presentation set settings='{"startTitle":"QA"}' where id;
 assert found,'owner settings update denied';
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;v uuid;denied boolean;begin
 select * into s from qa_state;
 assert not (public.portal_context()->>'is_admin')::boolean,'player became admin';
 denied:=false;begin perform public.portal_manage_player();exception when others then denied:=true;end;assert denied,'player registry leaked';
 denied:=false;begin perform public.create_room('intrusion','intruder');exception when others then denied:=true;end;assert denied,'player created room';
 update public.portal_presentation set settings='{}' where id;assert not found,'player edited presentation';
 denied:=false;begin perform 1 from private.portal_players;exception when insufficient_privilege then denied:=true;end;assert denied,'private table readable';
 assert public.preview_scene_invitation(s.assigned)->>'player_alias'='__QA Established';
 denied:=false;begin perform public.portal_redeem(s.assigned,array['Intruder']);exception when others then denied:=true;end;assert denied,'unassigned name accepted';
 v:=public.portal_redeem(s.assigned,array['QA One','QA Two']);assert v=s.r1;
 assert jsonb_array_length(public.portal_character_log())=2,'multi character log missing';
 assert public.portal_context()->>'kind'='established','return identity missing';
 denied:=false;begin perform public.portal_redeem(s.assigned,array['QA One']);exception when others then denied:=true;end;assert denied,'one-use token reused';
 denied:=false;begin perform public.preview_scene_invitation(s.guest);exception when others then denied:=true;end;assert denied,'other player invitation accepted by bound account';
 perform public.post_scene_message(s.r1,'A test action','player','QA Two',gen_random_uuid());
 denied:=false;begin perform public.post_scene_message(s.r1,'Intrusion','player','QA Applicant',gen_random_uuid());exception when others then denied:=true;end;assert denied,'forged speaker accepted';
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;v uuid;denied boolean;begin
 select * into s from qa_state;assert jsonb_array_length(public.portal_character_log())=0,'another player history leaked';
 assert public.preview_scene_invitation(s.guest)->>'player_kind'='temporary';
 denied:=false;begin perform public.portal_redeem(s.guest,array['QA Applicant','QA Other']);exception when others then denied:=true;end;assert denied,'temporary multiple accepted';
 denied:=false;begin perform public.redeem_scene_invitation(s.guest,'QA Applicant','Invented name');exception when others then denied:=true;end;assert denied,'legacy free form bypass';
 v:=public.portal_redeem(s.guest,array['QA Applicant']);assert v=s.r1;
 assert jsonb_array_length(public.portal_character_log())=1,'temporary history missing';
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare v uuid;begin
 v:=public.create_room('__QA Return scene','QA Owner');update qa_state set r2=v;
 update qa_state set repeat_guest=public.create_detailed_scene_invitation_as_owner(v,'__QA Temporary','guest',array['QA New Applicant'],'[{"name":"QA New Applicant","description":"Another recruit","goal":"Learn"}]');
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;v jsonb;begin
 select * into s from qa_state;v:=public.preview_scene_invitation(s.repeat_guest);
 assert v->'previous_characters' @> '[{"name":"QA Applicant"}]'::jsonb,'previous character unavailable';
 perform public.portal_redeem(s.repeat_guest,array['QA Applicant']);
 assert jsonb_array_length(public.portal_character_log())=2,'related scene not recorded';
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$begin
 assert jsonb_array_length(public.portal_character_log())=0,'cross player log access';
 assert (select count(*)=0 from public.rooms),'cross player room access';
end;$$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$declare denied boolean;begin
 denied:=false;begin perform public.portal_manage_player();exception when insufficient_privilege then denied:=true;end;assert denied,'unsigned registry access';
 assert public.preview_scene_invitation('invalid') is null;
 assert (select count(*)=1 from public.portal_presentation),'public presentation unavailable';
end;$$;
reset role;
select 'PASS: owner, player and anonymous permissions; multi-character and single-character selection; one-use codes; forged speakers; repeat character; private scene/history isolation' as result;
rollback;
