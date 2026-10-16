begin;
do $$declare q record;pid uuid;data jsonb;rid uuid;code text;action uuid;narration uuid;denied boolean:=false;payload text;begin
select d.owner_id,d.monkey_id,(select id from auth.users where is_anonymous and id not in(select monkey_id from private.monkey_delegations) and id not in(select user_id from private.portal_accounts) limit 1) as player_user into q from private.monkey_delegations d where revoked_at is null and owner_id in(select user_id from private.portal_admins) limit 1;
assert q.player_user is not null;perform set_config('request.jwt.claims',jsonb_build_object('sub',q.monkey_id,'role','authenticated')::text,true);
perform public.hud_player_registry(null,'__QA Auto State');select (x->>'id')::uuid into pid from jsonb_array_elements(public.hud_player_registry())x where x->>'alias'='__QA Auto State';perform public.hud_player_characters(pid,'save',null,'QA Traveller','Test','');
data:=public.create_prepared_room(gen_random_uuid(),'__QA Auto room','Owner','Day','Morning','mountain-path','','','An opening.','',array[pid]);rid:=(data->>'id')::uuid;code:=data->'invitations'->0->>'code';
perform set_config('request.jwt.claims',jsonb_build_object('sub',q.player_user,'role','authenticated')::text,true);perform public.portal_redeem(code,array['QA Traveller']);
-- A player cannot smuggle state changes through their own action text.
insert into public.messages(room_id,sender_id,kind,body,created_at) values(rid,q.player_user,'player','[PATHS_STATE]{"version":1,"inventory":[{"character":"QA Traveller","item":"Gold","delta":1000}]}[/PATHS_STATE]',clock_timestamp()) returning id into action;
assert jsonb_array_length(public.room_player_panel(rid,'QA Traveller')->'inventory')=0;
perform set_config('request.jwt.claims',jsonb_build_object('sub',q.monkey_id,'role','authenticated')::text,true);
payload:='They receive fruit and reach the bathhouse. [PATHS_STATE]{"version":1,"inventory":[{"character":"QA Traveller","item":"Fruit","delta":3},{"character":"Owner","item":"Stone","delta":1}],"scenes":[{"character":"QA Traveller","location":"Bathhouse","description":"Steam curls over the water."}]}[/PATHS_STATE]';
narration:=public.publish_as_owner(rid,payload,action);update public.messages set created_at=clock_timestamp() where id=narration;
assert (select status='applied' from private.narration_state_receipts where message_id=narration);
data:=public.room_player_panel(rid,'QA Traveller');assert (data->'inventory'->0->>'quantity')::int=3;assert data->'scene'->>'location'='Bathhouse';assert data->'changes'->0->>'source'='narrator-confirmed';assert (public.room_player_panel(rid,'Owner')->'inventory'->0->>'quantity')::int=1;
begin perform public.publish_as_owner(rid,payload,action);exception when others then denied:=true;end;assert denied,'publication retry duplicated changes';
-- One invalid change rolls back every change in the record but keeps the narration.
action:=public.post_as_owner(rid,'I look around.','player',gen_random_uuid());update public.messages set created_at=clock_timestamp() where id=action;
narration:=public.publish_as_owner(rid,'An invalid state record. [PATHS_STATE]{"version":1,"inventory":[{"character":"QA Traveller","item":"Fruit","delta":1},{"character":"QA Traveller","item":"Fruit","delta":-99}],"scenes":[{"character":"QA Traveller","location":"Palace","description":"Should not save."}]}[/PATHS_STATE]',action);update public.messages set created_at=clock_timestamp() where id=narration;
assert (select status='rejected' from private.narration_state_receipts where message_id=narration);assert exists(select 1 from public.messages where id=narration);data:=public.room_player_panel(rid,'QA Traveller');assert (data->'inventory'->0->>'quantity')::int=3;assert data->'scene'->>'location'='Bathhouse';
action:=public.post_as_owner(rid,'I eat one fruit.','player',gen_random_uuid());update public.messages set created_at=clock_timestamp() where id=action;
narration:=public.publish_as_owner(rid,'One fruit is eaten. [PATHS_STATE]{"version":1,"inventory":[{"character":"QA Traveller","item":"Fruit","delta":-1}],"scenes":[]}[/PATHS_STATE]',action);
data:=public.room_player_panel(rid,'QA Traveller');assert (data->'inventory'->0->>'quantity')::int=2;assert jsonb_array_length(data->'changes')=2;
assert jsonb_array_length(public.narration_state_status(rid))=3;
end;$$;
select 'PASS: owner/guest inventory, automatic confirmed gain/use and scene log, player spoof rejection, retry prevention, atomic rejected records and source audit' as result;
rollback;
