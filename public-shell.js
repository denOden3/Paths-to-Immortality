(()=>{
const app=document.querySelector('.app'),toggle=document.getElementById('pti-nav-toggle'),side=document.getElementById('pti-sidebar'),shade=document.getElementById('pti-shade');if(!app||!toggle||!side)return;
const shelf=[...side.querySelectorAll('nav > details')].find(el=>el.querySelector(':scope > summary')?.textContent.trim()==='Characters');
if(shelf){
  const host=shelf.querySelector(':scope > div');
  // New pages ship with nested categories in the HTML. Rebuild older cached
  // flat menus too, keeping the same hierarchy on every public page.
  if(host&&!host.querySelector('.ptiCharacterCategories')){
    const categories=document.createElement('div');
    categories.className='ptiCharacterCategories';
    const prefix=location.pathname.includes('/codex/')?'':'codex/';
    const currentFile=location.pathname.split('/').pop();
    for(const [category,entries] of [
      ['Player Characters',[['Xiao Lan','xiao-lan.html'],['Xu Yi','xu-yi.html']]],
      ['NPCs',[['Elder Shen','examiner.html']]]
    ]){
      const section=document.createElement('details');
      section.className='ptiCharacterTier';
      section.open=true;
      const heading=document.createElement('summary');
      heading.textContent=category;
      const links=document.createElement('div');
      links.className='ptiCharacterTierLinks';
      for(const [label,filename] of entries){
        const link=document.createElement('a');
        link.href=prefix+filename;
        link.textContent=label;
        if(currentFile===filename)link.setAttribute('aria-current','page');
        links.append(link);
      }
      section.append(heading,links);
      categories.append(section);
    }
    host.replaceChildren(categories);
  }
}
// Sidebar room shortcuts appear beneath Home throughout the public Codex.
// Only the authenticated home app fetches room names; static Codex pages link
// back to it instead of caching/displaying private room data.
const home=[...side.querySelectorAll('nav>a')].find(a=>a.textContent.trim()==='Home');
if(home&&!side.querySelector('#pti-rooms-shelf')){
 const rooms=document.createElement('details');rooms.id='pti-rooms-shelf';
 rooms.className='ptiRoomsShelf';
 const summary=document.createElement('summary');summary.textContent='Rooms';summary.setAttribute('aria-label','Expand your active rooms');
 const contents=document.createElement('div');contents.id='pti-rooms-list';contents.setAttribute('aria-live','polite');
 if(document.getElementById('roomList')){
  const status=document.createElement('p');status.className='ptiRoomsStatus';status.textContent='Open to load your active rooms.';
  contents.append(status);
 }else{
  const link=document.createElement('a');link.href=location.pathname.includes('/codex/')?'../index.html#rooms':'index.html#rooms';
  link.textContent='Open your rooms on Home';contents.append(link);
 }
 rooms.append(summary,contents);home.insertAdjacentElement('afterend',rooms);
 rooms.addEventListener('toggle',()=>{if(rooms.open)document.dispatchEvent(new CustomEvent('pti:rooms-open'));});
 if(location.hash==='#rooms'){rooms.open=true;if(document.getElementById('roomList'))history.replaceState(null,'',location.pathname+location.search);}
}

// Character dossier tabs — content stays directly beneath the buttons.
const profileNav=document.querySelector('.ptiProfileTabs[role="tablist"]');
if(profileNav){
 const tabs=[...profileNav.querySelectorAll('button[role="tab"][data-panel]')];
 const panels=new Map(tabs.map(tab=>[tab.dataset.panel,document.getElementById(tab.dataset.panel)]));
 if(tabs.length&&tabs.every(tab=>panels.get(tab.dataset.panel))){
  function showProfilePanel(id,{record=false}={}){
   const selected=panels.has(id)?id:null;
   for(const tab of tabs){
    const active=tab.dataset.panel===selected;
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex=active?0:-1;
    panels.get(tab.dataset.panel).hidden=!active;
   }
   if(!selected)tabs[0].tabIndex=0;
   if(record){
    const next=selected?'#'+encodeURIComponent(selected):location.pathname+location.search;
    if(location.hash!==(selected?'#'+encodeURIComponent(selected):''))history.pushState(null,'',next);
   }
  }
  const fromLocation=()=>{
   let key='';
   try{key=decodeURIComponent(location.hash.slice(1));}catch{}
   showProfilePanel(key==='day-one'?'scenes':key);
  };
  profileNav.addEventListener('click',event=>{
   const tab=event.target.closest('button[role="tab"][data-panel]');
   if(!tab||!profileNav.contains(tab))return;
   showProfilePanel(tab.dataset.panel,{record:true});
  });
  profileNav.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   const tab=event.target.closest('button[role="tab"][data-panel]');
   if(!tab)return;
   event.preventDefault();
   const current=tabs.indexOf(tab);
   const target=event.key==='Home'?0:event.key==='End'?tabs.length-1:
    (current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   tabs[target].focus();
   showProfilePanel(tabs[target].dataset.panel,{record:true});
  });
  window.addEventListener('hashchange',fromLocation);
  window.addEventListener('popstate',fromLocation);
  fromLocation();
 }
}

const mobile=window.matchMedia('(max-width:760px)');
function sync(){const open=mobile.matches?app.classList.contains('sidebarOpen'):!app.classList.contains('sidebarClosed');toggle.setAttribute('aria-expanded',String(open));shade.hidden=!(mobile.matches&&open);}
function close(){app.classList.remove('sidebarOpen');sync();}
toggle.onclick=()=>{app.classList.toggle(mobile.matches?'sidebarOpen':'sidebarClosed');sync();if(mobile.matches&&app.classList.contains('sidebarOpen'))side.querySelector('a').focus();};shade.onclick=()=>{close();toggle.focus()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();toggle.focus()}if(e.key==='Tab'&&mobile.matches&&app.classList.contains('sidebarOpen')){const list=[...side.querySelectorAll('a,summary')].filter(el=>!el.closest('details')||el.tagName==='SUMMARY'||el.closest('details').open);const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
side.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{const dest=new URL(a.href,location.href);if(dest.pathname===location.pathname&&dest.hash){const target=document.getElementById(dest.hash.slice(1));if(target){e.preventDefault();close();target.scrollIntoView({block:'start'});target.focus();history.replaceState(null,'',dest.hash)}}else close()}));
mobile.addEventListener('change',()=>{close();sync()});sync();
})();
