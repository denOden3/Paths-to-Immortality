const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const {parseHTML}=require(process.env.PORTAL_DOM_MODULE||'/tmp/paths-qa/node_modules/linkedom');
const html=fs.readFileSync('index.html','utf8');const {document,window}=parseHTML(html);
const mq={matches:false,addEventListener:(type,fn)=>{mq.change=fn}};window.matchMedia=()=>mq;
vm.runInNewContext(fs.readFileSync('public-shell.js','utf8'),{document,window,URL,location:{href:'https://denoden3.github.io/Paths-to-Immortality/index.html',pathname:'/Paths-to-Immortality/index.html'},history:{replaceState(){}}});
const app=document.querySelector('.app'),toggle=document.getElementById('pti-nav-toggle');
assert.equal(toggle.getAttribute('aria-expanded'),'true');toggle.onclick();assert.ok(app.classList.contains('sidebarClosed'));assert.equal(toggle.getAttribute('aria-expanded'),'false');toggle.onclick();assert.equal(toggle.getAttribute('aria-expanded'),'true');
mq.matches=true;mq.change();assert.equal(toggle.getAttribute('aria-expanded'),'false');toggle.onclick();assert.ok(app.classList.contains('sidebarOpen'));assert.equal(document.getElementById('pti-shade').hidden,false);document.getElementById('pti-shade').onclick();assert.ok(!app.classList.contains('sidebarOpen'));
assert.equal(document.getElementById('pti-sources'),null);assert.equal(document.querySelector('.ptiRibbon'),null);
const data={};vm.runInNewContext(fs.readFileSync('reference-data.js','utf8'),{window:data});
for(const [id,ref] of Object.entries(data.PTI_REFERENCES)){const {document:d}=parseHTML(fs.readFileSync('codex/'+id+'.html','utf8'));assert.equal(d.querySelector('pre').textContent,ref.text);assert.equal(d.querySelector('[aria-current="page"]').getAttribute('href'),'../codex/'+id+'.html');}
for(const file of ['index.html',...Object.keys(data.PTI_REFERENCES).map(k=>'codex/'+k+'.html')]){const {document:d}=parseHTML(fs.readFileSync(file,'utf8'));for(const a of d.querySelectorAll('#pti-sidebar a')){const target=a.getAttribute('href').split('#')[0];assert.ok(fs.existsSync(path.resolve(path.dirname(file),target)),file+' broken link '+target)}}
console.log('PASS: desktop collapse, mobile drawer open/close, separate Codex content parity, active pages and sidebar links');
