import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://nryotlwywwlhrbjqqony.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MDCBv4UYZKy1KNPAafZnag_Hm1yot1m";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);

let participants = [];
let reasons = [];
let records = [];
let selectedDate = new Date().toISOString().slice(0, 10);

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function initials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(x => x[0])
    .join("")
    .toUpperCase();
}

function dateText(d) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  })
    .format(new Date(d + "T12:00:00"))
    .replace(/^./, m => m.toUpperCase());
}

function configured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_ANON_KEY.length > 20
  );
}

async function boot() {
  $("datePicker").value = selectedDate;
  $("selectedDateLabel").textContent = dateText(selectedDate);

  setupEvents();

  if (!configured()) {
    $("loginError").textContent =
      "Configura primero SUPABASE_URL y SUPABASE_ANON_KEY en app.js.";
    return;
  }

  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) {
      await showApp();
    } else {
      showLogin();
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        showApp();
      } else {
        showLogin();
      }
    });
  } catch (error) {
    console.error(error);
    showLogin();
  }
}

function showLogin() {
  $("loginView").classList.remove("hidden");
  $("appView").classList.add("hidden");
}

async function showApp() {
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  try {
    await loadAll();
  } catch (error) {
    console.error(error);
    toast("No se pudieron cargar los datos.");
  }
}

async function loadAll() {
  await Promise.all([
    loadParticipants(),
    loadReasons()
  ]);

  await loadRecords();
  renderAll();
}

async function loadParticipants() {
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error(error);
    toast(error.message);
    participants = [];
    return;
  }

  participants = data || [];
}

async function loadReasons() {
  const { data, error } = await supabase
    .from("reasons")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error(error);
    toast(error.message);
    reasons = [];
    return;
  }

  reasons = data || [];
}

async function loadRecords() {
  const { data, error } = await supabase
    .from("daily_records")
    .select("*, reasons(name), receipts(*)")
    .eq("vote_date", selectedDate);

  if (error) {
    console.error(error);
    toast(error.message);
    records = [];
    return;
  }

  records = data || [];
}

function recordFor(pid) {
  return records.find(r => r.participant_id === pid);
}

function renderAll() {
  $("selectedDateLabel").textContent = dateText(selectedDate);
  renderStats();
  renderDaily();
  renderManageParticipants();
  renderReasons();
}

function renderStats() {
  const total = participants.length;

  const voted = participants.filter(
    p => recordFor(p.id)?.status === "voted"
  ).length;

  const noVoted = participants.filter(
    p => recordFor(p.id)?.status === "no_voted"
  ).length;

  const justified = participants.filter(
    p => recordFor(p.id)?.status === "justified"
  ).length;

  const pending = participants.filter(
    p => !recordFor(p.id) ||
         recordFor(p.id)?.status === "pending"
  ).length;

  $("totalCount").textContent = total;
  $("votedCount").textContent = voted;
  $("noVotedCount").textContent = noVoted;
  $("justifiedCount").textContent = justified;
  $("pendingCount").textContent = pending;
}

function renderDaily() {
  const el = $("participantsList");

  if (!participants.length) {
    el.innerHTML = `
      <div class="person-row">
        <div>
          <strong>No hay participantes todavía.</strong>
          <div class="person-sub">
            Agrega la primera desde “Participantes”.
          </div>
        </div>
      </div>
    `;
    return;
  }

  el.innerHTML = participants.map(p => {
    const r = recordFor(p.id);

    let cls = "status-pending";
    let txt = "🔴 Pendiente";

    if (r?.status === "voted") {
      cls = "status-voted";
      txt = "🟢 Votó";
    }

    if (r?.status === "no_voted") {
      cls = "status-no-voted";
      txt = "❌ No votó";
    }

    if (r?.status === "justified") {
      cls = "status-justified";
      txt = `🟡 ${r.reasons?.name || "Justificada"}`;
    }

    return `
      <div class="person-row">
        <div class="person-info">
          <div class="avatar">${initials(p.name)}</div>

          <div>
            <div class="person-name">${esc(p.name)}</div>
            <div class="person-sub">
              ${
                r?.receipts?.length
                  ? "📸 Comprobante guardado"
                  : "Sin comprobante"
              }
            </div>
          </div>
        </div>

        <button
          type="button"
          class="status-pill ${cls}"
          data-record="${p.id}">
          ${txt}
        </button>
      </div>
    `;
  }).join("");

  el.querySelectorAll("[data-record]").forEach(button => {
    button.addEventListener("click", () => {
      openRecord(button.dataset.record);
    });
  });
}

