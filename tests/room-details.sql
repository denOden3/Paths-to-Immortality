begin;
create temp table qa_details(owner_id uuid,monkey_id uuid,r uuid);
insert into qa_details(owner_id,monkey_id) select owner_id,monkey_id from private.monkey_delegations where revoked_at is null and owner_id in(select user_id from private.portal_admins) limit 1;
grant select,update on qa_details to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',monkey_id,'role','authenticated')::text,true) from qa_details;
set local role authenticated;
do $$declare q record;data jsonb;denied boolean:=false;begin
 select * into q from qa_details;assert q.monkey_id is not null;
 data:=public.create_prepared_room(gen_random_uuid(),'__QA Room details','Owner','Year 312 · Early Spring, 2nd','Before dawn','dining-hall','','','A letter arrives.','',array[]::uuid[]);
 update qa_details set r=(data->>'id')::uuid;select * into q from qa_details;
 assert public.save_room_details(q.r,'__QA Renamed room','Year 313 · End Winter, 12th','Third watch','dining-hall','','','Snow falls.','');
 assert (select title='__QA Renamed room' from public.rooms where id=q.r);
 data:=public.get_scene_introduction_as_owner(q.r);assert data->>'time_of_day'='Third watch';assert data->>'scene_date'='Year 313 · End Winter, 12th';
 begin perform public.save_room_details(q.r,'Should roll back','Day','Morning','bad-location','','','Invalid','');exception when others then denied:=true;end;assert denied;
 assert (select title='__QA Renamed room' from public.rooms where id=q.r),'failed details renamed room';
 denied:=false;begin perform public.save_room_details(q.r,'','Day','','dining-hall','','','Invalid','');exception when others then denied:=true;end;assert denied;
 denied:=false;begin perform public.save_room_details(q.r,'Bad time','Day',repeat('x',91),'dining-hall','','','Invalid','');exception when others then denied:=true;end;assert denied;
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin perform public.save_room_details((select r from qa_details),'Unauthorized','Day','','dining-hall','','','Invalid','');exception when others then denied:=true;end;assert denied,'unpaired edit';
end;$$;
reset role;
set local role anon;
do $$declare denied boolean:=false;begin
 begin perform public.save_room_details(gen_random_uuid(),'Anonymous','Day','','dining-hall','','','Invalid','');exception when others then denied:=true;end;assert denied,'anon edit';
end;$$;
reset role;
select 'PASS: atomic rename and setup, custom time creation and editing, field limits, unpaired and anon denial' as result;
rollback;
