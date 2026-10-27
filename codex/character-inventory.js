// One live inventory per permanent character ID. Reuse the profile's Auth client.
export function mountInventory(db) {
 const root=document.getElementById('inventory');
 if(!root)return;
 const list=root.querySelector('[data-inventory-items]');
 const status=root.querySelector('[data-inventory-status]');
 const button=root.querySelector('[data-inventory-refresh]');
 let request=0;
 const categories=[
  ['currency','Currency & funds'],
  ['artifacts','Artifacts & weapons'],
  ['clothing','Clothing & accessories'],
  ['other','Other possessions'],
  ['recordkeeping','Recordkeeping']
 ];
 const categoryKeys=new Set(categories.map(([key])=>key));
 const make=(tag,cls,contents)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(contents!==undefined)node.textContent=String(contents);
  return node;
 };
 const clear=()=>{++request;list.replaceChildren();};
 function renderInventory(items){
  const openGroups=new Set([...list.querySelectorAll('.ptiInventoryCategory[open]')].map(el=>el.dataset.category));
  const openItems=new Set([...list.querySelectorAll('.ptiInventoryItem[open]')].map(el=>el.dataset.item));
  list.replaceChildren();
  for(const [categoryKey,label] of categories){
   const filtered=items.filter(item=>{
    const itemCategory=categoryKeys.has(item.category)?item.category:'other';
    return itemCategory===categoryKey;
   });
   const category=make('details','ptiInventoryCategory');
   category.dataset.category=categoryKey;
   category.open=openGroups.has(categoryKey);
   const categorySummary=make('summary','ptiInventoryCategorySummary');
   categorySummary.append(make('span','ptiInventoryCategoryLabel',label));
   categorySummary.append(make('span','ptiInventoryCategoryCount',filtered.length));
   category.append(categorySummary);
   const body=make('div','ptiInventoryCategoryBody');
   if(!filtered.length)body.append(make('p','ptiInventoryEmpty','Nothing recorded in this category yet.'));
   for(const item of filtered){
    const entry=make('details','ptiInventoryItem');
    entry.dataset.item=String(item.id||item.name);
    entry.open=openItems.has(entry.dataset.item);
    const heading=make('summary','ptiInventoryItemSummary');
    heading.append(make('span','ptiInventoryItemName',item.name||'Unnamed possession'));
    heading.append(make('span','ptiInventoryItemQuantity','× '+item.quantity));
    entry.append(heading);
    const details=make('div','ptiInventoryItemDetails');
    if(item.note){
     const description=make('div','ptiInventoryItemDetail');
     description.append(make('strong','ptiInventoryDetailLabel','Description'));
     description.append(make('p','',item.note));
     details.append(description);
    }
    const obtained=make('div','ptiInventoryItemDetail');
    obtained.append(make('strong','ptiInventoryDetailLabel','Obtained'));
    obtained.append(make('p','',item.obtained||'Not yet recorded.'));
    details.append(obtained);
    entry.append(details);
    body.append(entry);
   }
   category.append(body);list.append(category);
  }
 }
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
   const items=Array.isArray(data?.inventory)?data.inventory:[];
   renderInventory(items);
   status.textContent=items.length?'Updated just now.':'No items currently recorded.';
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
