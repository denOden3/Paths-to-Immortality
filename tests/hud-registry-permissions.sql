begin;
create temp table qa_registry(owner_id uuid,monkey_id uuid,player_user uuid,player_id uuid,other_id uuid,room_id uuid,invite text);
insert into qa_registry(owner_id,monkey_id,player_user)
select (select user_id from private.portal_admins limit 1),(select monkey_id from private.monkey_delegations where revoked_at is null limit 1),
(select id from auth.users where is_anonymous and id not in(select monkey_id from private.monkey_delegations) and id not in(select user_id from private.portal_accounts) limit 1);
grant select,update on qa_registry to authenticated;
insert into private.portal_players(owner_id,alias,kind) select player_user,'__QA foreign registry','established' from qa_registry returning id;
update qa_registry set other_id=(select id from private.portal_players where alias='__QA foreign registry');
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) from qa_registry;
set local role authenticated;
do $$declare s record;rid uuid;begin
 select * into s from qa_registry;assert s.owner_id is not null and s.monkey_id is not null and s.player_user is not null;
 perform public.hud_player_registry(null,'__QA Registry');
 rid:=public.create_room('__QA Registry room','Owner');update qa_registry set room_id=rid;
 update qa_registry set invite=public.create_player_invitation(rid,'__QA Registry','[{"name":"Registry PC"}]');
end;$$;
reset role;
update qa_registry set player_id=(select id from private.portal_players where alias='__QA Registry');
select set_config('request.jwt.claims',jsonb_build_object('sub',player_user,'role','authenticated')::text,true) from qa_registry;
set local role authenticated;
do $$declare s record;denied boolean:=false;begin
 select * into s from qa_registry;perform public.portal_redeem(s.invite,array['Registry PC']);
 begin perform public.hud_player_registry();exception when others then denied:=true;end;assert denied,'ordinary player read registry';
 denied:=false;begin perform public.hud_player_registry(s.player_id,'Forged rename');exception when others then denied:=true;end;assert denied,'ordinary player renamed profile';
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',monkey_id,'role','authenticated')::text,true) from qa_registry;
set local role authenticated;
do $$declare s record;data jsonb;denied boolean:=false;chars jsonb;cid uuid;rid uuid;tok text;begin
 select * into s from qa_registry;
 data:=public.hud_player_registry();assert data @> '[{"alias":"__QA Registry","in_session":true}]';assert not data @> '[{"alias":"__QA foreign registry"}]';
 data:=public.hud_player_registry(s.player_id,'__QA Renamed');assert data @> jsonb_build_array(jsonb_build_object('id',s.player_id,'alias','__QA Renamed','in_session',true));
 assert (select player_alias='__QA Renamed' from public.room_members where room_id=s.room_id and user_id=s.player_user);
 denied:=false;begin perform public.hud_player_registry(null,'  __qa renamed  ');exception when others then denied:=sqlerrm like '%already registered%';end;assert denied,'duplicate registration did not warn';
 denied:=false;begin perform public.hud_player_registry(s.other_id,'Foreign rename');exception when others then denied:=true;end;assert denied,'foreign record renamed';
 denied:=false;begin perform public.hud_player_registry(null,' ');exception when others then denied:=true;end;assert denied,'empty name accepted';
 perform public.hud_player_registry(null,'__QA Collision');denied:=false;
 begin perform public.hud_player_registry(s.player_id,'__QA Collision');exception when others then denied:=true;end;assert denied,'duplicate rename accepted';
 chars:=public.hud_player_characters(s.player_id);assert chars @> '[{"name":"Registry PC"}]','played character not tracked';
 cid:=(chars->0->>'id')::uuid;perform public.hud_player_characters(s.player_id,'remove',cid);
 chars:=public.hud_player_characters(s.player_id,'save',null,'__QA Extra','Original description','Study');
 cid:=(chars->0->>'id')::uuid;chars:=public.hud_player_characters(s.player_id,'save',cid,'__QA Extra Renamed','Edited description','Learn');
 assert chars @> '[{"name":"__QA Extra Renamed","description":"Edited description","goal":"Learn"}]';
 denied:=false;begin perform public.hud_player_characters(s.player_id,'save',null,'__qa extra renamed');exception when others then denied:=true;end;assert denied,'duplicate character accepted';
 denied:=false;begin perform public.hud_player_characters(s.other_id);exception when others then denied:=true;end;assert denied,'foreign character access';
 rid:=public.create_room_as_owner('__QA Character choices','Owner');
 tok:=public.create_player_invitation(rid,'__QA Renamed','[{"name":"Explicit option"}]');update qa_registry set invite=tok;
 data:=public.preview_scene_invitation(tok);assert data->'previous_characters' @> '[{"name":"__QA Extra Renamed"}]','manually added character not offered';
 assert not data->'previous_characters' @> '[{"name":"Registry PC"}]','removed character still offered';

end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',player_user,'role','authenticated')::text,true) from qa_registry;
set local role authenticated;
do $$declare s record;denied boolean:=false;begin
 select * into s from qa_registry;
 begin perform public.hud_player_characters(s.player_id);exception when others then denied:=true;end;assert denied,'player read privileged character list';
 denied:=false;begin perform public.portal_redeem(s.invite,array['Registry PC']);exception when others then denied:=true;end;assert denied,'removed character redeemed from history';
 perform public.portal_redeem(s.invite,array['__QA Extra Renamed']);assert jsonb_array_length(public.portal_character_log())=2,'history lost after editing saved list';
end;$$;
reset role;
do $$begin
 assert (select count(*)=1 from private.portal_players where alias='__QA Renamed');
 assert (select count(*)=2 from private.character_appearances where player_id=(select player_id from qa_registry));
end;$$;
update private.monkey_delegations set revoked_at=now() where monkey_id=(select monkey_id from qa_registry);
select set_config('request.jwt.claims',jsonb_build_object('sub',monkey_id,'role','authenticated')::text,true) from qa_registry;
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin perform public.hud_player_registry();exception when others then denied:=true;end;assert denied,'revoked HUD retained registry access';denied:=false;begin perform public.hud_player_characters((select player_id from qa_registry));exception when others then denied:=true;end;assert denied,'revoked HUD character access';
end;$$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$declare denied boolean:=false;begin
 begin perform public.hud_player_registry();exception when others then denied:=true;end;assert denied,'anonymous registry access';
end;$$;
reset role;
select 'PASS: owner/paired registry management, rename preserves identity/history/membership, foreign/player/anon/revoked denial, validation and duplicate handling' as result;
rollback;
