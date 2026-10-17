-- Retire the opt-in voice trial and its transient signaling data only.
begin;
drop function public.voice_exchange(uuid,text,uuid,uuid,jsonb);
drop function private.voice_exchange(uuid,text,uuid,uuid,jsonb);
drop table private.voice_signals;
drop table private.voice_peers;
commit;
