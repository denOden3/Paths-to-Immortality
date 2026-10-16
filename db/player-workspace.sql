begin;
create table private.scene_location_log(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),room_id uuid not null references public.rooms(id),generation uuid not null,character_name text not null,location_name text not null check(length(location_name) between 1 and 150),description text not null check(length(description) between 1 and 4000),recorded_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp());
create index scene_location_latest on private.scene_location_log(room_id,generation,character_name,created_at desc);
create table private.character_inventory(id uuid primary key default gen_random_uuid(),player_id uuid not null references private.portal_players(id),character_key uuid not null,name text not null check(length(name) between 1 and 80),quantity int not null check(quantity between 0 and 1000000),note text not null default '' check(length(note)<=350),updated_at timestamptz not null default now());
create unique index inventory_character_item on private.character_inventory(character_key,lower(name));
create table private.inventory_changes(id uuid primary key default gen_random_uuid(),item_id uuid not null references private.character_inventory(id),actor_id uuid not null references auth.users(id),room_id uuid not null references public.rooms(id),quantity_change int not null,source text not null default 'player-reported',created_at timestamptz not null default clock_timestamp());
alter table private.scene_location_log enable row level security;
alter table private.character_inventory enable row level security;
alter table private.inventory_changes enable row level security;
revoke all on private.scene_location_log,private.character_inventory,private.inventory_changes from public,anon,authenticated;
create function private.workspace_identity(p_room uuid,p_character text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m record;pid uuid;ck uuid;gen uuid;begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select session_generation into gen from public.rooms where id=p_room and session_state='active';
 if not found then raise exception 'Session unavailable';end if;
 select * into m from public.room_members where room_id=p_room and user_id=auth.uid();
 if p_character is null or not found or not(p_character=any(case when cardinality(m.allowed_characters)>0 then m.allowed_characters else array[m.character_name] end)) then raise exception 'Character access required';end if;
 select player_id into pid from private.portal_accounts where user_id=auth.uid();
 if pid is not null then
 select id into ck from private.player_characters where player_id=pid and (name=p_character or p_character=any(history_names)) order by (name=p_character) desc limit 1;
 if ck is null then select id into ck from private.character_appearances where player_id=pid and scene_key=gen and character_name=p_character limit 1;end if;
 end if;
 return jsonb_build_object('player_id',pid,'character_key',ck,'generation',gen);
end;$$;
create function private.room_player_panel(p_room uuid,p_character text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare identity jsonb;info jsonb;scene jsonb;items jsonb;changes jsonb;begin
 identity:=private.workspace_identity(p_room,p_character);
 select jsonb_build_object('title',r.title,'status',r.session_state,'date',coalesce(s.scene_date,''),'time',coalesce(s.time_of_day,''),'starting_location',coalesce(s.location_name,''),'opening',coalesce(s.opening_text,''),'goals',coalesce(s.session_goals,'')) into info from public.rooms r left join private.scene_introductions s on s.room_id=r.id where r.id=p_room;
 select jsonb_build_object('location',location_name,'description',description,'recorded_at',created_at) into scene from private.scene_location_log where room_id=p_room and generation=(identity->>'generation')::uuid and character_name=p_character order by created_at desc,id desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'quantity',quantity,'note',note) order by lower(name)),'[]') into items from private.character_inventory where character_key=(identity->>'character_key')::uuid and quantity>0;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into changes from (select i.name,c.quantity_change,c.source,c.created_at from private.inventory_changes c join private.character_inventory i on i.id=c.item_id where i.character_key=(identity->>'character_key')::uuid order by c.created_at desc limit 20)x;
 return jsonb_build_object('session',info,'scene',scene,'inventory',items,'changes',changes,'can_edit_inventory',identity->>'character_key' is not null);
