(()=>{
const app=document.querySelector('.app'),toggle=document.getElementById('pti-nav-toggle'),side=document.getElementById('pti-sidebar'),shade=document.getElementById('pti-shade');if(!app||!toggle||!side)return;
const mobile=window.matchMedia('(max-width:760px)');
function sync(){const open=mobile.matches?app.classList.contains('sidebarOpen'):!app.classList.contains('sidebarClosed');toggle.setAttribute('aria-expanded',String(open));shade.hidden=!(mobile.matches&&open);}
function close(){app.classList.remove('sidebarOpen');sync();}
toggle.onclick=()=>{app.classList.toggle(mobile.matches?'sidebarOpen':'sidebarClosed');sync();if(mobile.matches&&app.classList.contains('sidebarOpen'))side.querySelector('a').focus();};shade.onclick=()=>{close();toggle.focus()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();toggle.focus()}if(e.key==='Tab'&&mobile.matches&&app.classList.contains('sidebarOpen')){const list=[...side.querySelectorAll('a,summary')].filter(el=>!el.closest('details')||el.tagName==='SUMMARY'||el.closest('details').open);const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
side.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{const dest=new URL(a.href,location.href);if(dest.pathname===location.pathname&&dest.hash){const target=document.getElementById(dest.hash.slice(1));if(target){e.preventDefault();close();target.scrollIntoView({block:'start'});target.focus();history.replaceState(null,'',dest.hash)}}else close()}));
mobile.addEventListener('change',()=>{close();sync()});sync();
})();
