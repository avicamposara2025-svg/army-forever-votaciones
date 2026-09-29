import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://nryotlwywwlhrbjqqony.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MDCBv4UYZKy1KNPAafZnag_Hm1yot1m";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id)=>document.getElementById(id);
let participants=[], reasons=[], records=[], selectedDate=new Date().toISOString().slice(0,10);

function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function initials(name){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function dateText(d){return new Intl.DateTimeFormat("es-CO",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(d+"T12:00:00")).replace(/^./,m=>m.toUpperCase())}
function configured(){return SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length>20}
async function boot(){
  $("datePicker").value=selectedDate; $("selectedDateLabel").textContent=dateText(selectedDate);
  if(!configured()){ $("loginError").textContent="Configura primero SUPABASE_URL y SUPABASE_ANON_KEY en app.js."; return; }
  const {data:{session}}=await supabase.auth.getSession();
  if(session) showApp(); else showLogin();
  supabase.auth.onAuthStateChange((_e,session)=>session?showApp():showLogin());
}
function showLogin(){$("loginView").classList.remove("hidden");$("appView").classList.add("hidden")}
async function showApp(){$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");await loadAll()}
async function loadAll(){await Promise.all([loadParticipants(),loadReasons()]);await loadRecords();renderAll()}
async function loadParticipants(){const {data,error}=await supabase.from("participants").select("*").eq("active",true).order("name");if(error)return toast(error.message);participants=data||[]}
async function loadReasons(){const {data,error}=await supabase.from("reasons").select("*").eq("active",true).order("name");if(error)return toast(error.message);reasons=data||[]}
async function loadRecords(){const {data,error}=await supabase.from("daily_records").select("*, reasons(name), receipts(*)").eq("vote_date",selectedDate);if(error)return toast(error.message);records=data||[]}
function recordFor(pid){return records.find(r=>r.participant_id===pid)}
function renderAll(){ $("selectedDateLabel").textContent=dateText(selectedDate); renderStats(); renderDaily(); renderManageParticipants(); renderReasons(); }
function renderStats(){const total=participants.length;const voted=participants.filter(p=>recordFor(p.id)?.status==="voted").length;const justified=participants.filter(p=>recordFor(p.id)?.status==="justified").length; $("totalCount").textContent=total;$("votedCount").textContent=voted;$("justifiedCount").textContent=justified;$("pendingCount").textContent=Math.max(0,total-voted-justified)}
function renderDaily(){
  const el=$("participantsList"); if(!participants.length){el.innerHTML=`<div class="person-row"><div><strong>No hay participantes todavía.</strong><div class="person-sub">Agrega la primera desde “Participantes”.</div></div></div>`;return}
  el.innerHTML=participants.map(p=>{const r=recordFor(p.id);let cls="status-pending",txt="🔴 Pendiente";if(r?.status==="voted"){cls="status-voted";txt="🟢 Votó"}if(r?.status==="justified"){cls="status-justified";txt=`🟡 ${r.reasons?.name||"Justificada"}`}
    return `<div class="person-row"><div class="person-info"><div class="avatar">${initials(p.name)}</div><div><div class="person-name">${esc(p.name)}</div><div class="person-sub">${r?.receipts?.length?"📸 Comprobante guardado":"Sin comprobante"}</div></div></div><button class="status-pill ${cls}" data-record="${p.id}">${txt}</button></div>`}).join("");
  el.querySelectorAll("[data-record]").forEach(b=>b.onclick=()=>openRecord(b.dataset.record));
}
function renderManageParticipants(){ $("manageParticipants").innerHTML=participants.map(p=>`<div class="manage-row"><div class="person-info"><div class="avatar">${initials(p.name)}</div><strong>${esc(p.name)}</strong></div><div class="manage-actions"><button data-edit="${p.id}">✏️</button><button data-del="${p.id}">🗑️</button></div></div>`).join("")||`<div class="person-row">Aún no hay integrantes.</div>`; $("manageParticipants").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editParticipant(b.dataset.edit)); $("manageParticipants").querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteParticipant(b.dataset.del))}
function renderReasons(){ $("manageReasons").innerHTML=reasons.map(r=>`<div class="manage-row"><strong>${esc(r.name)}</strong><div class="manage-actions"><button data-edit-reason="${r.id}">✏️</button><button data-del-reason="${r.id}">🗑️</button></div></div>`).join("")||`<div class="person-row">Aún no hay motivos.</div>`; $("manageReasons").querySelectorAll("[data-edit-reason]").forEach(b=>b.onclick=()=>editReason(b.dataset.editReason)); $("manageReasons").querySelectorAll("[data-del-reason]").forEach(b=>b.onclick=()=>deleteReason(b.dataset.delReason))}
async function openRecord(pid){
  const p=participants.find(x=>x.id===pid),r=recordFor(pid);$("recordParticipantId").value=pid;$("recordId").value=r?.id||"";$("recordPerson").innerHTML=`<h3>${esc(p.name)}</h3><p class="person-sub">${dateText(selectedDate)}</p>`;$("recordStatus").value=r?.status||"pending";$("recordNotes").value=r?.notes||"";fillReason(r?.reason_id||"");$("receiptFile").value="";$("receiptName").textContent=r?.receipts?.length?"Comprobante guardado":"Ninguno";$("receiptPreview").innerHTML=r?.receipts?.[0]?.public_url?`<img src="${r.receipts[0].public_url}" alt="Comprobante">`:"";toggleReason();$("recordDialog").showModal()
}
function fillReason(val){$("recordReason").innerHTML=`<option value="">Selecciona un motivo</option>`+reasons.map(r=>`<option value="${r.id}" ${r.id===val?"selected":""}>${esc(r.name)}</option>`).join("")}
function toggleReason(){$("reasonWrap").style.display=$("recordStatus").value==="justified"?"block":"none"}
async function saveRecord(){
  const pid=$("recordParticipantId").value,status=$("recordStatus").value,reason_id=status==="justified"?($("recordReason").value||null):null,notes=$("recordNotes").value.trim();
  const payload={participant_id:pid,vote_date:selectedDate,status,reason_id,notes};
  let id=$("recordId").value;
  const q=id?supabase.from("daily_records").update(payload).eq("id",id).select().single():supabase.from("daily_records").upsert(payload,{onConflict:"participant_id,vote_date"}).select().single();
  const {data,error}=await q;if(error)return toast(error.message);id=data.id;
  const file=$("receiptFile").files[0];if(file){const ext=file.name.split(".").pop().toLowerCase();const path=`${id}/${crypto.randomUUID()}.${ext}`;const up=await supabase.storage.from("voting-receipts").upload(path,file,{upsert:true,contentType:file.type});if(up.error)return toast(up.error.message);const pub=supabase.storage.from("voting-receipts").getPublicUrl(path).data.publicUrl;const ins=await supabase.from("receipts").insert({daily_record_id:id,file_name:file.name,file_url:pub});if(ins.error)return toast(ins.error.message)}
  $("recordDialog").close();await loadRecords();renderAll();toast("Registro guardado 💜")
}
async function editParticipant(id){const p=participants.find(x=>x.id===id);$("participantDialogTitle").textContent="Editar integrante";$("participantId").value=p.id;$("participantName").value=p.name;$("participantDialog").showModal()}
async function deleteParticipant(id){const p=participants.find(x=>x.id===id);if(!confirm(`¿Eliminar a ${p.name}?\\n\\nSus registros anteriores se conservarán.`))return;const {error}=await supabase.from("participants").update({active:false}).eq("id",id);if(error)return toast(error.message);await loadParticipants();renderAll();toast("Integrante eliminada")}
async function saveParticipant(){const id=$("participantId").value,name=$("participantName").value.trim();if(!name)return;if(id){const {error}=await supabase.from("participants").update({name}).eq("id",id);if(error)return toast(error.message)}else{const {error}=await supabase.from("participants").insert({name,active:true});if(error)return toast(error.message)}$("participantDialog").close();await loadParticipants();renderAll();toast("Integrante guardada 💜")}
async function editReason(id){const r=reasons.find(x=>x.id===id);$("reasonDialogTitle").textContent="Editar motivo";$("reasonId").value=r.id;$("reasonName").value=r.name;$("reasonDialog").showModal()}
async function deleteReason(id){if(!confirm("¿Eliminar este motivo?"))return;const {error}=await supabase.from("reasons").update({active:false}).eq("id",id);if(error)return toast(error.message);await loadReasons();renderAll();toast("Motivo eliminado")}
async function saveReason(){const id=$("reasonId").value,name=$("reasonName").value.trim();if(!name)return;if(id){const {error}=await supabase.from("reasons").update({name}).eq("id",id);if(error)return toast(error.message)}else{const {error}=await supabase.from("reasons").insert({name,active:true});if(error)return toast(error.message)}$("reasonDialog").close();await loadReasons();renderAll();toast("Motivo guardado 💜")}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

