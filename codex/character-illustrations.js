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
  const gallery=root.querySelector('.ptiArtGallery');
  const status=root.querySelector('.ptiArtStatus');
  const controls=root.querySelector('.ptiArtControls');
  const fileInput=root.querySelector('.ptiArtFile');
  const fileButton=root.querySelector('.ptiArtPick');
  const uploadButton=root.querySelector('.ptiArtUpload');
  const titleInput=root.querySelector('.ptiArtLabel');
  const noteInput=root.querySelector('.ptiArtNote');
  const portraitButton=document.querySelector('#pti-avatar-trigger');
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
  let illustrations=[],canUpload=false,selected=null;

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
    portraitButton.classList.toggle('isReadOnly',!canUpload);
    portraitButton.setAttribute('aria-label',(canUpload?'Choose':'View')+' '+character+"'s portrait from saved illustrations");
    portraitButton.title=canUpload?'Choose your chat avatar from saved illustrations':'View available character portraits';
  }

  function paintGallery(){
    gallery.replaceChildren();
    if(!illustrations.length){
      gallery.append(make('p','ptiArtQuiet','No illustrations yet. A portrait will appear here when one is uploaded.'));
      return;
    }
    for(const entry of illustrations){
      const artUrl=imageUrl(entry.path);
      if(!artUrl)continue;
      const section=make('section','ptiArtEntry');
      const heading=make('h4','ptiArtEntryTitle',entry.label);
      const layout=make('div','ptiArtEntryLayout');
      const link=make('a','ptiArtImageLink');
      link.href=artUrl;link.target='_blank';link.rel='noopener noreferrer';
      link.title='Open full-size illustration: '+entry.label;
      const img=make('img','ptiArtImage');
      img.src=artUrl;img.alt=entry.label+' — '+character;
      img.loading='lazy';img.decoding='async';
      link.append(img);
      const notes=make('div','ptiArtEntryNotes');
      if(entry.description){
        notes.append(make('p','ptiArtCaption',entry.description));
      }else{
        notes.append(make('p','ptiArtQuiet','Appearance details have not been added.'));
      }
      if(entry.is_avatar){
        notes.append(make('p','ptiArtActive','✦ Current chat portrait'));
      }
      notes.append(make('p','ptiArtImageTip','Select the circular portrait above to change the active chat avatar. Click this picture to view it at full size.'));
      layout.append(link,notes);
      section.append(heading,layout);
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
          controls.open=true;
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

  portraitButton?.addEventListener('click',()=>{
    paintPicker();
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
  });
  dialog.querySelector('.ptiAvatarClose')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)dialog.close();
  });

  function validate(file){
    if(!file)return 'Choose a PNG, JPEG or WebP image first.';
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))
      return 'Only PNG, JPEG and WebP images are allowed.';
    if(!file.size)return 'The selected file is empty.';
    if(file.size>3*1024*1024)return 'The illustration must be smaller than 3 MiB.';
    return '';
  }
  function selectFile(file){
    const error=validate(file);
    if(error){selected=null;uploadButton.disabled=true;status.textContent=error;return;}
    selected=file;uploadButton.disabled=false;
    status.textContent='Selected: '+file.name;
    if(!titleInput.value.trim())
      titleInput.value=file.name.replace(/\.[^/.]+$/,'').replace(/[-_]+/g,' ').slice(0,90);
  }

  fileButton?.addEventListener('click',()=>fileInput.click());
  fileInput?.addEventListener('change',()=>selectFile(fileInput.files?.[0]));
  const drop=root.querySelector('.ptiArtDrop');
  for(const name of ['dragenter','dragover'])drop?.addEventListener(name,e=>{
    e.preventDefault();drop.classList.add('dragOver');
  });
  for(const name of ['dragleave','drop'])drop?.addEventListener(name,e=>{
    e.preventDefault();drop.classList.remove('dragOver');
  });
  drop?.addEventListener('drop',e=>selectFile(e.dataTransfer?.files?.[0]));

  uploadButton?.addEventListener('click',async()=>{
    if(!canUpload)return;
    const issue=validate(selected);
    if(issue){status.textContent=issue;return;}
    const label=titleInput.value.trim(),description=noteInput.value.trim();
    if(!label||label.length>90){
      status.textContent='Give the illustration a title (up to 90 characters).';return;
    }
    if(description.length>500){status.textContent='The description must be at most 500 characters.';return;}
    uploadButton.disabled=true;status.textContent='Uploading '+label+'…';
    try{
      const {data:auth,error:authError}=await db.auth.getUser();
      if(authError||!auth?.user)throw Error('Sign in again before uploading.');
      const editor=await db.rpc('character_art_editor',{p_character:character});
      if(editor.error||!editor.data?.can_upload)throw Error('This account cannot edit '+character+".");
      const extension=selected.type==='image/png'?'png':selected.type==='image/webp'?'webp':'jpg';
      const path=auth.user.id+'/'+editor.data.slug+'/'+crypto.randomUUID()+'.'+extension;
      const {error:storageError}=await db.storage.from(bucket).upload(path,selected,{
        cacheControl:'3600',contentType:selected.type,upsert:false
      });
      if(storageError)throw storageError;
      const {error:registerError}=await db.rpc('character_art_register',{
        p_character:character,p_path:path,p_label:label,p_description:description
      });
      if(registerError)throw registerError;
      selected=null;fileInput.value='';titleInput.value='';noteInput.value='';
      controls.open=false;
      await refreshGallery();
      status.textContent=label+' has been added to Illustrations.'+
        (illustrations.length===1?' It is also the first chat avatar.':'');
    }catch(error){
      status.textContent='Unable to save illustration: '+error.message;
    }finally{
      uploadButton.disabled=false;
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
    controls.hidden=!canUpload;
    await refreshGallery();
  }
  initialize().catch(error=>{
    status.textContent='Illustrations are temporarily unavailable: '+error.message;
  });
}
