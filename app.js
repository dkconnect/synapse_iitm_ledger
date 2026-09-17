import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://kxygjwhppuxysvjwnwoc.supabase.co";
const SUPABASE_KEY = "sb_publishable_6RvwuZZfDgvyus4BXcrMdw_hHyV_gyD";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
let profile = null, activeTerm = null, cachedLogs = [], filteredLogs = [];

const authView=$('authView'), appView=$('appView'), loginForm=$('loginForm'), authMessage=$('authMessage');
const eventForm=$('eventForm'), formMessage=$('formMessage'), logList=$('logList'), ledgerStatus=$('ledgerStatus');

function message(el,text,type='error'){el.textContent=text;el.className=`message ${type}`}
function clearMessage(el){el.textContent='';el.className='message hidden'}
function isExecutive(){return profile?.role==='executive'}
function prettyDate(value){if(!value)return '—';return new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${value}T00:00:00`))}
function safeUrl(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}}
function displayDepartment(log){return log.entry_tag==='EXECUTIVE'?'Executive':(log.departments?.name || 'Department')}

async function loadProfile(userId){
  const {data,error}=await supabase.from('profiles').select('name,email,role,position,tag,department_id,departments(name)').eq('id',userId).single();
  if(error) throw error; profile=data;
  const {data:term}=await supabase.from('terms').select('id,name').eq('is_active',true).order('id',{ascending:false}).limit(1).maybeSingle();
  activeTerm=term;
}

function renderIdentity(){
  $('welcomeName').textContent=profile.name;
  const dept=profile.departments?.name;
  $('welcomeMeta').textContent=[profile.position,dept].filter(Boolean).join(' · ')+(isExecutive()?' · Full ledger access':' · Personal ledger access');
  $('tagBadge').textContent=profile.tag || (isExecutive()?'Executive':dept || 'Department');
  $('roleBadge').textContent=isExecutive()?'Executive access':'Department access';
  $('accessLabel').textContent=isExecutive()?'Secretariat oversight':'Department workspace';
  $('entryTagPreview').textContent=isExecutive()?'EXECUTIVE':(profile.tag || dept || 'DEPARTMENT');
  $('ledgerHeading').textContent=isExecutive()?'Central ledger':'My ledger';
  $('termPill').textContent=`Term ${activeTerm?.name || '—'}`;
  $('executiveFilters').classList.toggle('hidden',!isExecutive());
  $('exportControls').classList.toggle('hidden',!isExecutive());
}

async function enterApp(user){
  try{await loadProfile(user.id);authView.classList.add('hidden');appView.classList.remove('hidden');renderIdentity();await loadFilterOptions();await loadLogs();}
  catch(err){await supabase.auth.signOut();appView.classList.add('hidden');authView.classList.remove('hidden');message(authMessage,`Unable to load your Synapse profile: ${err.message}`)}
}

loginForm.addEventListener('submit',async(e)=>{
  e.preventDefault();clearMessage(authMessage);$('loginButton').disabled=true;$('loginButton').textContent='Signing in…';
  const {data,error}=await supabase.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});
  $('loginButton').disabled=false;$('loginButton').textContent='Access ledger';
  if(error){message(authMessage,error.message);return}loginForm.reset();await enterApp(data.user);
});

$('logoutButton').addEventListener('click',async()=>{await supabase.auth.signOut();profile=null;activeTerm=null;cachedLogs=[];appView.classList.add('hidden');authView.classList.remove('hidden');clearMessage(authMessage)});

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn));
  const ledger=btn.dataset.pane==='ledger';$('newPane').classList.toggle('hidden',ledger);$('ledgerPane').classList.toggle('hidden',!ledger);if(ledger)loadLogs();
}));

eventForm.addEventListener('submit',async(e)=>{
  e.preventDefault();clearMessage(formMessage);const button=$('submitEvent');button.disabled=true;button.textContent='Appending…';
  const date=$('eventDate').value; const day=new Intl.DateTimeFormat('en-US',{weekday:'long'}).format(new Date(`${date}T12:00:00`));
  const reg=$('eventRegistrations').value;
  const payload={created_by:(await supabase.auth.getUser()).data.user.id,day_of_week:day,event_date:date,title:$('eventTitle').value.trim(),event_type:$('eventType').value.trim(),description:$('eventDescription').value.trim(),registrations:reg===''?null:Number(reg),participants:Number($('eventParticipants').value),youtube_link:$('eventYoutube').value.trim()||null,drive_link:$('eventDrive').value.trim()};
  const {error}=await supabase.from('event_logs').insert(payload);
  button.disabled=false;button.textContent='Append to ledger';
  if(error){message(formMessage,error.message);return}
  eventForm.reset();message(formMessage,'Entry added to the central ledger.','success');await loadLogs();
});

async function loadFilterOptions(){
  if(!isExecutive()) return;
  const {data:departments}=await supabase.from('departments').select('id,name').order('name');
  const select=$('departmentFilter');select.innerHTML='<option value="ALL">All departments</option><option value="EXECUTIVE">Executive entries</option>';
  (departments||[]).forEach(d=>select.add(new Option(d.name,String(d.id))));
}

async function loadLogs(){
  ledgerStatus.classList.remove('hidden');ledgerStatus.textContent='Loading records…';logList.innerHTML='';
  const {data,error}=await supabase.from('event_logs').select('id,term_id,title,event_date,event_type,description,registrations,participants,youtube_link,drive_link,created_at,entry_tag,department_id,created_by,departments(name),profiles!event_logs_created_by_fkey(name,position,tag)').order('event_date',{ascending:false}).order('created_at',{ascending:false});
  if(error){ledgerStatus.textContent=`Unable to load records: ${error.message}`;return}
  cachedLogs=(data||[]).filter(x=>!activeTerm || x.term_id===activeTerm.id);populateTypeFilter();applyFilters();
}

function populateTypeFilter(){if(!isExecutive())return;const select=$('typeFilter'),current=select.value;const types=[...new Set(cachedLogs.map(x=>x.event_type).filter(Boolean))].sort();select.innerHTML='<option value="ALL">All types</option>';types.forEach(t=>select.add(new Option(t,t)));if([...select.options].some(o=>o.value===current))select.value=current}

function applyFilters(){
  let rows=[...cachedLogs];
  if(isExecutive()){
    const q=$('searchFilter').value.trim().toLowerCase(),dept=$('departmentFilter').value,type=$('typeFilter').value;
    if(q)rows=rows.filter(x=>[x.title,x.description,x.event_type,x.profiles?.name,x.departments?.name].some(v=>String(v||'').toLowerCase().includes(q)));
    if(dept==='EXECUTIVE')rows=rows.filter(x=>x.entry_tag==='EXECUTIVE');else if(dept!=='ALL')rows=rows.filter(x=>String(x.department_id)===dept);
    if(type!=='ALL')rows=rows.filter(x=>x.event_type===type);
  }
  filteredLogs=rows;renderStats(rows);renderLogs(rows);
}

function renderStats(rows){
  $('statRecords').textContent=rows.length;
  $('statParticipants').textContent=rows.reduce((sum,x)=>sum+(Number(x.participants)||0),0).toLocaleString('en-IN');
  const depts=new Set(rows.map(displayDepartment));$('statDepartments').textContent=depts.size;
}

function renderLogs(rows){
  if(!rows.length){ledgerStatus.classList.remove('hidden');ledgerStatus.textContent='No records found for this view.';logList.innerHTML='';return}
  ledgerStatus.classList.add('hidden');logList.innerHTML='';
  rows.forEach(log=>{
    const card=document.createElement('article');card.className='log-card';
    const top=document.createElement('div');top.className='log-top';
    const tags=document.createElement('div');tags.className='log-tags';
    const tag=document.createElement('span');tag.className=`pill ${log.entry_tag==='EXECUTIVE'?'gold':''}`;tag.textContent=log.entry_tag==='EXECUTIVE'?'EXECUTIVE':(log.profiles?.tag || displayDepartment(log));tags.appendChild(tag);
    const dept=document.createElement('span');dept.className='pill subtle';dept.textContent=displayDepartment(log);tags.appendChild(dept);
    const type=document.createElement('span');type.className='pill';type.textContent=log.event_type;top.append(tags,type);card.appendChild(top);
    const h=document.createElement('h3');h.textContent=log.title;card.appendChild(h);
    const meta=document.createElement('div');meta.className='log-meta';meta.textContent=`${prettyDate(log.event_date)} · Logged by ${log.profiles?.name || 'Synapse member'}${log.profiles?.position?` (${log.profiles.position})`:''}`;card.appendChild(meta);
    const desc=document.createElement('p');desc.className='log-desc';desc.textContent=log.description;card.appendChild(desc);
    const metrics=document.createElement('div');metrics.className='metrics';
    const reg=document.createElement('span');reg.className='metric';reg.textContent=`Registrations: ${log.registrations ?? 'Open / N.A.'}`;
    const part=document.createElement('span');part.className='metric';part.textContent=`Participants: ${log.participants}`;metrics.append(reg,part);card.appendChild(metrics);
    const links=document.createElement('div');links.className='links';let has=false;
    const drive=safeUrl(log.drive_link);if(drive){const a=document.createElement('a');a.href=drive;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open asset folder ↗';links.appendChild(a);has=true}
    const yt=safeUrl(log.youtube_link);if(yt){const a=document.createElement('a');a.href=yt;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Watch recording ↗';links.appendChild(a);has=true}if(has)card.appendChild(links);
    logList.appendChild(card);
  });
}

['searchFilter','departmentFilter','typeFilter'].forEach(id=>$(id)?.addEventListener(id==='searchFilter'?'input':'change',applyFilters));
$('refreshButton').addEventListener('click',loadLogs);

function exportRows(){
  return $('exportScope').value==='ALL' ? [...cachedLogs] : [...filteredLogs];
}
function exportBaseName(){
  const term=(activeTerm?.name||'active-term').replace(/[^a-z0-9_-]+/gi,'-');
  const scope=$('exportScope').value==='ALL'?'complete':'filtered';
  return `synapse-ledger-${term}-${scope}`;
}
function downloadFile(content,mime,extension){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${exportBaseName()}.${extension}`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function exportObject(log){
  return {id:log.id,date:log.event_date,type:log.event_type,title:log.title,tag:log.entry_tag==='EXECUTIVE'?'Executive':(log.profiles?.tag||displayDepartment(log)),department:displayDepartment(log),logged_by:log.profiles?.name||'Synapse member',position:log.profiles?.position||'',description:log.description,registrations:log.registrations,participants:log.participants,recording_link:log.youtube_link||'',asset_link:log.drive_link||'',created_at:log.created_at};
}
function csvCell(value){const s=String(value??'');return `"${s.replaceAll('"','""')}"`}
function exportTxt(){
  const rows=exportRows();let out=`SYNAPSE — IIT MADRAS BS\nOPERATIONS LEDGER\nTERM ${activeTerm?.name||'—'}\n${'='.repeat(64)}\n\n`;
  rows.forEach((log,i)=>{const x=exportObject(log);out+=`LOG #${String(i+1).padStart(3,'0')}\nDate: ${x.date}\nTag: ${x.tag}\nDepartment: ${x.department}\nType: ${x.type}\nTitle: ${x.title}\nLogged by: ${x.logged_by}${x.position?` (${x.position})`:''}\n\n${x.description}\n\nRegistrations: ${x.registrations??'Open / N.A.'}\nParticipants: ${x.participants}\nRecording: ${x.recording_link||'—'}\nAssets: ${x.asset_link||'—'}\n${'-'.repeat(64)}\n\n`;});
  downloadFile(out,'text/plain;charset=utf-8','txt');
}
function exportCsv(){
  const rows=exportRows().map(exportObject);const headers=['id','date','type','title','tag','department','logged_by','position','description','registrations','participants','recording_link','asset_link','created_at'];
  const csv=[headers.map(csvCell).join(','),...rows.map(r=>headers.map(h=>csvCell(r[h])).join(','))].join('\r\n');downloadFile('\ufeff'+csv,'text/csv;charset=utf-8','csv');
}
function exportJson(){downloadFile(JSON.stringify(exportRows().map(exportObject),null,2),'application/json;charset=utf-8','json')}
$('exportTxt').addEventListener('click',exportTxt);$('exportCsv').addEventListener('click',exportCsv);$('exportJson').addEventListener('click',exportJson);


const {data:{session}}=await supabase.auth.getSession();if(session?.user)await enterApp(session.user);
