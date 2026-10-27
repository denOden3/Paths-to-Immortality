// One live inventory per permanent character ID. Reuse the profile's Auth client.
export function mountInventory(db) {
 const root=document.getElementById('inventory');
 if(!root)return;
 const list=root.querySelector('[data-inventory-items]');
 const status=root.querySelector('[data-inventory-status]');
 const button=root.querySelector('[data-inventory-refresh]');
 let request=0;
 const clear=()=>{++request;list.replaceChildren();};
 async function refresh(){
  const current=++request;
  button.disabled=true;status.textContent='Loading belongings…';
  try {
   const {data:auth,error:authError}=await db.auth.getUser();
   if(current!==request)return;
   if(authError||!auth?.user){list.replaceChildren();status.textContent='Sign in with the character’s linked player account or the game owner account to view belongings.';return;}
   const {data,error}=await db.rpc('character_inventory_profile',{p_character_key:root.dataset.characterKey});
   if(current!==request)return;
   list.replaceChildren();
   if(error){status.textContent=error.code==='42501'?'These belongings are visible to this character’s linked player and the game owner.':'Unable to load belongings. Please try Refresh.';return;}
   for(const item of data?.inventory||[]){
    const entry=document.createElement('li');
    const title=document.createElement('strong');
    title.textContent=item.name+' × '+item.quantity;
    entry.append(title);
    if(item.note){const note=document.createElement('p');note.textContent=item.note;entry.append(note);}
    list.append(entry);
   }
   status.textContent=list.children.length?'Updated just now.':'No items currently recorded.';
  }catch{if(current===request){list.replaceChildren();status.textContent='Unable to load belongings. Please try Refresh.';}}
  finally{if(current===request)button.disabled=false;}
 }
 button.addEventListener('click',refresh);
 const visibleRefresh=()=>{if(!document.hidden&&!root.hidden)void refresh();};
 new MutationObserver(visibleRefresh).observe(root,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('focus',visibleRefresh);
 document.addEventListener('visibilitychange',visibleRefresh);
 db.auth.onAuthStateChange(()=>{clear();status.textContent='Checking account…';button.disabled=false;setTimeout(visibleRefresh,0);});
 setInterval(visibleRefresh,30000);
 visibleRefresh();
}
