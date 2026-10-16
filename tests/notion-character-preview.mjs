import assert from 'node:assert/strict';
import {pageId,previewCharacter,createHandler} from '../supabase/functions/notion-character-preview/preview.mjs';
const id='3fbb0ac52efe806e9fbeee8ce2b760a9',other='3f7b0ac52efe81c88be9db01ee415fd6';
const block=(type,t,extra={})=>({type,id:other,[type]:{rich_text:[{plain_text:t}]},...extra});
const page={properties:{title:{type:'title',title:[{plain_text:'Xu Yi (Ah Yi / Yiyi)'}]}},parent:{type:'page_id',page_id:'parent'}};
assert.equal(pageId('https://app.notion.com/p/Xu-Yi-'+id+'?pvs=204'),id);
for(const url of ['https://evil.com/'+id,'https://notion.so.evil.com/'+id,'http://notion.so/'+id,'https://notion.so/no-page','https://user:password@notion.so/'+id])assert.throws(()=>pageId(url));
let calls=[];
const notion=async path=>{calls.push(path);if(path.startsWith('pages/'))return page;if(path.startsWith('blocks/'+id))return [block('paragraph','Full name: Xu Yi')];return [{type:'child_page',id:other},block('quote','Xiao Lan’s HUD description: Wrong summary'),{type:'child_page',id},block('quote','Xu Yi’s HUD description: A friendly girl who loves travel.'),{type:'child_page',id:other}];};
const result=await previewCharacter(id,notion);assert.equal(result.name,'Xu Yi');assert.equal(result.description,'A friendly girl who loves travel.');assert.equal(result.source_url,'https://www.notion.so/'+id);
const noSummary=await previewCharacter(id,async path=>path.startsWith('pages/')?page:[]);assert.equal(noSummary.description,'');assert.equal(noSummary.warnings.length,1);
const capped=await previewCharacter(id,async path=>path.startsWith('pages/')?page:[block('paragraph','HUD Summary: '+ 'a'.repeat(400))]);assert.equal(capped.description.length,350);assert.ok(capped.warnings.length);
const env=k=>({SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'public-key',NOTION_TOKEN:'private-notion-token'})[k];
const request=(auth='Bearer valid')=>new Request('https://edge.example',{method:'POST',headers:{Authorization:auth},body:JSON.stringify({player_id:'11111111-1111-4111-8111-111111111111',url:'https://notion.so/'+id})});
let external=0;
const denied=createHandler({env,fetcher:async()=>new Response('{}',{status:403})});assert.equal((await denied(request())).status,403);
assert.equal((await denied(request(''))).status,401);
const missing=createHandler({env:k=>k==='NOTION_TOKEN'?undefined:env(k),fetcher:async()=>new Response('[]')});const setup=await missing(request());assert.equal(setup.status,503);assert.match((await setup.json()).message,/NOTION_TOKEN/);
const handler=createHandler({env,fetcher:async(url,opts)=>{
 if(url.includes('supabase.co')){assert.equal(opts.headers.Authorization,'Bearer valid');return new Response('[]');}
 external++;assert.equal(opts.headers.Authorization,'Bearer private-notion-token');
 if(url.includes('/pages/'))return Response.json(page);
 return Response.json({results:url.includes('/blocks/'+id)?[block('paragraph','Name: Xu Yi'),block('quote','HUD description: A kind traveler.')]:[],has_more:false});
}});
const response=await handler(request());assert.equal(response.status,200);const payload=await response.text();assert.ok(!payload.includes('private-notion-token'));assert.equal(JSON.parse(payload).description,'A kind traveler.');assert.ok(external>0);
console.log('PASS: Notion page validation, exact sibling-summary matching, missing summary, caps, owner authorization gate, missing secret and token privacy');