$("loginForm").addEventListener("submit",async e=>{e.preventDefault();$("loginError").textContent="";const {error}=await supabase.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error)$("loginError").textContent=error.message})
$("logoutBtn").onclick=()=>supabase.auth.signOut();
$("datePicker").onchange=async e=>{selectedDate=e.target.value;await loadRecords();renderAll()}
$("refreshBtn").onclick=async()=>{await loadAll();toast("Actualizado 💜")}
$("recordStatus").onchange=toggleReason;
$("recordForm").addEventListener("submit",async e=>{e.preventDefault();await saveRecord()})
$("participantForm").addEventListener("submit",async e=>{e.preventDefault();await saveParticipant()})
$("reasonForm").addEventListener("submit",async e=>{e.preventDefault();await saveReason()})
$("addParticipantBtn").onclick=()=>{$("participantDialogTitle").textContent="Agregar integrante";$("participantId").value="";$("participantName").value="";$("participantDialog").showModal()}
$("addReasonBtn").onclick=()=>{$("reasonDialogTitle").textContent="Agregar motivo";$("reasonId").value="";$("reasonName").value="";$("reasonDialog").showModal()}
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");document.querySelectorAll(".tab-panel").forEach(x=>x.classList.add("hidden"));$(t.dataset.tab+"Tab").classList.remove("hidden")})
$("receiptFile").onchange=e=>{const f=e.target.files[0];$("receiptName").textContent=f?.name||"Ninguno";if(f){const u=URL.createObjectURL(f);$("receiptPreview").innerHTML=`<img src="${u}" alt="Vista previa">`}}
boot();
