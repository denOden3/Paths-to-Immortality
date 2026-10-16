begin;
create temp table qa_notion(owner_id uuid,monkey_id uuid,player_id uuid,character_id uuid);
insert into qa_notion(owner_id,monkey_id) select owner_id,monkey_id from private.monkey_delegations where revoked_at is null and owner_id in(select user_id from private.portal_admins) limit 1;
insert into private.portal_players(owner_id,alias,kind) select owner_id,'__QA Notion Import','established' from qa_notion;
update qa_notion set player_id=(select id from private.portal_players where alias='__QA Notion Import');
grant select,update on qa_notion to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',monkey_id,'role','authenticated')::text,true) from qa_notion;
set local role authenticated;
do $$declare q record;data jsonb;denied boolean:=false;begin
 select * into q from qa_notion;assert q.player_id is not null and q.monkey_id is not null;
 data:=public.hud_save_character_source(q.player_id,null,'Imported PC','Edited preview','Learn','https://www.notion.so/3fbb0ac52efe806e9fbeee8ce2b760a9');
 assert data @> '[{"name":"Imported PC","description":"Edited preview","source_url":"https://www.notion.so/3fbb0ac52efe806e9fbeee8ce2b760a9"}]';
 update qa_notion set character_id=(data->0->>'id')::uuid;
 begin perform public.hud_save_character_source(q.player_id,null,'Injected link','','','https://evil.example');exception when others then denied:=true;end;assert denied;
 denied:=false;begin perform public.hud_save_character_source(gen_random_uuid(),null,'Foreign player');exception when others then denied:=true;end;assert denied;
 denied:=false;begin perform public.hud_save_character_source(q.player_id,null,'Imported PC');exception when others then denied:=true;end;assert denied,'duplicate saved';
 data:=public.hud_player_characters(q.player_id,'save',(select character_id from qa_notion),'Renamed PC','Legacy client edit','');
 assert data @> '[{"name":"Renamed PC","source_url":"https://www.notion.so/3fbb0ac52efe806e9fbeee8ce2b760a9"}]','legacy edit erased source';
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin perform public.hud_save_character_source((select player_id from qa_notion),null,'Unauthorized');exception when others then denied:=true;end;assert denied,'unpaired access';
end;$$;
reset role;
set local role anon;
do $$declare denied boolean:=false;begin
 begin perform public.hud_save_character_source(gen_random_uuid(),null,'Anonymous');exception when others then denied:=true;end;assert denied,'anonymous access';
end;$$;
reset role;
select 'PASS: paired source save, edited preview persistence, source validation, duplicate prevention, legacy preservation and unauthorized denial' as result;
rollback;
