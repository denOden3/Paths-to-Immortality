begin;
select set_config('paths.voice_room',r.id::text,true),set_config('paths.voice_owner',r.owner_id::text,true),set_config('paths.voice_guest',(select user_id::text from public.room_members where room_id=r.id and role<>'owner' limit 1),true) from public.rooms r where session_state='active' and exists(select 1 from public.room_members where room_id=r.id and role<>'owner') limit 1;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('paths.voice_owner'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('paths.voice_a',(public.voice_exchange(current_setting('paths.voice_room')::uuid,'join')->>'peer'),true);
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('paths.voice_guest'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('paths.voice_b',(public.voice_exchange(current_setting('paths.voice_room')::uuid,'join')->>'peer'),true);
do $$declare denied boolean:=false;r uuid:=current_setting('paths.voice_room')::uuid;a uuid:=current_setting('paths.voice_a')::uuid;b uuid:=current_setting('paths.voice_b')::uuid;begin
 begin perform public.voice_exchange(r,'signal',a,b,'{"type":"offer","sdp":"test"}');exception when others then denied:=true;end;
 if not denied then raise exception 'Forged sender accepted';end if;
 if jsonb_array_length(public.voice_exchange(r,'poll',b)->'peers')<1 then raise exception 'Member cannot discover peers';end if;
 perform public.voice_exchange(r,'signal',b,a,'{"type":"offer","sdp":"rollback-only"}');
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('paths.voice_owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare r uuid:=current_setting('paths.voice_room')::uuid;a uuid:=current_setting('paths.voice_a')::uuid;begin
 if jsonb_array_length(public.voice_exchange(r,'poll',a)->'signals')<>1 then raise exception 'Signal not delivered';end if;
 if jsonb_array_length(public.voice_exchange(r,'poll',a)->'signals')<>0 then raise exception 'Signal replayed';end if;
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin perform public.voice_exchange(current_setting('paths.voice_room')::uuid,'join');exception when others then denied:=true;end;
 if not denied then raise exception 'Nonmember joined voice';end if;
end;$$;
reset role;
update private.voice_peers set seen_at=now()-interval '61 seconds' where id=current_setting('paths.voice_b')::uuid;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('paths.voice_owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin if (public.voice_exchange(current_setting('paths.voice_room')::uuid,'poll',current_setting('paths.voice_a')::uuid)->'peers')::text like '%'||current_setting('paths.voice_b')||'%' then raise exception 'Expired peer returned';end if;end;$$;
select public.voice_exchange(current_setting('paths.voice_room')::uuid,'leave',current_setting('paths.voice_a')::uuid);
rollback;
