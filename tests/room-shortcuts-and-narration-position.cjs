// Regression checks for cross-page rooms, narration anchors and cross-tab tokens.
// Run from the repository root: node tests/room-shortcuts-and-narration-position.cjs
const fs=require('node:fs'),assert=require('node:assert/strict');
const web=fs.readFileSync('index.html','utf8');
const shell=fs.readFileSync('public-shell.js','utf8');
const hud=fs.readFileSync('userscripts/Paths-Monkey-GM.user.js','utf8');
function excerpt(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'Expected code region: '+start);
 return source.slice(a,b+end.length);
}
assert.match(shell,/link\.href=homeHref\+'\?room='\+encodeURIComponent\(item\.id\)/);
assert.match(shell,/portal_context/);
assert.match(shell,/room_members/);
assert.match(web,/openedDirectRoom=await openRoom\(requestedRoomId\)/);
assert.match(web,/setRoomAddress\(id\)/);
assert.doesNotMatch(shell,/localStorage\.setItem\(['"]room/, 'Do not persist private room titles on static Codex pages');

const links=excerpt(web,'function setRoomAddress(id){','\n}');
let address='';
const changeRoom=new Function('id','location','history','URLSearchParams',links+'\nsetRoomAddress(id);');
const location={pathname:'/Paths-to-Immortality/index.html',search:'',hash:''};
const history={replaceState(_state,_title,url){address=url;}};
const id='11111111-2222-3333-4444-555555555555';
changeRoom(id,location,history,URLSearchParams);
assert.equal(address,location.pathname+'?room='+id);
changeRoom(null,location,history,URLSearchParams);
assert.equal(address,location.pathname);

const scrollWeb=excerpt(web,'  const freshRoom=previousLive.length===0;','  else el.scrollTop=previousScroll;');
const scrollHud=excerpt(hud,'    const target=newNarration&&!freshRoom','    else feed.scrollTop=prevTop;');
const bubble=(id,top)=>({dataset:{messageId:id},getBoundingClientRect:()=>({top})});
const children=[bubble('old',35),bubble('narrator',460),bubble('last',1450)];
const el={children,lastElementChild:children[2],scrollTop:0,scrollHeight:2000,getBoundingClientRect:()=>({top:0})};
const showWeb=new Function('el','previousLive','newNarration','newestNarration','previousScroll','nearBottom',scrollWeb+'\nreturn el.scrollTop;');
assert.equal(showWeb(el,[{}],true,'narrator',0,true),454,'new narration must open at its first line');
assert.equal(showWeb(el,[],false,'narrator',0,true),1444,'fresh page must start at the last bubble');
const feed={scrollTop:0,scrollHeight:2000,getBoundingClientRect:()=>({top:0})};
const showHud=new Function('el','feed','newNarration','freshRoom','latestNarration','prevTop','nearBottom','updateChatScrollbar',scrollHud+'\nreturn feed.scrollTop;');
assert.equal(showHud(el,feed,true,false,'narrator',0,true,()=>{}),454);
feed.scrollTop=0;
assert.equal(showHud(el,feed,false,true,'narrator',0,true,()=>{}),1444);

const auth=excerpt(hud,'  function syncSavedMonkeyAccount(){','  async function refreshPairing(){');
const createTab=new Function('get','put','http','navigator','account','paired',
  'let refreshPromise=null;\n'+auth+'\nreturn {validToken,refreshAuth};');
const clone=o=>JSON.parse(JSON.stringify(o));
let calls=0;
const shared={account:{user_id:'monkey',access_token:'oldAccess',refresh_token:'oldRefresh',expires_at:1}};
const get=k=>clone(shared[k]),put=(k,v)=>{shared[k]=clone(v);};
const http=async(_method,_path,{body})=>{
 calls++;assert.equal(body.refresh_token,'oldRefresh');
 await Promise.resolve();
 return {access_token:'newAccess',refresh_token:'newRefresh',expires_in:3600,user:{id:'monkey'}};
};
let queue=Promise.resolve();
const navigator={locks:{request(_name,callback){
 const next=queue.then(callback);queue=next.catch(()=>{});return next;
}}};
(async()=>{
 const left=createTab(get,put,http,navigator,clone(shared.account),false);
 const right=createTab(get,put,http,navigator,clone(shared.account),false);
 const tokens=await Promise.all([left.validToken(),right.validToken()]);
 assert.deepEqual(tokens,['newAccess','newAccess']);
 assert.equal(calls,1,'Only one tab may consume a refresh token');
 assert.equal(shared.account.refresh_token,'newRefresh');
 console.log('PASS: direct room navigation, narration reading anchors, and coordinated HUD token renewal');
})().catch(err=>{console.error(err);process.exitCode=1;});
