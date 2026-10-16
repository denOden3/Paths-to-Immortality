begin;
create temp table qa_temporary(owner_id uuid,monkey_id uuid,player_user uuid,pid uuid,r uuid,code text,wild_code text,choices jsonb);
insert into qa_temporary(owner_id,monkey_id,player_user) select owner_id,monkey_id,(select id from auth.users where is_anonymous and id not in(select monkey_id from private.monkey_delegations) and id not in(select user_id from private.portal_accounts) limit 1) from private.monkey_delegations where revoked_at is null and owner_id in(select user_id from private.portal_admins) limit 1;
insert into private.location_catalog(id,name,region,parent,source_url,checked_at,ancestry,access_context) values('__qa-wild-path','QA Mountain Path','QA Region','QA Mountain','https://www.notion.so/3f7b0ac52efe81f6bd6efed19f06fc25',current_date,array['QA Region','QA Mountain'],'wilderness');
grant select,update on qa_temporary to authenticated;grant select,update on qa_temporary to anon;
select set_config('request.jwt.claims',jsonb_build_object('sub',monkey_id,'role','authenticated')::text,true) from qa_temporary;
set local role authenticated;
do $$declare p uuid;data jsonb;begin
 perform public.hud_player_registry(null,'__QA Temporary player');select (x->>'id')::uuid into p from jsonb_array_elements(public.hud_player_registry())x where x->>'alias'='__QA Temporary player';
 data:=public.create_prepared_room(gen_random_uuid(),'__QA Temporary scene','Owner','Day','Morning','mountain-path','','','Leaves cover the path.','',array[p]);
 update qa_temporary set pid=p,r=(data->>'id')::uuid,code=data->'invitations'->0->>'code';assert (select player_user is not null from qa_temporary);
 data:=public.create_prepared_room(gen_random_uuid(),'__QA Wild scene','Owner','Day','Morning','__qa-wild-path','','','A wild trail.','',array[p]);update qa_temporary set wild_code=data->'invitations'->0->>'code';
 assert (public.hud_room_setup()->'locations') @> '[{"id":"mountain-path","ancestry":["Yunzhou","Qingluan Mountains","Cloudveil Sect","Mountain Gate"],"access_context":"sect"}]';
end;$$;
reset role;
select set_config('request.jwt.claims','{}',true);set local role anon;
do $$declare data jsonb;begin
 assert public.suggest_temporary_characters('invalid') is null;
 data:=public.suggest_temporary_characters((select code from qa_temporary));assert jsonb_array_length(data)=3;assert data->0->>'name' like '%path-duty disciple';assert data->1->>'name' like '%supply-duty disciple';assert data->2->>'name' like '%resting disciple';
 update qa_temporary set choices=data;
 assert data=public.suggest_temporary_characters((select code from qa_temporary)),'repeated check changed choices';
 data:=public.preview_scene_invitation((select code from qa_temporary));assert jsonb_array_length(data->'previous_characters')=0;assert jsonb_array_length(data->'temporary_characters')=3;assert jsonb_array_length(data->'characters')=0;
 data:=public.suggest_temporary_characters((select wild_code from qa_temporary));assert data->0->>'name' like '%local hunter';assert data->1->>'name' like '%herb gatherer';assert data->2->>'name' like '%petty bandit';assert data->0->>'description' like '%mortal hunter%';assert data::text not like '%Cloudveil%';
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',player_user,'role','authenticated')::text,true) from qa_temporary;set local role authenticated;
do $$declare q record;denied boolean:=false;rid uuid;begin
 select * into q from qa_temporary;
 begin perform public.portal_redeem(q.code,array['Invented powerful elder']);exception when others then denied:=true;end;assert denied,'forged role accepted';
 denied:=false;begin perform public.portal_redeem(q.code,array[q.choices->0->>'name',q.choices->1->>'name']);exception when others then denied:=true;end;assert denied,'two temporary characters accepted';
 rid:=public.portal_redeem(q.code,array[q.choices->0->>'name']);assert rid=q.r;
 assert public.suggest_temporary_characters(q.code) is null,'used invitation remained available';
end;$$;
reset role;
do $$declare q record;begin
 select * into q from qa_temporary;
 assert exists(select 1 from private.character_appearances where player_id=q.pid and character_kind='temporary' and description='A Cloudveil disciple clearing leaves from the supervised sect path; patient and observant.');
 assert not exists(select 1 from private.player_characters where player_id=q.pid),'temporary character became established';
 assert exists(select 1 from public.room_members where room_id=q.r and user_id=q.player_user and allowed_characters=array[q.choices->0->>'name']);
end;$$;
select 'PASS: no-character invitations, three location roles, stable suggestions, valid preview, forged/multiple role denial, temporary redemption/history without promotion, consumed-code rejection' as result;
rollback;