end;$$;
create function public.room_player_panel(p_room uuid,p_character text) returns jsonb language sql security invoker set search_path='' as $$select private.room_player_panel(p_room,p_character);$$;
create function private.change_character_inventory(p_room uuid,p_character text,p_action text,p_item uuid default null,p_name text default '',p_quantity int default 1,p_note text default '') returns boolean language plpgsql security definer set search_path='' as $$
declare identity jsonb;ck uuid;pid uuid;i record;delta int;begin
 -- Same room-first lock order as end/reset/kick.
 perform 1 from public.rooms where id=p_room and session_state='active' for update;
 identity:=private.workspace_identity(p_room,p_character);ck:=(identity->>'character_key')::uuid;pid:=(identity->>'player_id')::uuid;
 if ck is null or pid is null then raise exception 'Registered player character required';end if;
 if p_quantity is null or p_quantity not between 1 and 1000000 then raise exception 'Enter a quantity from 1 to 1000000';end if;
 if p_action='add' then
 if length(btrim(coalesce(p_name,''))) not between 1 and 80 or p_note is null or length(p_note)>350 then raise exception 'Check item name and note';end if;
 insert into private.character_inventory(player_id,character_key,name,quantity,note) values(pid,ck,btrim(p_name),p_quantity,btrim(p_note))
 on conflict(character_key,lower(name)) do update set quantity=private.character_inventory.quantity+excluded.quantity,note=case when excluded.note<>'' then excluded.note else private.character_inventory.note end,updated_at=now() returning * into i;delta:=p_quantity;
 elsif p_action='remove' then
 select * into i from private.character_inventory where id=p_item and character_key=ck for update;
 if not found or i.quantity<p_quantity then raise exception 'Item or quantity unavailable';end if;
 update private.character_inventory set quantity=quantity-p_quantity,updated_at=now() where id=i.id;delta:=-p_quantity;
 else raise exception 'Unknown inventory action';end if;
 insert into private.inventory_changes(item_id,actor_id,room_id,quantity_change) values(i.id,auth.uid(),p_room,delta);
 return true;
end;$$;
create function public.change_character_inventory(p_room uuid,p_character text,p_action text,p_item uuid default null,p_name text default '',p_quantity int default 1,p_note text default '') returns boolean language sql security invoker set search_path='' as $$select private.change_character_inventory(p_room,p_character,p_action,p_item,p_name,p_quantity,p_note);$$;
create function private.record_character_scene(p_room uuid,p_character text,p_location text,p_description text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();gen uuid;begin
 if v_owner is null then raise exception 'Owner authorization required';end if;
 select session_generation into gen from public.rooms r where r.id=p_room and r.owner_id=v_owner and session_state='active' for update;
 if not found then raise exception 'Ongoing owner room required';end if;
 if not exists(select 1 from public.room_members m where m.room_id=p_room and p_character=any(case when cardinality(m.allowed_characters)>0 then m.allowed_characters else array[m.character_name] end)) then raise exception 'Participating character required';end if;
 insert into private.scene_location_log(owner_id,room_id,generation,character_name,location_name,description,recorded_by) values(v_owner,p_room,gen,p_character,btrim(p_location),btrim(p_description),auth.uid());return true;
end;$$;
create function public.record_character_scene(p_room uuid,p_character text,p_location text,p_description text) returns boolean language sql security invoker set search_path='' as $$select private.record_character_scene(p_room,p_character,p_location,p_description);$$;
create function private.hud_location_ideas() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_owner uuid:=private.monkey_owner();begin
 if v_owner is null then raise exception 'Owner authorization required';end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from (select l.character_name,l.location_name,l.description,l.created_at,r.title from private.scene_location_log l join public.rooms r on r.id=l.room_id where l.owner_id=v_owner order by l.created_at desc limit 50)x),'[]');end;$$;
create function public.hud_location_ideas() returns jsonb language sql security invoker set search_path='' as $$select private.hud_location_ideas();$$;
revoke all on function private.workspace_identity(uuid,text) from public,anon,authenticated;
revoke all on function private.room_player_panel(uuid,text),public.room_player_panel(uuid,text),private.change_character_inventory(uuid,text,text,uuid,text,int,text),public.change_character_inventory(uuid,text,text,uuid,text,int,text),private.record_character_scene(uuid,text,text,text),public.record_character_scene(uuid,text,text,text),private.hud_location_ideas(),public.hud_location_ideas() from public,anon,authenticated;
grant execute on function private.room_player_panel(uuid,text),public.room_player_panel(uuid,text),private.change_character_inventory(uuid,text,text,uuid,text,int,text),public.change_character_inventory(uuid,text,text,uuid,text,int,text),private.record_character_scene(uuid,text,text,text),public.record_character_scene(uuid,text,text,text),private.hud_location_ideas(),public.hud_location_ideas() to authenticated;
commit;
