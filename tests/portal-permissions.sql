-- v0.7 integration checks; all fixtures are rolled back.
begin;
create temp table qa_state(owner_id uuid,monkey_id uuid,a uuid,b uuid,r uuid,inv_a text,inv_b text,pending_a text,new_a text,generation uuid);
insert into qa_state(owner_id,monkey_id,a,b) select (select user_id from private.portal_admins limit 1),(select monkey_id from private.monkey_delegations where revoked_at is null limit 1),ids[1],ids[2] from(select array_agg(id order by id)ids from auth.users where is_anonymous and id not in(select monkey_id from private.monkey_delegations))u;
grant select,update on qa_state to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare rid uuid;begin
 assert (public.portal_context()->>'is_admin')::boolean;
 rid:=public.create_room('__QA Unified room','QA Owner');update qa_state set r=rid;
 perform public.set_scene_introduction_as_owner(rid,'Early Spring, 2nd','Courtyard','A new trial begins.');
 update qa_state set inv_a=public.create_player_invitation(rid,'__QA A','[{"name":"QA A1","description":"A quiet disciple","goal":"Study"},{"name":"QA A2"}]');
 update qa_state set inv_b=public.create_player_invitation(rid,'__QA B','[{"name":"QA B1"},{"name":"QA B2"}]');
 update qa_state set pending_a=public.create_player_invitation(rid,'__QA A','[{"name":"QA A3"}]');
 update public.portal_presentation set settings='{"playerTitle":"QA {player}"}' where id;assert found;
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;v jsonb;denied boolean;begin
 select * into s from qa_state;v:=public.preview_scene_invitation(s.inv_a);assert v->>'player_alias'='__QA A';assert not(v?'player_kind');
 assert public.preview_scene_invitation('invalid') is null;
 denied:=false;begin perform public.control_session(s.r,'reset');exception when others then denied:=true;end;assert denied,'player reset session';
 denied:=false;begin perform public.portal_manage_player();exception when others then denied:=true;end;assert denied,'registry leaked';
 update public.portal_presentation set settings='{}' where id;assert not found,'player changed website';
 denied:=false;begin perform public.portal_redeem(s.inv_a,array['Forged character']);exception when others then denied:=true;end;assert denied,'unapproved character joined';
 perform public.portal_redeem(s.inv_a,array['QA A1','QA A2']);
 assert public.preview_scene_invitation(s.inv_a) is null,'used code previews';
 assert public.preview_scene_invitation(s.inv_b) is null,'another profile previewed';
 assert jsonb_array_length(public.portal_character_log())=2;
 perform public.post_scene_message(s.r,'A speaks','player','QA A2',gen_random_uuid());
 assert (select count(*)=1 from public.rooms where id=s.r),'ongoing room unavailable';
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;begin
 select * into s from qa_state;assert jsonb_array_length(public.portal_character_log())=0;
 perform public.portal_redeem(s.inv_b,array['QA B1','QA B2']); -- Same multi-select rule for every player.
 perform public.post_scene_message(s.r,'B speaks','player','QA B1',gen_random_uuid());
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',monkey_id,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;begin select * into s from qa_state;assert public.control_session(s.r,'kick',s.a);end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;denied boolean;begin
 select * into s from qa_state;assert (select count(*)=0 from public.rooms where id=s.r),'kicked user reads room';
 assert (select count(*)=0 from public.messages where room_id=s.r),'kicked user reads messages';
 assert public.preview_scene_invitation(s.pending_a) is null,'kicked player pending invitation survives';
 denied:=false;begin perform public.post_scene_message(s.r,'intrusion','player','QA A1',gen_random_uuid());exception when others then denied:=true;end;assert denied,'kicked player posts';
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;begin
 select * into s from qa_state;assert (select count(*)=2 from public.messages where room_id=s.r),'kick erased messages';
 assert public.control_session(s.r,'end');
 assert (select count(*)=2 from public.messages where room_id=s.r),'end erased messages';
 assert (select session_state='ended' from public.rooms where id=s.r);
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;denied boolean;begin
 select * into s from qa_state;assert (select count(*)=0 from public.rooms where id=s.r),'ended room still readable';
 denied:=false;begin perform public.post_scene_message(s.r,'intrusion','player','QA B1',gen_random_uuid());exception when others then denied:=true;end;assert denied;
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;denied boolean;begin
 select * into s from qa_state;
 denied:=false;begin perform public.create_player_invitation(s.r,'__QA A','[{"name":"QA A1"}]');exception when others then denied:=true;end;assert denied,'invitation created for ended room';
 denied:=false;begin perform public.post_scene_message(s.r,'owner writes after end','player','QA Owner',gen_random_uuid());exception when others then denied:=true;end;assert denied,'ended room accepts owner posts';
 update qa_state set generation=(select session_generation from public.rooms where id=s.r);
 assert public.control_session(s.r,'reset');
 assert (select session_state='active' and session_generation<>(select generation from qa_state) from public.rooms where id=s.r),'reset generation unchanged';
 assert (select count(*)=0 from public.messages where room_id=s.r),'reset messages remain';
 assert (select count(*)=1 from public.room_members where room_id=s.r),'reset members remain';
 assert public.get_scene_introduction_as_owner(s.r)->>'opening'='','reset introduction remains';
 update qa_state set new_a=public.create_player_invitation(s.r,'__QA A','[{"name":"QA A3","description":"Another disciple"}]');
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true) from qa_state;
set local role authenticated;
do $$declare s record;v jsonb;begin
 select * into s from qa_state;v:=public.preview_scene_invitation(s.new_a);
 assert v->'previous_characters' @> '[{"name":"QA A1","description":"A quiet disciple"}]'::jsonb,'reminder history missing';
 perform public.portal_redeem(s.new_a,array['QA A1','QA A3']);
 assert jsonb_array_length(public.portal_character_log())=4,'new reset scene history missing';
 assert (select count(*)=1 from public.rooms where id=s.r),'new session not accessible';
end;$$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$declare denied boolean;begin
 denied:=false;begin perform public.control_session(gen_random_uuid(),'reset');exception when insufficient_privilege then denied:=true;end;assert denied;
 assert public.preview_scene_invitation(repeat('0',48)) is null;
 assert (select count(*)=1 from public.portal_presentation);
end;$$;
reset role;
select 'PASS: unified multi-character entry, invitation privacy/expiry/one-use, owner-only moderation, kicked/ended room read/write denial, ended transcript retained, reset clears chat/introduction/members and rotates generation, new-code re-entry and character reminders' as result;
rollback;
