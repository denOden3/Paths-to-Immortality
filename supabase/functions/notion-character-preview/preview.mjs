// Read-only Notion preview. No tokens or full page bodies are returned to the HUD.
export function pageId(value) {
  let url;try { url=new URL(value); } catch { throw new Error('Paste a Notion character page link.'); }
  if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)(notion\.so|notion\.com|notion\.site)$/.test(url.hostname))throw new Error('Paste a valid HTTPS Notion page link.');
  const match=url.pathname.match(/([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(?:\/)?$/i);
  if(!match)throw new Error('The Notion link must identify a page.');
  return match[1].replaceAll('-','').toLowerCase();
}
const rich=x=>(x||[]).map(p=>p.plain_text??p.text?.content??'').join('');
const text=b=>rich(b?.[b.type]?.rich_text);
const clean=s=>s.replace(/\s+/g,' ').trim();
function clip(s,n){return s.length>n?s.slice(0,n-1).trimEnd()+'…':s;}
export async function previewCharacter(id,notion) {
  const page=await notion('pages/'+id);
  if(page.archived||page.in_trash)throw new Error('This Notion page is in the trash.');
  const title=Object.values(page.properties||{}).find(p=>p.type==='title');
  let name=rich(title?.title),description='',goal='',summarySource='';
  const blocks=await notion('blocks/'+id+'/children?page_size=100',true);
  for(const b of blocks){
    const t=clean(text(b));
    const m=t.match(/^(?:Full name|Name):\s*(.+)$/i);if(m)name=m[1];
    const o=t.match(/^(?:Objective|Goal):\s*(.+)$/i);if(o)goal=o[1];
    const s=t.match(/^(?:.+[’']s\s+)?HUD (?:description|summary):\s*(.+)$/i);if(s){description=s[1];summarySource='Character page HUD summary';}
  }
  // The editable summaries currently live beside each child-page link in Player Characters.
  if(!description&&page.parent?.type==='page_id'){
    const siblings=await notion('blocks/'+page.parent.page_id+'/children?page_size=100',true);
    const index=siblings.findIndex(b=>b.type==='child_page'&&b.id.replaceAll('-','')===id);
    if(index>=0){
      for(const b of siblings.slice(index+1)){
        if(b.type==='child_page'||b.type.startsWith('heading_'))break;
        const t=clean(text(b)),m=t.match(/^(?:.+[’']s\s+)?HUD (?:description|summary):\s*(.*)$/i);
        if(b.type==='quote'&&m){description=m[1];summarySource='Player Characters HUD description';break;}
      }
    }
  }
  // Also support a dedicated HUD Summary heading followed by paragraphs.
  if(!description){const i=blocks.findIndex(b=>b.type.startsWith('heading_')&&/^HUD (summary|description)$/i.test(clean(text(b))));
    if(i>=0){const parts=[];for(const b of blocks.slice(i+1)){if(b.type.startsWith('heading_')||b.type==='child_page')break;const t=clean(text(b));if(t)parts.push(t);}description=parts.join(' ');if(description)summarySource='Character page HUD Summary section';}}
  const warnings=[];if(!description)warnings.push('No HUD summary found. Add a HUD description quote beside this character in Player Characters, or type a description below.');
  if(name.length>40)warnings.push('The name was shortened to 40 characters; review it before registering.');
  if(description.length>350)warnings.push('The summary was shortened to fit the HUD; review it before registering.');
  if(goal.length>150)warnings.push('The objective was shortened; review it before registering.');
  if(!name.trim())throw new Error('This page has no character name.');
  return {name:clip(clean(name),40),description:clip(clean(description),350),goal:clip(clean(goal),150),source_url:'https://www.notion.so/'+id,summary_source:summarySource,warnings};
}
export function createHandler({env,fetcher=fetch}) {
  return async req=>{
    const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
    const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return reply({message:'Use POST.'},405);
    try{
      const auth=req.headers.get('Authorization')||'';if(!/^Bearer \S+$/.test(auth))return reply({message:'Sign in and pair your HUD first.'},401);
      const raw=await req.text();if(raw.length>4096)return reply({message:'Request too large.'},413);
      let input;try{input=JSON.parse(raw);}catch{return reply({message:'Invalid request.'},400);}
      if(typeof input.player_id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.player_id))return reply({message:'Choose a registered player.'},400);
      const id=pageId(input.url);
      // PostgREST verifies the JWT; this owner-scoped RPC rechecks active delegation and player ownership.
      // No service-role key, JWT decoding, or user-editable metadata authorization.
      const access=await fetcher(env('SUPABASE_URL')+'/rest/v1/rpc/hud_player_characters',{method:'POST',headers:{Authorization:auth,apikey:env('SUPABASE_ANON_KEY'),'Content-Type':'application/json'},body:JSON.stringify({p_player:input.player_id}),signal:AbortSignal.timeout(8000)});
      if(!access.ok)return reply({message:'Only the owner or an actively paired HUD can import for this player.'},access.status===401?401:403);
      const token=env('NOTION_TOKEN');if(!token)return reply({message:'Notion import needs one setup step: save your Notion connection token as NOTION_TOKEN in Supabase → Edge Functions → Secrets. Keep it out of chat and the HUD script.'},503);
      let calls=0;
      const notion=async(path,list=false)=>{
        let result=[],cursor='';do{
          if(++calls>8)throw new Error('This page is too large to check. Put the HUD summary near the top of a smaller Player Characters page.');
          const r=await fetcher('https://api.notion.com/v1/'+path+(cursor?'&start_cursor='+encodeURIComponent(cursor):''),{headers:{Authorization:'Bearer '+token,'Notion-Version':'2025-09-03'},signal:AbortSignal.timeout(8000),redirect:'error'});
          if(!r.ok)throw new Error(r.status===404||r.status===403?'Notion cannot read this page. Add the Paths to Immortality connection to the character page and its Player Characters parent.':r.status===401?'The saved Notion token is invalid. Update NOTION_TOKEN in Supabase Secrets.':r.status===429?'Notion is busy. Please try again shortly.':'Notion could not check this page. Please try again.');
          const data=await r.json();if(!list)return data;result.push(...(data.results||[]));cursor=data.has_more?data.next_cursor:'';
        }while(cursor);return result;
      };
      return reply(await previewCharacter(id,notion));
    }catch(error){return reply({message:error.name==='TimeoutError'?'The page check timed out. Your form is unchanged; try again.':error.message||'Could not check this page.'},400);}
  };
}