function renderManageParticipants() {
  const el = $("manageParticipants");

  el.innerHTML =
    participants.map(p => `
      <div class="manage-row">
        <div class="person-info">
          <div class="avatar">${initials(p.name)}</div>
          <strong>${esc(p.name)}</strong>
        </div>

        <div class="manage-actions">
          <button
            type="button"
            data-edit="${p.id}">
            ✏️
          </button>

          <button
            type="button"
            data-del="${p.id}">
            🗑️
          </button>
        </div>
      </div>
    `).join("") ||
    `<div class="person-row">Aún no hay integrantes.</div>`;

  el.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      editParticipant(button.dataset.edit);
    });
  });

  el.querySelectorAll("[data-del]").forEach(button => {
    button.addEventListener("click", () => {
      deleteParticipant(button.dataset.del);
    });
  });
}

function renderReasons() {
  const el = $("manageReasons");

  el.innerHTML =
    reasons.map(r => `
      <div class="manage-row">
        <strong>${esc(r.name)}</strong>

        <div class="manage-actions">
          <button
            type="button"
            data-edit-reason="${r.id}">
            ✏️
          </button>

          <button
            type="button"
            data-del-reason="${r.id}">
            🗑️
          </button>
        </div>
      </div>
    `).join("") ||
    `<div class="person-row">Aún no hay motivos.</div>`;

  el.querySelectorAll("[data-edit-reason]").forEach(button => {
    button.addEventListener("click", () => {
      editReason(button.dataset.editReason);
    });
  });

  el.querySelectorAll("[data-del-reason]").forEach(button => {
    button.addEventListener("click", () => {
      deleteReason(button.dataset.delReason);
    });
  });
}

async function openRecord(pid) {
  const p = participants.find(x => x.id === pid);
  if (!p) return;

  const r = recordFor(pid);

  $("recordParticipantId").value = pid;
  $("recordId").value = r?.id || "";

  $("recordPerson").innerHTML = `
    <h3>${esc(p.name)}</h3>
    <p class="person-sub">${dateText(selectedDate)}</p>
  `;

  $("recordStatus").value = r?.status || "pending";
  $("recordNotes").value = r?.notes || "";

  fillReason(r?.reason_id || "");

  $("receiptFile").value = "";

  $("receiptName").textContent =
    r?.receipts?.length
      ? "Comprobante guardado"
      : "Ninguno";

  $("receiptPreview").innerHTML =
    r?.receipts?.[0]?.public_url
      ? `<img src="${r.receipts[0].public_url}" alt="Comprobante">`
      : "";

  toggleReason();

  $("recordDialog").showModal();
}

function fillReason(val) {
  $("recordReason").innerHTML =
    `<option value="">Selecciona un motivo</option>` +
    reasons.map(r => `
      <option
        value="${r.id}"
        ${r.id === val ? "selected" : ""}>
        ${esc(r.name)}
      </option>
    `).join("");
}

function toggleReason() {
  $("reasonWrap").style.display =
    $("recordStatus").value === "justified"
      ? "block"
      : "none";
}

async function saveRecord() {
  const pid = $("recordParticipantId").value;
  const status = $("recordStatus").value;

  const reason_id =
    status === "justified"
      ? ($("recordReason").value || null)
      : null;

  const notes = $("recordNotes").value.trim();

  const payload = {
    participant_id: pid,
    vote_date: selectedDate,
    status,
    reason_id,
    notes
  };

  let id = $("recordId").value;

  let query;

  if (id) {
    query = supabase
      .from("daily_records")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
  } else {
    query = supabase
      .from("daily_records")
      .upsert(payload, {
        onConflict: "participant_id,vote_date"
      })
      .select()
      .single();
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    toast(error.message);
    return;
  }

  id = data.id;

  const file = $("receiptFile").files[0];

  if (file) {
    const ext = file.name
      .split(".")
      .pop()
      .toLowerCase();

    const path =
      `${id}/${crypto.randomUUID()}.${ext}`;

    const up = await supabase
      .storage
      .from("voting-receipts")
      .upload(path, file, {
        upsert: true,
        contentType: file.type
      });

    if (up.error) {
      toast(up.error.message);
      return;
    }

    const pub =
      supabase
        .storage
        .from("voting-receipts")
        .getPublicUrl(path)
        .data.publicUrl;

    const ins = await supabase
      .from("receipts")
      .insert({
        daily_record_id: id,
        file_name: file.name,
        file_url: pub
      });

    if (ins.error) {
      toast(ins.error.message);
      return;
    }
  }

  $("recordDialog").close();

  await loadRecords();
  renderAll();

  toast("Registro guardado 💜");
}

