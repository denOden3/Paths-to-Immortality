begin;
select set_config('paths.room',r.id::text,true),set_config('paths.owner',r.owner_id::text,true),set_config('paths.guest',(select user_id::text from public.room_members where room_id=r.id and role<>'owner' limit 1),true) from public.rooms r where session_state='active' and exists(select 1 from public.room_members where room_id=r.id and role<>'owner') limit 1;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('paths.guest'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare r uuid:=current_setting('paths.room')::uuid;name text;denied boolean:=false;begin
 select character_name into name from public.room_members where room_id=r and user_id=auth.uid();
 perform public.set_room_typing(r,true,name);
 if jsonb_array_length(public.room_activity_status(r)->'typing')<>0 then raise exception 'Own typing echoed';end if;
 begin perform public.set_room_typing(r,true,'Not my character');exception when others then denied:=true;end;
 if not denied then raise exception 'Spoofed character accepted';end if;
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('paths.owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin if jsonb_array_length(public.room_activity_status(current_setting('paths.room')::uuid)->'typing')=0 then raise exception 'Guest typing not visible to owner';end if;end;$$;
reset role;
update private.room_typing set expires_at=now()-interval '1 second' where room_id=current_setting('paths.room')::uuid;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('paths.owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin if jsonb_array_length(public.room_activity_status(current_setting('paths.room')::uuid)->'typing')<>0 then raise exception 'Expired typing visible';end if;end;$$;
reset role;
-- Give the owner a second participating test character inside this rollback only.
update public.room_members set allowed_characters=array[character_name,'Rollback owner alternate'] where room_id=current_setting('paths.room')::uuid and user_id=current_setting('paths.owner')::uuid;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('paths.owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare r uuid:=current_setting('paths.room')::uuid;mid uuid;client_id uuid:=gen_random_uuid();denied boolean:=false;begin
 perform public.set_room_typing(r,true,'Rollback owner alternate');
 mid:=public.post_character_as_owner(r,'Rollback-only character-switch test.','player',client_id,'Rollback owner alternate');
 if not exists(select 1 from public.messages where id=mid and character_name='Rollback owner alternate') then raise exception 'Selected character was not posted';end if;
 if public.post_character_as_owner(r,'Rollback-only character-switch test.','player',client_id,'Rollback owner alternate')<>mid then raise exception 'Retry duplicated';end if;
 begin perform public.post_character_as_owner(r,'Spoof','player',gen_random_uuid(),'Not my character');exception when others then denied:=true;end;
 if not denied then raise exception 'Owner could post an unassigned character';end if;
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin perform public.room_activity_status(current_setting('paths.room')::uuid);exception when others then denied:=true;end;
 if not denied then raise exception 'Nonmember read activity';end if;
end;$$;
rollback;
