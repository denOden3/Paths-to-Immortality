import { mountInventory } from './character-inventory.js?v=20261027-shared-inventory';
// Character profiles: Notion-style illustration list + simple portrait picker.
// Stored artwork is hosted in the public Supabase Storage bucket; only its
// registered character owner may upload or change the active chat avatar.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl='https://fhjsoldgtqfizkwpehud.supabase.co';
const publishableKey='sb_publishable_hWZGWQyF7xNe90x8kSFESw_2k4AHU5t';
const bucket='pti-character-art';
const root=document.querySelector('#pti-character-illustrations');

if(root){
  const character=root.dataset.character;
  const db=createClient(supabaseUrl,publishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
  });
  mountInventory(db);
  const gallery=root.querySelector('.ptiArtGallery');
  const status=root.querySelector('.ptiArtStatus');
  const controls=root.querySelector('.ptiArtControls');
  const addButton=root.querySelector('.ptiArtAddButton');
  const fileInput=root.querySelector('.ptiArtFile');
  const fileButton=root.querySelector('.ptiArtPick');
  const uploadButton=root.querySelector('.ptiArtUpload');
  const titleInput=root.querySelector('.ptiArtLabel');
  const noteInput=root.querySelector('.ptiArtNote');
  const portraitButton=document.querySelector('#pti-avatar-trigger');
  const portraitSlot=document.querySelector('.ptiAvatarSlot');
  const editPortraitButton=document.querySelector('.ptiAvatarPortraitCorner');
  const portraitImage=document.querySelector('.ptiAvatarPreview');
  const portraitSilhouette=document.querySelector('.ptiAvatarSilhouette');
  const portraitHint=document.querySelector('.ptiAvatarHint');
  const dialog=root.querySelector('.ptiAvatarDialog');
  const dialogHelp=root.querySelector('.ptiAvatarDialogHelp');
  const choices=root.querySelector('.ptiAvatarChoices');
  const make=(tag,cls,copy)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(copy!==undefined)node.textContent=copy;
    return node;
  };
  const validImagePath=path=>typeof path==='string'&&
    /^[0-9a-f-]{36}\/[a-z0-9-]{2,48}\/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$/.test(path);
  const imageUrl=path=>validImagePath(path)?
    supabaseUrl+'/storage/v1/object/public/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'):'';
  let illustrations=[],canUpload=false,selectedFiles=[],openEditorGroup=null;
  const limitImages=8;
  const setStatus=(text)=>{status.textContent=text;};

  // Deliberately render only text nodes, <strong> and <em>. No user HTML is injected.
  function formatDescription(element,value){
    const source=String(value||'');
    const regex=/\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([^*\n]+?)\*|_([^_\n]+?)_/g;
    let previous=0,match;
    while((match=regex.exec(source))){
      if(match.index>previous)element.append(document.createTextNode(source.slice(previous,match.index)));
      const part=make(match[1]!==undefined||match[2]!==undefined?'strong':'em');
      part.textContent=match[1]??match[2]??match[3]??match[4];
      element.append(part);
      previous=regex.lastIndex;
    }
    if(previous<source.length)element.append(document.createTextNode(source.slice(previous)));
  }

  function formatButtons(field,toolbar){
    const use=(mark)=>{
      const a=field.selectionStart,b=field.selectionEnd;
      const selected=field.value.slice(a,b);
      const inner=selected||'text';
      const added=mark+inner+mark;
      field.setRangeText(added,a,b,'select');
      field.focus();
      field.setSelectionRange(a+mark.length,a+mark.length+inner.length);
      field.dispatchEvent(new Event('input',{bubbles:true}));
    };
    for(const [cls,mark] of [['.ptiArtBold','**'],['.ptiArtItalic','*']]){
      toolbar.querySelector(cls)?.addEventListener('click',()=>use(mark));
    }
  }
  formatButtons(noteInput,root.querySelector('.ptiArtFormatToolbar'));

  function groupedIllustrations(){
    const map=new Map();
    for(const entry of illustrations){
      const id=entry.group_id||entry.id;
      if(!map.has(id))map.set(id,{id,label:entry.label,description:entry.description||'',images:[]});
      map.get(id).images.push(entry);
    }
    return [...map.values()];
  }

  async function uploadPhoto(file){
    const problem=validate(file);
    if(problem)throw Error(problem);
    const {data:auth,error:authError}=await db.auth.getUser();
    if(authError||!auth?.user)throw Error('Sign in again to edit illustrations.');
    const {data:editor,error:editorError}=await db.rpc('character_art_editor',{p_character:character});
    if(editorError||!editor?.can_upload||!editor.slug)throw Error('This account cannot edit '+character+'.');
    const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const path=auth.user.id+'/'+editor.slug+'/'+crypto.randomUUID()+'.'+extension;
    const {error}=await db.storage.from(bucket).upload(path,file,{
      cacheControl:'3600',contentType:file.type,upsert:false
    });
    if(error)throw error;
    return path;
  }

  async function addToGroup(group,files,localStatus){
    for(let i=0;i<files.length;i++){
      localStatus.textContent='Adding picture '+(i+1)+' of '+files.length+'…';
      const path=await uploadPhoto(files[i]);
      const {error}=await db.rpc('character_art_register_group',{
        p_character:character,p_path:path,p_label:group.label,
        p_description:group.description,p_group:group.id
      });
      if(error){
        await db.storage.from(bucket).remove([path]).catch(()=>{});
        throw error;
      }
    }
  }

  function renderEditor(group,section){
    const editor=make('div','ptiArtEditor');
    const label=make('label','', 'Appearance / scene title');
    const title=make('input','');title.type='text';title.maxLength=90;title.value=group.label;
    label.append(title);
    const descLabel=make('label','', 'Description');
    const hint=make('span','ptiArtFormatHint','Select words and use Bold or Italic below.');
    const bar=make('div','ptiArtFormatToolbar');
    bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Description formatting');
    const bold=make('button','ptiArtBold');bold.type='button';bold.innerText='B';
    bold.setAttribute('aria-label','Bold selected text');
    const italic=make('button','ptiArtItalic');italic.type='button';italic.innerText='I';italic.style.fontStyle='italic';
    italic.setAttribute('aria-label','Italicize selected text');
    bar.append(bold,italic);
    const desc=make('textarea','');desc.maxLength=2000;desc.rows=6;desc.value=group.description;
    descLabel.append(hint,bar,desc);
    formatButtons(desc,bar);
    const photoTitle=make('p','ptiArtFormatHint','Pictures in this record · Choose Replace to change an image.');
    const existing=make('div','ptiArtEditPhotos');
    for(const image of group.images){
      const url=imageUrl(image.path);
      if(!url)continue;
      const cell=make('div','ptiArtEditThumb');
      const picture=make('img','');picture.src=url;picture.alt=group.label;
      const change=make('button','', 'Replace');
      change.type='button';change.setAttribute('aria-label','Replace photo in '+group.label);
      const file=make('input','');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.hidden=true;
      change.addEventListener('click',()=>file.click());
      file.addEventListener('change',async()=>{
        const chosen=file.files?.[0];file.value='';
        if(!chosen)return;
        const bad=validate(chosen);
        if(bad){message.textContent=bad;return;}
        if(title.value.trim()!==group.label||desc.value.trim()!==group.description.trim()){
          message.textContent='Save your title and description changes before replacing a picture.';return;
        }
        change.disabled=true;save.disabled=true;add.disabled=true;
        message.textContent='Replacing picture…';
        try{
          const path=await uploadPhoto(chosen);
          const {data,error}=await db.rpc('character_art_replace_photo',{
            p_character:character,p_id:image.id,p_path:path
          });
          if(error){
            await db.storage.from(bucket).remove([path]).catch(()=>{});
            throw error;
          }
          const old=data?.old_path;
          if(old){
            const removal=await db.storage.from(bucket).remove([old]);
            if(removal.error)console.warn('Previous photo cleanup could not complete',removal.error);
          }
          await refreshGallery();
          setStatus('Picture replaced in '+group.label+'.');
        }catch(err){message.textContent='Unable to replace picture: '+err.message;
          change.disabled=false;save.disabled=false;add.disabled=false;
        }
      });
      cell.append(picture,change,file);existing.append(cell);
    }
    const add=make('button','ptiArtAddPhotos','＋ Add more pictures');
    add.type='button';
    const addFile=make('input','');addFile.type='file';addFile.accept='image/png,image/jpeg,image/webp';
    addFile.multiple=true;addFile.hidden=true;
    add.addEventListener('click',()=>addFile.click());
    addFile.addEventListener('change',async()=>{
      const files=[...addFile.files||[]];addFile.value='';
      if(!files.length)return;
      if(files.length>limitImages){message.textContent='Choose up to '+limitImages+' pictures at once.';return;}
      const issue=files.map(validate).find(Boolean);
      if(issue){message.textContent=issue;return;}
      if(title.value.trim()!==group.label||desc.value.trim()!==group.description.trim()){
        message.textContent='Save your title and description changes before adding pictures.';return;
      }
      save.disabled=true;add.disabled=true;
      message.textContent='Adding pictures…';
      try{
        await addToGroup(group,files,message);
        await refreshGallery();
        setStatus(files.length+' picture'+(files.length===1?'':'s')+' added to '+group.label+'.');
      }catch(err){
        await refreshGallery();
        setStatus('Some pictures may have been added. '+err.message);
      }
    });
    const actions=make('div','ptiArtEditActions');
    const save=make('button','ptiArtEditSave','Save changes');save.type='button';
    const cancel=make('button','','Cancel');cancel.type='button';
    const message=make('p','ptiArtEditorStatus');message.setAttribute('role','status');
    save.addEventListener('click',async()=>{
      const newTitle=title.value.trim(),newNote=desc.value.trim();
      if(!newTitle||newTitle.length>90){message.textContent='Title must be 1–90 characters.';return;}
      if(newNote.length>2000){message.textContent='Description must be at most 2,000 characters.';return;}
      save.disabled=true;cancel.disabled=true;add.disabled=true;
      message.textContent='Saving changes…';
      try{
        const {error}=await db.rpc('character_art_update_group',{
          p_character:character,p_group:group.id,p_label:newTitle,p_description:newNote
        });
        if(error)throw error;
        openEditorGroup=null;
        await refreshGallery();
        setStatus('Illustration details saved.');
      }catch(err){message.textContent='Unable to save: '+err.message;
        save.disabled=false;cancel.disabled=false;add.disabled=false;
      }
    });
    cancel.addEventListener('click',()=>{openEditorGroup=null;paintGallery();});
    actions.append(save,cancel);
    editor.append(label,descLabel,photoTitle,existing,add,addFile,actions,message);
    section.append(editor);
  }


  function setUploadPanel(open){
    if(!canUpload)return;
    controls.hidden=!open;
    addButton.setAttribute('aria-expanded',String(open));
    addButton.textContent=open?'− Hide form':'＋ Add illustration';
  }

  addButton?.addEventListener('click',()=>setUploadPanel(controls.hidden));

  function paintPortrait(){
    const current=illustrations.find(entry=>entry.is_avatar&&imageUrl(entry.path));
    if(current){
      portraitImage.src=imageUrl(current.path);
      portraitImage.alt=current.label+' — current chat avatar for '+character;
      portraitImage.hidden=false;
      portraitSilhouette.hidden=true;
      portraitHint.textContent='Current chat portrait · Select to view illustrations';
    }else{
      portraitImage.hidden=true;
      portraitImage.removeAttribute('src');
      portraitSilhouette.hidden=false;
      portraitHint.textContent=illustrations.length?
        'No active portrait selected':'No portrait yet · Illustrations will appear below';
    }
    portraitSlot?.classList.toggle('isEditableEmpty',!current&&canUpload);
    portraitButton.setAttribute('aria-label',(canUpload?'Choose':'View')+' '+character+"'s portrait from saved illustrations");
    portraitButton.title=canUpload?'Choose your chat avatar from saved illustrations':'View available character portraits';
  }

  function paintGallery(){
    gallery.replaceChildren();
    const groups=groupedIllustrations();
    if(!groups.length){
      gallery.append(make('p','ptiArtQuiet','No illustrations yet. A portrait will appear here when one is uploaded.'));
      return;
    }
    for(const group of groups){
      const section=make('section','ptiArtEntry');
      const headingRow=make('div','ptiArtEntryHeading');
      const heading=make('h4','ptiArtEntryTitle',group.label);
      headingRow.append(heading);
      if(canUpload){
        const action=make('button','ptiArtEditAction',openEditorGroup===group.id?'Close edit':'Edit');
        action.type='button';action.setAttribute('aria-expanded',String(openEditorGroup===group.id));
        action.onclick=()=>{
          openEditorGroup=openEditorGroup===group.id?null:group.id;
          paintGallery();
        };
        headingRow.append(action);
      }
      const layout=make('div','ptiArtEntryLayout');
      const media=make('div','ptiArtEntryMedia');
      for(const entry of group.images){
        const url=imageUrl(entry.path);
        if(!url)continue;
        const link=make('a','ptiArtImageLink');
        link.href=url;link.target='_blank';link.rel='noopener noreferrer';
        link.title='Open full-size illustration: '+group.label;
        const img=make('img','ptiArtImage');
        img.src=url;img.alt=group.label+' — '+character;
        img.loading='lazy';img.decoding='async';
        link.append(img);media.append(link);
      }
      const notes=make('div','ptiArtEntryNotes');
      if(group.description){
        const caption=make('p','ptiArtCaption');
        formatDescription(caption,group.description);
        notes.append(caption);
      }else{
        notes.append(make('p','ptiArtQuiet','Appearance details have not been added.'));
      }
      layout.append(media,notes);
      section.append(headingRow,layout);
      if(openEditorGroup===group.id&&canUpload)renderEditor(group,section);
      gallery.append(section);
    }
  }

  function paintPicker(){
    choices.replaceChildren();
    dialogHelp.textContent=canUpload?
      'Choose one of the saved illustrations. This also changes the avatar displayed beside '+character+"'s chat messages.":
      'These are the saved portraits. Only the registered character owner can change the chat avatar.';
    if(!illustrations.length){
      choices.append(make('p','ptiArtQuiet','No illustrations have been uploaded yet.'));
      if(canUpload){
        const jump=make('button','ptiAvatarJump','Go to Add illustration');
        jump.type='button';
        jump.onclick=()=>{
          dialog.close();
          setUploadPanel(true);
          controls.scrollIntoView({behavior:'smooth',block:'center'});
        };
        choices.append(jump);
      }
      return;
    }
    for(const entry of illustrations){
      const url=imageUrl(entry.path);
      if(!url)continue;
      const tile=make(canUpload?'button':'div','ptiAvatarChoice'+(entry.is_avatar?' isCurrent':''));
      if(canUpload){
        tile.type='button';tile.setAttribute('aria-pressed',String(!!entry.is_avatar));
        tile.setAttribute('aria-label','Use '+entry.label+' as the chat avatar');
      }
      const img=make('img','');
      img.src=url;img.alt=entry.label;img.loading='lazy';
      const label=make('span','ptiAvatarChoiceName',entry.label);
      const flag=make('small','',entry.is_avatar?'Current avatar':'');
      tile.append(img,label,flag);
      if(canUpload)tile.onclick=async()=>{
        if(entry.is_avatar){dialog.close();return;}
        for(const button of choices.querySelectorAll('button'))button.disabled=true;
        dialogHelp.textContent='Updating the chat portrait…';
        const {data,error}=await db.rpc('character_art_activate',{
          p_character:character,p_id:entry.id
        });
        if(error){
          dialogHelp.textContent='Unable to change the portrait: '+error.message;
          for(const button of choices.querySelectorAll('button'))button.disabled=false;
          return;
        }
        illustrations=Array.isArray(data)?data:illustrations;
        paintPortrait();paintGallery();
        dialog.close();
        status.textContent='The active chat portrait is now '+entry.label+'.';
      };
      choices.append(tile);
    }
  }

  async function refreshGallery(){
    const {data,error}=await db.rpc('character_art_gallery',{p_character:character});
    if(error){status.textContent='Unable to load illustrations: '+error.message;return;}
    illustrations=Array.isArray(data)?data:[];
    paintGallery();paintPortrait();
  }

  const openPortraitPicker=()=>{
    paintPicker();
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
  };
  portraitButton?.addEventListener('click',openPortraitPicker);
  editPortraitButton?.addEventListener('click',openPortraitPicker);
  dialog.querySelector('.ptiAvatarClose')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)dialog.close();
  });

  function validate(file){
    if(!file)return 'Choose a PNG, JPEG or WebP image first.';
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))
      return 'Only PNG, JPEG and WebP images are allowed.';
    if(!file.size)return 'The selected file is empty.';
    if(file.size>3*1024*1024)return 'Each picture must be smaller than 3 MiB.';
    return '';
  }
  function selectFiles(files){
    const selected=[...files||[]];
    if(!selected.length)return;
    if(selected.length>limitImages){
      selectedFiles=[];uploadButton.disabled=true;
      setStatus('Choose up to '+limitImages+' pictures at once.');return;
    }
    const issue=selected.map(validate).find(Boolean);
    if(issue){selectedFiles=[];uploadButton.disabled=true;setStatus(issue);return;}
    selectedFiles=selected;
    uploadButton.disabled=false;
    setStatus('Selected '+selected.length+' picture'+(selected.length===1?'':'s')+'.');
    if(!titleInput.value.trim())
      titleInput.value=selected[0].name.replace(/\.[^/.]+$/,'').replace(/[-_]+/g,' ').slice(0,90);
  }

  fileButton?.addEventListener('click',()=>fileInput.click());
  fileInput?.addEventListener('change',()=>selectFiles(fileInput.files));
  const drop=root.querySelector('.ptiArtDrop');
  for(const name of ['dragenter','dragover'])drop?.addEventListener(name,event=>{
    event.preventDefault();drop.classList.add('dragOver');
  });
  for(const name of ['dragleave','drop'])drop?.addEventListener(name,event=>{
    event.preventDefault();drop.classList.remove('dragOver');
  });
  drop?.addEventListener('drop',event=>selectFiles(event.dataTransfer?.files));

  uploadButton?.addEventListener('click',async()=>{
    if(!canUpload||!selectedFiles.length)return;
    const label=titleInput.value.trim(),description=noteInput.value.trim();
    if(!label||label.length>90){setStatus('Give the entry a title (up to 90 characters).');return;}
    if(description.length>2000){setStatus('Description must be at most 2,000 characters.');return;}
    const files=[...selectedFiles];
    uploadButton.disabled=true;
    let groupId=null,uploaded=0;
    try{
      for(const file of files){
        setStatus('Uploading picture '+(uploaded+1)+' of '+files.length+'…');
        const path=await uploadPhoto(file);
        const {data,error}=await db.rpc('character_art_register_group',{
          p_character:character,p_path:path,p_label:label,
          p_description:description,p_group:groupId
        });
        if(error){
          await db.storage.from(bucket).remove([path]).catch(()=>{});
          throw error;
        }
        groupId=data?.group_id;
        if(!groupId)throw Error('The new illustration record could not be confirmed.');
        uploaded++;
      }
      selectedFiles=[];fileInput.value='';titleInput.value='';noteInput.value='';
      setUploadPanel(false);openEditorGroup=null;
      await refreshGallery();
      setStatus(label+' has been added with '+uploaded+' picture'+(uploaded===1?'':'s')+'.');
    }catch(error){
      // Successful photos are retained; only retry the unsubmitted files.
      selectedFiles=files.slice(uploaded);
      if(groupId){openEditorGroup=groupId;setUploadPanel(false);}
      await refreshGallery();
      setStatus('Uploaded '+uploaded+' picture'+(uploaded===1?'':'s')+' before an issue: '+error.message);
    }finally{
      uploadButton.disabled=!selectedFiles.length;
    }
  });

  async function initialize(){
    // The viewer and profile portrait are public. Editing is only for the
    // authenticated character owner — never for arbitrary logged-in visitors.
    const {data}=await db.auth.getUser();
    if(data?.user){
      const editor=await db.rpc('character_art_editor',{p_character:character});
      canUpload=!editor.error&&!!editor.data?.can_upload;
    }
    addButton.hidden=!canUpload;
    controls.hidden=true;
    await refreshGallery();
  }
  initialize().catch(error=>{
    status.textContent='Illustrations are temporarily unavailable: '+error.message;
  });
}