async function editParticipant(id) {
  const p = participants.find(x => x.id === id);
  if (!p) return;

  $("participantDialogTitle").textContent =
    "Editar integrante";

  $("participantId").value = p.id;
  $("participantName").value = p.name;

  $("participantDialog").showModal();
}

async function deleteParticipant(id) {
  const p = participants.find(x => x.id === id);
  if (!p) return;

  if (
    !confirm(
      `¿Eliminar a ${p.name}?\n\nSus registros anteriores se conservarán.`
    )
  ) {
    return;
  }

  const { error } = await supabase
    .from("participants")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    toast(error.message);
    return;
  }

  await loadParticipants();
  renderAll();

  toast("Integrante eliminada");
}

async function saveParticipant() {
  const id = $("participantId").value;
  const name = $("participantName").value.trim();

  if (!name) return;

  if (id) {
    const { error } = await supabase
      .from("participants")
      .update({ name })
      .eq("id", id);

    if (error) {
      toast(error.message);
      return;
    }
  } else {
    const { error } = await supabase
      .from("participants")
      .insert({
        name,
        active: true
      });

    if (error) {
      toast(error.message);
      return;
    }
  }

  $("participantDialog").close();

  await loadParticipants();
  renderAll();

  toast("Integrante guardada 💜");
}

async function editReason(id) {
  const r = reasons.find(x => x.id === id);
  if (!r) return;

  $("reasonDialogTitle").textContent =
    "Editar motivo";

  $("reasonId").value = r.id;
  $("reasonName").value = r.name;

  $("reasonDialog").showModal();
}

async function deleteReason(id) {
  if (!confirm("¿Eliminar este motivo?")) return;

  const { error } = await supabase
    .from("reasons")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    toast(error.message);
    return;
  }

  await loadReasons();
  renderAll();

  toast("Motivo eliminado");
}

async function saveReason() {
  const id = $("reasonId").value;
  const name = $("reasonName").value.trim();

  if (!name) return;

  if (id) {
    const { error } = await supabase
      .from("reasons")
      .update({ name })
      .eq("id", id);

    if (error) {
      toast(error.message);
      return;
    }
  } else {
    const { error } = await supabase
      .from("reasons")
      .insert({
        name,
        active: true
      });

    if (error) {
      toast(error.message);
      return;
    }
  }

  $("reasonDialog").close();

  await loadReasons();
  renderAll();

  toast("Motivo guardado 💜");
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c])
  );
}

function setupEvents() {
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();

    $("loginError").textContent = "";

    const {
      error
    } = await supabase.auth.signInWithPassword({
      email: $("email").value,
      password: $("password").value
    });

    if (error) {
      $("loginError").textContent = error.message;
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
  });

  $("datePicker").addEventListener("change", async e => {
    selectedDate = e.target.value;
    await loadRecords();
    renderAll();
  });

  $("refreshBtn").addEventListener("click", async () => {
    await loadAll();
    toast("Actualizado 💜");
  });

  $("recordStatus").addEventListener(
    "change",
    toggleReason
  );

  $("recordForm").addEventListener("submit", async e => {
    e.preventDefault();
    await saveRecord();
  });

  $("participantForm").addEventListener("submit", async e => {
    e.preventDefault();
    await saveParticipant();
  });

  $("reasonForm").addEventListener("submit", async e => {
    e.preventDefault();
    await saveReason();
  });

  $("addParticipantBtn").addEventListener("click", () => {
    $("participantDialogTitle").textContent =
      "Agregar integrante";

    $("participantId").value = "";
    $("participantName").value = "";

    $("participantDialog").showModal();
  });

  $("addReasonBtn").addEventListener("click", () => {
    $("reasonDialogTitle").textContent =
      "Agregar motivo";

    $("reasonId").value = "";
    $("reasonName").value = "";

    $("reasonDialog").showModal();
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach(x => x.classList.remove("active"));

      tab.classList.add("active");

      document
        .querySelectorAll(".tab-panel")
        .forEach(x => x.classList.add("hidden"));

      const target = $(tab.dataset.tab + "Tab");

      if (target) {
        target.classList.remove("hidden");
      }
    });
  });

  $("receiptFile").addEventListener("change", e => {
    const file = e.target.files[0];

    $("receiptName").textContent =
      file?.name || "Ninguno";

    if (file) {
      const url = URL.createObjectURL(file);

      $("receiptPreview").innerHTML =
        `<img src="${url}" alt="Vista previa">`;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
      }
