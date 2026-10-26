// Public character illustrations — images are uploaded by the authenticated
// character owner into Supabase Storage, never GitHub Pages or a Notion URL.
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
  const slot=root.querySelector('.ptiArtGallery');
  const status=root.querySelector('.ptiArtStatus');
  const controls=root.querySelector('.ptiArtControls');
  const fileInput=root.querySelector('.ptiArtFile');
  const fileButton=root.querySelector('.ptiArtPick');
  const upload=root.querySelector('.ptiArtUpload');
  const title=root.querySelector('.ptiArtLabel');
  const note=root.querySelector('.ptiArtNote');
  const make=(tag,cls,copy)=>{
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(copy!==undefined)n.textContent=copy;
    return n;
  };
  function publicImage(path){
    if(typeof path!=='string'||!path.startsWith(''))return '';
    return supabaseUrl+'/storage/v1/object/public/'+bucket+'/' +
      path.split('/').map(encodeURIComponent).join('/');
  }
  let canUpload=false;
  async function refresh(){
    const {data,error}=await db.rpc('character_art_gallery',{p_character:character});
    if(error){status.textContent='Illustrations could not be loaded: '+error.message;return;}
    slot.replaceChildren();
    const illustrations=Array.isArray(data)?data:[];
    if(!illustrations.length){
      const empty=make('div','ptiArtEmpty');
      empty.append(make('span','ptiArtEmptyIcon','🖼️'),
        make('strong','','No illustrations yet'),
        make('p','','This space will display character portraits once they are uploaded.'));
      slot.append(empty);
    }
    for(const entry of illustrations){
      const card=make('figure','ptiArtCard');
      const img=make('img','ptiArtImage');
      img.src=publicImage(entry.path);img.alt=entry.label+' — '+character;
      img.loading='lazy';img.decoding='async';
      const fig=make('figcaption','');
      fig.append(make('strong','',entry.label));
      if(entry.description)fig.append(make('p','ptiArtCaption',entry.description));
      if(entry.is_avatar)fig.append(make('span','ptiArtActive','Current chat avatar'));
      else if(canUpload){
        const button=make('button','ptiArtUseAvatar','Use as chat avatar');
        button.type='button';
        button.onclick=async()=>{
          button.disabled=true;status.textContent='Changing avatar…';
          const {error:err}=await db.rpc('character_art_activate',{p_character:character,p_id:entry.id});
          if(err){status.textContent='Avatar could not be changed: '+err.message;button.disabled=false;return;}
          status.textContent='Chat avatar updated. The room will show it after refresh.';
          await refresh();
        };
        fig.append(button);
      }
      card.append(img,fig);slot.append(card);
    }
    if(!status.textContent.startsWith('Chat avatar updated'))status.textContent='';
  }
  async function initialize(){
    const {data}=await db.auth.getUser();
    if(data?.user){
      const result=await db.rpc('character_art_editor',{p_character:character});
      canUpload=!result.error&&!!result.data?.can_upload;
    }
    controls.hidden=!canUpload;
    if(!canUpload){
      const help=make('p','ptiArtGuest','Viewing is public. To upload pictures, sign in to Paths Web as this character’s registered player.');
      const link=make('a','','Open Paths Web sign-in');link.href='../index.html#guest';help.append(' ',link);
      root.append(help);
    }
    await refresh();
  }
  function invalid(file){
    if(!file)return 'Choose a PNG, JPEG or WebP image first.';
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))return 'Only PNG, JPEG and WebP images are allowed.';
    if(file.size>3*1024*1024)return 'Please use an image under 3 MiB.';
    if(!file.size)return 'The selected image is empty.';
    return '';
  }
  let selected=null;
  function selectFile(file){
    const error=invalid(file);
    if(error){selected=null;status.textContent=error;return;}
    selected=file;
    status.textContent='Selected: '+file.name;
    if(!title.value.trim())title.value=file.name.replace(/\.[^/.]+$/,'').replace(/[-_]+/g,' ').slice(0,90);
    upload.disabled=false;
  }
  fileButton?.addEventListener('click',()=>fileInput.click());
  fileInput?.addEventListener('change',()=>selectFile(fileInput.files?.[0]));
  const drop=root.querySelector('.ptiArtDrop');
  for(const type of ['dragenter','dragover'])drop?.addEventListener(type,e=>{e.preventDefault();drop.classList.add('dragOver');});
  for(const type of ['dragleave','drop'])drop?.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('dragOver');});
  drop?.addEventListener('drop',e=>selectFile(e.dataTransfer?.files?.[0]));
  upload?.addEventListener('click',async()=>{
    if(!canUpload)return;
    const issue=invalid(selected);
    if(issue){status.textContent=issue;return;}
    const label=title.value.trim(),description=note.value.trim();
    if(!label||label.length>90){status.textContent='Enter an illustration title (up to 90 characters).';return;}
    if(description.length>500){status.textContent='The note can be up to 500 characters.';return;}
    upload.disabled=true;status.textContent='Uploading illustration…';
    try{
      const {data:me,error:authError}=await db.auth.getUser();
      if(authError||!me?.user)throw Error('Your sign-in has expired.');
      const editor=await db.rpc('character_art_editor',{p_character:character});
      if(editor.error||!editor.data?.can_upload)throw Error('You no longer have permission to edit this character.');
      const extension=selected.type==='image/png'?'png':selected.type==='image/webp'?'webp':'jpg';
      const path=me.user.id+'/'+editor.data.slug+'/'+crypto.randomUUID()+'.'+extension;
      const {error:storageError}=await db.storage.from(bucket).upload(path,selected,{
        cacheControl:'3600',contentType:selected.type,upsert:false
      });
      if(storageError)throw storageError;
      const {error:regError}=await db.rpc('character_art_register',{
        p_character:character,p_path:path,p_label:label,p_description:description
      });
      if(regError)throw regError;
      selected=null;fileInput.value='';title.value='';note.value='';
      status.textContent='Illustration saved. Your first picture becomes the default avatar.';
      await refresh();
    }catch(e){status.textContent='Upload could not be completed: '+e.message;}
    finally{upload.disabled=false;}
  });
  initialize().catch(e=>{status.textContent='Illustration service unavailable: '+e.message;});
}
