begin;
select set_config('paths.test_room',r.id::text,true),set_config('paths.test_owner',r.owner_id::text,true),set_config('paths.test_player',(select user_id::text from public.room_members where room_id=r.id and role<>'owner' limit 1),true) from public.rooms r where session_state='active' and exists(select 1 from public.room_members where room_id=r.id and role<>'owner') limit 1;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('paths.test_owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare r uuid:=current_setting('paths.test_room')::uuid;begin
 if public.set_narration_activity(r,true) is not true or public.narration_activity_status(r) is not true then raise exception 'Owner start failed';end if;
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('paths.test_player'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare r uuid:=current_setting('paths.test_room')::uuid;denied boolean:=false;begin
 if public.narration_activity_status(r) is not true then raise exception 'Player cannot see progress';end if;
 begin perform public.set_narration_activity(r,false);exception when others then denied:=true;end;
 if not denied then raise exception 'Player changed owner indicator';end if;
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('paths.test_owner'),'role','authenticated')::text,true);
set local role authenticated;
-- Trigger unit check as database administrator, rolled back; public message writes remain RLS-protected.
reset role;
insert into public.messages(room_id,sender_id,kind,body) values(current_setting('paths.test_room')::uuid,null,'narrator','Rollback-only progress indicator verification.');
set local role authenticated;
do $$begin if public.narration_activity_status(current_setting('paths.test_room')::uuid) then raise exception 'Published narration did not clear indicator';end if;end;$$;
select public.set_narration_activity(current_setting('paths.test_room')::uuid,true);
reset role;
update private.narration_activity set expires_at=now()-interval '1 second' where room_id=current_setting('paths.test_room')::uuid;
set local role authenticated;
do $$begin if public.narration_activity_status(current_setting('paths.test_room')::uuid) then raise exception 'Expired indicator remains active';end if;end;$$;
select public.set_narration_activity(current_setting('paths.test_room')::uuid,false);
rollback;
