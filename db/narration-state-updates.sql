begin;
create table private.owner_character_keys(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),name text not null);
create unique index owner_character_key_name on private.owner_character_keys(owner_id,lower(name));
alter table private.owner_character_keys enable row level security;
revoke all on private.owner_character_keys from public,anon,authenticated;
insert into private.owner_character_keys(owner_id,name) select distinct m.user_id,x from public.room_members m cross join lateral unnest(case when cardinality(m.allowed_characters)>0 then m.allowed_characters else array[m.character_name] end)x where m.role='owner' on conflict do nothing;
create function private.remember_owner_character_key() returns trigger language plpgsql security definer set search_path='' as $$begin if new.role='owner' then insert into private.owner_character_keys(owner_id,name) select new.user_id,x from unnest(case when cardinality(new.allowed_characters)>0 then new.allowed_characters else array[new.character_name] end)x on conflict do nothing;end if;return new;end;$$;
revoke all on function private.remember_owner_character_key() from public,anon,authenticated;
create trigger remember_owner_character_key after insert or update on public.room_members for each row execute function private.remember_owner_character_key();
alter table private.character_inventory alter column player_id drop not null;
alter table private.character_inventory add column owner_id uuid references auth.users(id);
update private.character_inventory i set owner_id=p.owner_id from private.portal_players p where p.id=i.player_id;
alter table private.character_inventory alter column owner_id set not null;
alter table private.inventory_changes add column source_message_id uuid;
create table private.narration_state_receipts(message_id uuid primary key,room_id uuid not null,owner_id uuid not null,status text not null,error text not null default '',created_at timestamptz not null default clock_timestamp());
alter table private.narration_state_receipts enable row level security;
revoke all on private.narration_state_receipts from public,anon,authenticated;
create or replace function private.workspace_identity(p_room uuid,p_character text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m record;pid uuid;ck uuid;gen uuid;room_owner uuid;v_owner uuid:=private.monkey_owner();begin
 if auth.uid() is null or p_character is null then raise exception 'Character access required';end if;
 select session_generation,owner_id into gen,room_owner from public.rooms where id=p_room and session_state='active';if not found then raise exception 'Session unavailable';end if;
 select * into m from public.room_members where room_id=p_room and (user_id=auth.uid() or v_owner=room_owner) and p_character=any(case when cardinality(allowed_characters)>0 then allowed_characters else array[character_name] end) limit 1;
 if not found then raise exception 'Character access required';end if;
 select player_id into pid from private.portal_accounts where user_id=m.user_id;
 if m.role='owner' then select id into ck from private.owner_character_keys where owner_id=m.user_id and lower(name)=lower(p_character);
 elsif pid is not null then select id into ck from private.player_characters where player_id=pid and (name=p_character or p_character=any(history_names)) order by (name=p_character) desc limit 1;
 if ck is null then select id into ck from private.character_appearances where player_id=pid and scene_key=gen and character_name=p_character limit 1;end if;end if;
 return jsonb_build_object('player_id',pid,'character_key',ck,'generation',gen,'owner_id',room_owner);
end;$$;
CREATE OR REPLACE FUNCTION private.change_character_inventory(p_room uuid, p_character text, p_action text, p_item uuid DEFAULT NULL::uuid, p_name text DEFAULT ''::text, p_quantity integer DEFAULT 1, p_note text DEFAULT ''::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare identity jsonb;ck uuid;pid uuid;i record;delta int;begin
 -- Same room-first lock order as end/reset/kick.
 perform 1 from public.rooms where id=p_room and session_state='active' for update;
 identity:=private.workspace_identity(p_room,p_character);ck:=(identity->>'character_key')::uuid;pid:=(identity->>'player_id')::uuid;
 if ck is null then raise exception 'Participating character required';end if;
 if p_quantity is null or p_quantity not between 1 and 1000000 then raise exception 'Enter a quantity from 1 to 1000000';end if;
 if p_action='add' then
 if length(btrim(coalesce(p_name,''))) not between 1 and 80 or p_note is null or length(p_note)>350 then raise exception 'Check item name and note';end if;
 insert into private.character_inventory(player_id,character_key,owner_id,name,quantity,note) values(pid,ck,(identity->>'owner_id')::uuid,btrim(p_name),p_quantity,btrim(p_note))
 on conflict(character_key,lower(name)) do update set quantity=private.character_inventory.quantity+excluded.quantity,note=case when excluded.note<>'' then excluded.note else private.character_inventory.note end,updated_at=now() returning * into i;delta:=p_quantity;
 elsif p_action='remove' then
 select * into i from private.character_inventory where id=p_item and character_key=ck for update;
 if not found or i.quantity<p_quantity then raise exception 'Item or quantity unavailable';end if;
 update private.character_inventory set quantity=quantity-p_quantity,updated_at=now() where id=i.id;delta:=-p_quantity;
 else raise exception 'Unknown inventory action';end if;
 insert into private.inventory_changes(item_id,actor_id,room_id,quantity_change) values(i.id,auth.uid(),p_room,delta);
 return true;
end;$function$;
create function private.apply_published_narration_state() returns trigger language plpgsql security definer set search_path='' as $$
declare payload jsonb;block text;change jsonb;identity jsonb;ck uuid;item uuid;delta int;v_owner uuid;failure text;begin
 if new.kind<>'narrator' or position('[PATHS_STATE]' in new.body)=0 then return new;end if;
 if exists(select 1 from private.narration_state_receipts where message_id=new.id) then return new;end if;
 select owner_id into v_owner from public.rooms where id=new.room_id and session_state='active' for update;
 begin
  if v_owner is null or private.monkey_owner() is distinct from v_owner then raise exception 'Authorized owner narration required for state updates';end if;
  block:=substring(new.body from '(?s)\[PATHS_STATE\](.*?)\[/PATHS_STATE\]\s*$');
  if block is null then raise exception 'Missing closing state marker';end if;
  payload:=block::jsonb;
  if jsonb_typeof(payload)<>'object' or payload->>'version' is distinct from '1' or jsonb_typeof(coalesce(payload->'inventory','[]'))<>'array' or jsonb_typeof(coalesce(payload->'scenes','[]'))<>'array' then raise exception 'Invalid version 1 state record';end if;
  if jsonb_array_length(coalesce(payload->'inventory','[]'))>64 or jsonb_array_length(coalesce(payload->'scenes','[]'))>64 then raise exception 'Too many state changes';end if;
  for change in select value from jsonb_array_elements(coalesce(payload->'inventory','[]')) loop
   identity:=private.workspace_identity(new.room_id,change->>'character');ck:=(identity->>'character_key')::uuid;delta:=(change->>'delta')::int;
   if ck is null or delta is null or delta=0 or abs(delta::bigint)>1000000 then raise exception 'Invalid inventory change';end if;
   select id into item from private.character_inventory where character_key=ck and lower(name)=lower(btrim(change->>'item'));
   perform private.change_character_inventory(new.room_id,change->>'character',case when delta>0 then 'add' else 'remove' end,item,change->>'item',abs(delta),coalesce(change->>'note',''));
   select id into item from private.character_inventory where character_key=ck and lower(name)=lower(btrim(change->>'item'));
   update private.inventory_changes set source='narrator-confirmed',source_message_id=new.id where id=(select id from private.inventory_changes where item_id=item and actor_id=auth.uid() and room_id=new.room_id order by created_at desc,id desc limit 1);
  end loop;
  for change in select value from jsonb_array_elements(coalesce(payload->'scenes','[]')) loop
   perform private.record_character_scene(new.room_id,change->>'character',change->>'location',change->>'description');
  end loop;
 exception when others then failure:=sqlerrm;end;
 insert into private.narration_state_receipts(message_id,room_id,owner_id,status,error) values(new.id,new.room_id,v_owner,case when failure is null then 'applied' else 'rejected' end,coalesce(failure,''));
 return new;
end;$$;
revoke all on function private.apply_published_narration_state() from public,anon,authenticated;
create trigger apply_published_narration_state after insert on public.messages for each row execute function private.apply_published_narration_state();
create function private.narration_state_status(p_room uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if private.monkey_owner() is null or not exists(select 1 from public.rooms where id=p_room and owner_id=private.monkey_owner()) then raise exception 'Owner authorization required';end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from(select status,error,created_at from private.narration_state_receipts where room_id=p_room order by created_at desc limit 5)x),'[]');end;$$;
create function public.narration_state_status(p_room uuid) returns jsonb language sql security invoker set search_path='' as $$select private.narration_state_status(p_room);$$;
revoke all on function private.narration_state_status(uuid),public.narration_state_status(uuid) from public,anon,authenticated;
grant execute on function private.narration_state_status(uuid),public.narration_state_status(uuid) to authenticated;
commit;
