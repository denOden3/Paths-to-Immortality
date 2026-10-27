// Relationship cards are player-specific discoveries; only the profile owner can edit.
const base='https://fhjsoldgtqfizkwpehud.supabase.co/storage/v1/object/public/pti-character-art/';
const imagePath=/^[0-9a-f-]{36}[/][a-z0-9-]{2,48}[/][0-9a-f-]{36}[.](png|jpg|jpeg|webp)$/;
const profilePages={'Xiao Lan':'xiao-lan.html','Xu Yi':'xu-yi.html','Elder Shen':'examiner.html'};
const node=(tag,css,txt)=>{const e=document.createElement(tag);if(css)e.className=css;if(txt!==undefined)e.textContent=String(txt);return e;};
export function mountRelationships(db){
 const root=document.querySelector('#relationships[data-character]');
 if(!root)return;
 const observer=root.dataset.character,list=root.querySelector('[data-relations-list]');
 const status=root.querySelector('[data-relations-status]'),add=root.querySelector('[data-relations-add]');
 let records=[],images=new Map(),canEdit=false,editing=null,adding=false,serial=0,loaded=false;
 const photo=(record,large=false)=>{
  const circle=node('span',large?'ptiRelationPortrait large':'ptiRelationPortrait');
  const key=record.linked_profile||record.name,path=images.get(key);
  if(typeof path==='string'&&imagePath.test(path)){
   const image=node('img');image.src=base+path.split('/').map(encodeURIComponent).join('/');
   image.alt=key+' portrait';image.loading='lazy';circle.append(image);
  }else{circle.textContent=(record.name||'?').slice(0,1).toUpperCase();circle.setAttribute('aria-label','Portrait not uploaded')}
  return circle;
 };
 function form(record,host){
  const editor=node('form','ptiRelationEditor');
  const inputs={};
  for(const [key,label,max,kind] of [
   ['name','Name',100,'text'],['kind','Character type',0,'select'],
   ['affiliation','Affiliation / group',90,'text'],
   ['first_met','First met · date and place',240,'text'],
   ['discovered','What the player character learned',3000,'textarea'],
   ['linked_profile','Avatar source · character page name (optional)',100,'text']
  ]){
   const field=node('label','ptiRelationField',label);
   const input=node(kind==='text'?'input':kind);
   if(kind==='text'){input.type='text';input.maxLength=max}
   if(kind==='textarea'){input.maxLength=max;input.rows=5}
   if(kind==='select'){
    for(const [value,label] of [['npc','NPC'],['player','Player character']]){
     const option=node('option','',label);option.value=value;input.append(option);
    }
   }
   input.value=record[key]|| (key==='kind'?'npc':'');
   if(key==='linked_profile')input.placeholder='e.g. Elder Shen, Xu Yi, Xiao Lan';
   field.append(input);editor.append(field);inputs[key]=input;
  }
  editor.append(node('p','ptiRelationHint','If the named character has a Web profile and an active avatar, that portrait appears automatically.'));
  const actions=node('div','ptiRelationEditActions');
  const save=node('button','ptiRelationSave','Save relationship');save.type='submit';
  const cancel=node('button','ptiRelationCancel','Cancel');cancel.type='button';
  const message=node('p','ptiRelationFormStatus');message.setAttribute('role','status');
  actions.append(save,cancel);editor.append(actions,message);
  cancel.onclick=()=>{editing=null;adding=false;render()};
  editor.onsubmit=async event=>{
   event.preventDefault();
   const payload={p_observer:observer,p_id:record.id||null,
    p_name:inputs.name.value.trim(),p_kind:inputs.kind.value,
    p_affiliation:inputs.affiliation.value.trim(),
    p_first_met:inputs.first_met.value.trim(),p_discovered:inputs.discovered.value.trim(),
    p_linked_profile:inputs.linked_profile.value.trim()||null};
   if(!payload.p_name||!payload.p_affiliation){message.textContent='Name and affiliation are required.';return}
   save.disabled=true;cancel.disabled=true;message.textContent='Saving…';
   const {error}=await db.rpc('character_relationships_save',payload);
   if(error){message.textContent='Could not save: '+error.message;save.disabled=false;cancel.disabled=false;return}
   editing=null;adding=false;await refresh();status.textContent='Relationship saved.';
  };
  host.append(editor);
 }
 function render(){
  const openItems=new Set([...list.querySelectorAll('.ptiRelationPerson[open]')].map(x=>x.dataset.id));
  const openGroups=new Set([...list.querySelectorAll('.ptiRelationGroup[open]')].map(x=>x.dataset.group));
  list.replaceChildren();add.hidden=!canEdit;
  if(adding&&canEdit){
   const newBox=node('div','ptiRelationNew');
   newBox.append(node('h4','','New relationship'));
   list.append(newBox);form({kind:'npc'},newBox);
  }
  if(!records.length){list.append(node('p','ptiRelationQuiet','No confirmed encounters yet.'));return}
  const groups=new Map();
  for(const r of records){const key=r.affiliation||'Unaffiliated';
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
  for(const [affiliation,people] of groups){
   const group=node('details','ptiRelationGroup');group.dataset.group=affiliation;
   group.open=!loaded||openGroups.has(affiliation);
   const summary=node('summary','ptiRelationGroupSummary');
   summary.append(node('span','',affiliation),node('span','ptiRelationGroupCount',people.length));
   group.append(summary);
   const body=node('div','ptiRelationGroupBody');
   for(const person of people){
    const item=node('details','ptiRelationPerson');item.dataset.id=person.id;item.open=openItems.has(person.id)||editing===person.id;
    const title=node('summary','ptiRelationPersonSummary');
    const line=node('span','ptiRelationSummaryText');
    line.append(node('strong','',person.name),node('small','',person.first_met||'First meeting not recorded'));
    title.append(photo(person),line,node('span','ptiRelationArrow','⌄'));item.append(title);
    const details=node('div','ptiRelationDetails');
    const head=node('div','ptiRelationCardHead');
    head.append(photo(person,true));
    const label=node('div','ptiRelationTitle');
    label.append(node('h4','',person.name),node('span','',person.kind==='player'?'Player character':'NPC'));
    head.append(label);
    if(canEdit){
     const pencil=node('button','ptiRelationPencil','✎');
     pencil.type='button';pencil.setAttribute('aria-label','Edit '+person.name);
     pencil.title='Edit relationship';
     pencil.onclick=()=>{editing=editing===person.id?null:person.id;render()};
     head.append(pencil);
    }
    details.append(head);
    const met=node('p','ptiRelationMet');
    met.append(node('strong','','First met: '),document.createTextNode(person.first_met||'Not yet recorded'));
    details.append(met,node('p','ptiRelationDiscovery',person.discovered||'No further discoveries recorded.'));
    const url=profilePages[person.linked_profile||person.name];
    if(url){const link=node('a','ptiRelationLink','View character page');link.href=url;details.append(link)}
    if(editing===person.id&&canEdit)form(person,details);
    item.append(details);body.append(item);
   }
   group.append(body);list.append(group);
  }
  loaded=true;
 }
 async function refresh(){
  const seq=++serial;status.textContent='Loading relationships…';
  const [relationships,avatars,ownership]=await Promise.all([
   db.rpc('character_relationships_list',{p_observer:observer}),
   db.rpc('character_art_avatars'),
   db.rpc('character_art_editor',{p_character:observer})
  ]);
  if(seq!==serial)return;
  if(relationships.error){status.textContent='Could not load relationships.';return}
  records=Array.isArray(relationships.data)?relationships.data:[];
  images=new Map((Array.isArray(avatars.data)?avatars.data:[]).filter(x=>x?.character).map(x=>[x.character,x.path]));
  canEdit=!ownership.error&&ownership.data?.can_upload===true;
  render();status.textContent='';
 }
 add.onclick=()=>{if(canEdit){adding=!adding;editing=null;render()}};
 new MutationObserver(()=>{if(!root.hidden&&(!loaded||!records.length))void refresh()})
  .observe(root,{attributes:true,attributeFilter:['hidden']});
 db.auth.onAuthStateChange(()=>setTimeout(()=>{if(!root.hidden)void refresh()},0));
 void refresh();
}