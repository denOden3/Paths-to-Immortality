begin;
do $$declare q record;rid uuid;other uuid;action uuid;request jsonb;again jsonb;mid uuid;denied boolean;body text;original text;before_count int;begin
 select d.owner_id,d.monkey_id,(select id from auth.users where is_anonymous and id not in(select monkey_id from private.monkey_delegations) and id not in(select user_id from private.portal_accounts) limit 1) as player_user into q from private.monkey_delegations d where revoked_at is null and owner_id in(select user_id from private.portal_admins) limit 1;
 assert q.monkey_id is not null and q.player_user is not null,'QA identities unavailable';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',q.monkey_id,'role','authenticated')::text,true);
 request:=public.create_prepared_room(gen_random_uuid(),'__QA HUD Bridge','QA Bridge PC','Day','Morning','mountain-path','','','An open path.','Explore',array[]::uuid[]);rid:=(request->>'id')::uuid;
 action:=public.post_character_as_owner(rid,'I inspect the path.','player',gen_random_uuid(),'QA Bridge PC');update public.messages set created_at=clock_timestamp() where id=action;
 request:=public.prepare_hud_narration(rid);assert jsonb_array_length(request->'context'->'actions')=1;assert jsonb_array_length(request->'context'->'characters')=1;assert request->'context'->'introduction'->>'time_of_day'='Morning';
 -- OOC is excluded and must not invalidate a character batch.
 perform public.post_as_owner(rid,'This is OOC only.','ooc',gen_random_uuid());assert private.hud_narration_context(rid)=request->'context';
 body:='A traveller gives you two apples. [PATHS_STATE]{"version":1,"inventory":[{"character":"QA Bridge PC","item":"Apple","delta":2}],"scenes":[{"character":"QA Bridge PC","location":"Mountain Path","description":"An open path."}]}[/PATHS_STATE]';
 mid:=public.publish_hud_narration((request->>'request_id')::uuid,body);
 assert public.publish_hud_narration((request->>'request_id')::uuid,body)=mid,'retry not idempotent';
 assert (public.room_player_panel(rid,'QA Bridge PC')->'inventory'->0->>'quantity')::int=2,'gain was not applied once';
 assert public.narration_state_status(rid) @> jsonb_build_array(jsonb_build_object('message_id',mid,'status','applied')),'exact receipt missing';
 select m.body into original from public.messages m where m.id=mid;
 assert public.edit_hud_message(mid,'A traveller offers two ripe apples.',original);
 assert (select m.body from public.messages m where m.id=mid) like '%[PATHS_STATE]%', 'state record erased';
 assert (public.room_player_panel(rid,'QA Bridge PC')->'inventory'->0->>'quantity')::int=2,'edit replayed state';
 assert (select count(*) from private.inventory_changes where source_message_id=mid)=1,'edit duplicated inventory audit';
 denied:=false;begin perform public.edit_hud_message(mid,'Overwrites another edit',original);exception when others then denied:=true;end;assert denied,'concurrent edit overwritten';
 select m.body into original from public.messages m where m.id=mid;
 denied:=false;begin perform public.edit_hud_message(mid,'Forged [PATHS_STATE]{}[/PATHS_STATE]',original);exception when others then denied:=true;end;assert denied,'state mutation allowed';
 -- Owner can edit an already narrated player action without replaying the narration.
 assert public.edit_hud_message(action,'I inspect the stones.','I inspect the path.');
 action:=public.post_as_owner(rid,'I wait.','player',gen_random_uuid());update public.messages set created_at=clock_timestamp() where id=action;
 request:=public.prepare_hud_narration(rid);assert public.edit_hud_message(action,'I look up.','I wait.');
 denied:=false;begin perform public.publish_hud_narration((request->>'request_id')::uuid,body);exception when others then denied:=true;end;assert denied,'edited action accepted stale reply';
 request:=public.prepare_hud_narration(rid);
 perform public.change_character_inventory(rid,'QA Bridge PC','add',null,'Stone',1,'');
 denied:=false;begin perform public.publish_hud_narration((request->>'request_id')::uuid,body);exception when others then denied:=true;end;assert denied,'inventory change accepted stale reply';
 request:=public.prepare_hud_narration(rid);
 -- Invalid state stays posted with rejected receipt; no partial gain or scene change.
 body:='A test of a bad record. [PATHS_STATE]{"version":1,"inventory":[{"character":"QA Bridge PC","item":"Apple","delta":1},{"character":"QA Bridge PC","item":"Apple","delta":-99}],"scenes":[]}[/PATHS_STATE]';
 mid:=public.publish_hud_narration((request->>'request_id')::uuid,body);
 assert public.narration_state_status(rid) @> jsonb_build_array(jsonb_build_object('message_id',mid,'status','rejected'));
 assert (select quantity from private.character_inventory where name='Apple' and owner_id=q.owner_id and character_key=(select id from private.owner_character_keys where owner_id=q.owner_id and name='QA Bridge PC'))=2;
 action:=public.post_as_owner(rid,'I listen.','player',gen_random_uuid());update public.messages set created_at=clock_timestamp() where id=action;request:=public.prepare_hud_narration(rid);
 -- Unpaired caller cannot use an owner's nonce or edit a narration.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',q.player_user,'role','authenticated')::text,true);
 denied:=false;begin perform public.prepare_hud_narration(rid);exception when others then denied:=true;end;assert denied,'unpaired prepared narration';
 denied:=false;begin perform public.publish_hud_narration((request->>'request_id')::uuid,body);exception when others then denied:=true;end;assert denied,'unpaired published narration';
 select m.body into original from public.messages m where m.id=mid;
 denied:=false;begin perform public.edit_hud_message(mid,'Forged edit',original);exception when others then denied:=true;end;assert denied,'unpaired edited narration';
 perform set_config('request.jwt.claims','{}',true);
 denied:=false;begin perform public.prepare_hud_narration(rid);exception when others then denied:=true;end;assert denied,'null identity prepared narration';
 assert not has_function_privilege('anon','public.publish_hud_narration(uuid,text)','execute');
 assert not has_function_privilege('authenticated','private.hud_narration_context(uuid)','execute');
end;$$;
select 'PASS: owner delegation, frozen context, OOC exclusion, exact receipts, idempotent retry, stale action/inventory rejection, narration text editing without state replay, concurrent edit protection, atomic rejection, unpaired and anonymous denial' as result;
rollback;
