import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://nryotlwywwlhrbjqqony.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MDCBv4UYZKy1KNPAafZnag_Hm1yot1m";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = (id) => document.getElementById(id);

let participants = [];
let reasons = [];
let records = [];

let selectedDate =
  new Date().toISOString().slice(0, 10);

let currentFilter = "all";


/* =========================
   UTILIDADES
========================= */

function toast(msg) {
  const el = $("toast");

  if (!el) return;

  el.textContent = msg;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 2600);
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


function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char])
  );
}


function configured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_ANON_KEY.length > 20
  );
}


/* =========================
   INICIO
========================= */

async function boot() {

  $("voteDate").value = selectedDate;

  $("dateTitle").textContent =
    dateText(selectedDate);

  setupEvents();

  if (!configured()) {
    $("loginError").textContent =
      "Configura SUPABASE_URL y SUPABASE_ANON_KEY.";
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

    supabase.auth.onAuthStateChange(
      (_event, session) => {

        if (session) {
          showApp();
        } else {
          showLogin();
        }

      }
    );

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


/* =========================
   CARGAR DATOS
========================= */

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
    .select("*, reasons(name)")
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

  return records.find(
    r => r.participant_id === pid
  );
}


/* =========================
   RENDER GENERAL
========================= */

function renderAll() {

  $("dateTitle").textContent =
    dateText(selectedDate);

  renderStats();
  renderDaily();
  renderManageParticipants();

}


function renderStats() {

  const total = participants.length;

  const voted =
    participants.filter(
      p => recordFor(p.id)?.status === "voted"
    ).length;

  const justified =
    participants.filter(
      p => recordFor(p.id)?.status === "justified"
    ).length;

  const pending =
    participants.filter(
      p =>
        !recordFor(p.id) ||
        recordFor(p.id)?.status === "pending"
    ).length;


  $("totalCount").textContent = total;
  $("votedCount").textContent = voted;
  $("justifiedCount").textContent = justified;
  $("pendingCount").textContent = pending;
}


/* =========================
   FILTROS
========================= */

function setFilter(filter) {

  currentFilter = filter;

  document
    .querySelectorAll(".filter-card")
    .forEach(card => {

      card.classList.toggle(
        "active",
        card.dataset.filter === filter
      );

    });

  const titles = {
    all: "Estado de votación",
    voted: "Personas que votaron",
    justified: "Personas justificadas",
    pending: "Personas pendientes"
  };

  const hints = {
    all: "Mostrando todos los integrantes",
    voted: "Mostrando solo quienes votaron",
    justified: "Mostrando solo las justificadas",
    pending: "Mostrando solo las pendientes"
  };

  $("listTitle").textContent =
    titles[filter] || titles.all;

  $("filterHint").textContent =
    hints[filter] || hints.all;

  renderDaily();
}


/* =========================
   LISTA DIARIA
========================= */

function renderDaily() {

  const el = $("peopleList");

  let visibleParticipants =
    participants.filter(p => {

      const record = recordFor(p.id);
      const status = record?.status;

      if (currentFilter === "all") {
        return true;
      }

      if (currentFilter === "voted") {
        return status === "voted";
      }

      if (currentFilter === "justified") {
        return status === "justified";
      }

      if (currentFilter === "pending") {
        return (
          !record ||
          status === "pending"
        );
      }

      return true;

    });


  if (!visibleParticipants.length) {

    const messages = {
      voted: "Nadie ha votado todavía.",
      justified: "No hay justificadas.",
      pending: "No hay pendientes.",
      all: "No hay participantes todavía."
    };

    el.innerHTML = `
      <div class="person-row">
        <div>
          <strong>
            ${
              messages[currentFilter] ||
              messages.all
            }
          </strong>

          <div class="person-sub">
            ${
              currentFilter === "all"
                ? "Agrega la primera desde “Participantes”."
                : "Prueba con otro filtro."
            }
          </div>
        </div>
      </div>
    `;

    return;
  }


  el.innerHTML =
    visibleParticipants.map(p => {

      const r = recordFor(p.id);

      let cls = "status-pending";
      let txt = "🔴 Pendiente";


      if (r?.status === "voted") {

        cls = "status-voted";
        txt = "🟢 Votó";

      }


      if (r?.status === "justified") {

        cls = "status-justified";

        txt =
          `🟡 ${
            r.reasons?.name ||
            "Justificada"
          }`;

      }


      return `
        <div class="person-row">

          <div class="person-info">

            <div class="avatar">
              ${initials(p.name)}
            </div>

            <div>

              <div class="person-name">
                ${esc(p.name)}
              </div>

              <div class="person-sub">
                ${
                  r?.notes
                    ? esc(r.notes)
                    : "Sin notas"
                }
              </div>

            </div>

          </div>


          <button
            type="button"
            class="status-pill ${cls}"
            data-record="${p.id}"
          >
            ${txt}
          </button>

        </div>
      `;

    }).join("");


  el
    .querySelectorAll("[data-record]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          openRecord(button.dataset.record);
        }
      );

    });
}


/* =========================
   REGISTRO
========================= */

async function openRecord(pid) {

  const participant =
    participants.find(
      x => x.id === pid
    );

  if (!participant) return;

  const record =
    recordFor(pid);


  $("recordParticipantId").value =
    pid;

  $("recordId").value =
    record?.id || "";


  $("recordPerson").innerHTML = `
    <h2>${esc(participant.name)}</h2>

    <p class="person-sub">
      ${dateText(selectedDate)}
    </p>
  `;


  $("recordStatus").value =
    record?.status || "pending";


  $("recordNotes").value =
    record?.notes || "";


  fillReason(
    record?.reason_id || ""
  );


  toggleReason();

  $("recordDialog").showModal();
}


function fillReason(value) {

  $("recordReason").innerHTML =
    `<option value="">
      Selecciona un motivo
    </option>` +

    reasons.map(reason => `
      <option
        value="${reason.id}"
        ${
          reason.id === value
            ? "selected"
            : ""
        }
      >
        ${esc(reason.name)}
      </option>
    `).join("");
}


function toggleReason() {

  const justified =
    $("recordStatus").value === "justified";

  $("reasonWrap").classList.toggle(
    "hidden",
    !justified
  );
}


async function saveRecord() {

  const participantId =
    $("recordParticipantId").value;

  const status =
    $("recordStatus").value;


  const reasonId =
    status === "justified"
      ? (
          $("recordReason").value ||
          null
        )
      : null;


  const notes =
    $("recordNotes")
      .value
      .trim();


  const payload = {

    participant_id:
      participantId,

    vote_date:
      selectedDate,

    status,

    reason_id:
      reasonId,

    notes

  };


  const existingId =
    $("recordId").value;


  let result;


  if (existingId) {

    result =
      await supabase
        .from("daily_records")
        .update(payload)
        .eq("id", existingId)
        .select()
        .single();

  } else {

    result =
      await supabase
        .from("daily_records")
        .upsert(
          payload,
          {
            onConflict:
              "participant_id,vote_date"
          }
        )
        .select()
        .single();

  }


  if (result.error) {

    console.error(result.error);

    toast(result.error.message);

    return;
  }


  $("recordDialog").close();


  await loadRecords();

  renderAll();


  toast("Registro guardado 💜");
}


/* =========================
   PARTICIPANTES
========================= */

function renderManageParticipants() {

  const el =
    $("manageList");


  el.innerHTML =
    participants.map(p => `

      <div class="manage-row">

        <div class="person-info">

          <div class="avatar">
            ${initials(p.name)}
          </div>

          <strong>
            ${esc(p.name)}
          </strong>

        </div>


        <div class="manage-actions">

          <button
            type="button"
            data-edit="${p.id}"
          >
            ✏️
          </button>

          <button
            type="button"
            data-del="${p.id}"
          >
            🗑️
          </button>

        </div>

      </div>

    `).join("") ||

    `
      <div class="person-row">
        Aún no hay integrantes.
      </div>
    `;


  el
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          editParticipant(
            button.dataset.edit
          );
        }
      );

    });


  el
    .querySelectorAll("[data-del]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          deleteParticipant(
            button.dataset.del
          );
        }
      );

    });
}


function editParticipant(id) {

  const participant =
    participants.find(
      x => x.id === id
    );

  if (!participant) return;


  $("participantDialogTitle")
    .textContent =
      "Editar integrante";


  $("participantId").value =
    participant.id;


  $("participantName").value =
    participant.name;


  $("participantDialog")
    .showModal();
}


async function saveParticipant() {

  const id =
    $("participantId").value;

  const name =
    $("participantName")
      .value
      .trim();


  if (!name) return;


  let result;


  if (id) {

    result =
      await supabase
        .from("participants")
        .update({
          name
        })
        .eq("id", id);

  } else {

    result =
      await supabase
        .from("participants")
        .insert({
          name,
          active: true
        });

  }


  if (result.error) {

    toast(result.error.message);

    return;
  }


  $("participantDialog")
    .close();


  await loadParticipants();

  renderAll();


  toast("Integrante guardada 💜");
}


async function deleteParticipant(id) {

  const participant =
    participants.find(
      x => x.id === id
    );

  if (!participant) return;


  if (
    !confirm(
      `¿Eliminar a ${participant.name}?\n\nSus registros anteriores se conservarán.`
    )
  ) {
    return;
  }


  const { error } =
    await supabase
      .from("participants")
      .update({
        active: false
      })
      .eq("id", id);


  if (error) {

    toast(error.message);

    return;
  }


  await loadParticipants();

  renderAll();


  toast("Integrante eliminada");
}


/* =========================
   EVENTOS
========================= */

function setupEvents() {

  /* LOGIN */

  $("loginForm")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        $("loginError")
          .textContent = "";


        const { error } =
          await supabase.auth
            .signInWithPassword({

              email:
                $("email").value,

              password:
                $("password").value

            });


        if (error) {

          $("loginError")
            .textContent =
              error.message;

        }

      }
    );


  /* LOGOUT */

  $("logoutBtn")
    .addEventListener(
      "click",
      async () => {

        await supabase.auth
          .signOut();

      }
    );


  /* FECHA */

  $("voteDate")
    .addEventListener(
      "change",
      async event => {

        selectedDate =
          event.target.value;


        currentFilter =
          "all";


        updateFilterButtons();


        await loadRecords();

        renderAll();

      }
    );


  /* ACTUALIZAR */

  $("refreshDailyBtn")
    .addEventListener(
      "click",
      async () => {

        await loadAll();

        toast(
          "Actualizado 💜"
        );

      }
    );


  /* FILTROS */

  document
    .querySelectorAll(".filter-card")
    .forEach(card => {

      const activate =
        () => {

          setFilter(
            card.dataset.filter
          );

        };


      card.addEventListener(
        "click",
        activate
      );


      card.addEventListener(
        "keydown",
        event => {

          if (
            event.key === "Enter" ||
            event.key === " "
          ) {

            event.preventDefault();

            activate();

          }

        }
      );

    });


  /* ESTADO */

  $("recordStatus")
    .addEventListener(
      "change",
      toggleReason
    );


  /* GUARDAR REGISTRO */

  $("recordForm")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        await saveRecord();

      }
    );


  /* AGREGAR PARTICIPANTE */

  $("addParticipantBtn")
    .addEventListener(
      "click",
      () => {

        $("participantDialogTitle")
          .textContent =
            "Agregar integrante";


        $("participantId")
          .value = "";


        $("participantName")
          .value = "";


        $("participantDialog")
          .showModal();

      }
    );


  /* CANCELAR REGISTRO */

  $("cancelRecordBtn")
    .addEventListener(
      "click",
      () => {

        $("recordDialog")
          .close();

      }
    );


  /* CERRAR REGISTRO */

  $("closeRecordBtn")
    .addEventListener(
      "click",
      () => {

        $("recordDialog")
          .close();

      }
    );


  /* CANCELAR PARTICIPANTE */

  $("cancelParticipantBtn")
    .addEventListener(
      "click",
      () => {

        $("participantDialog")
          .close();

      }
    );


  /* CERRAR PARTICIPANTE */

  $("closeParticipantBtn")
    .addEventListener(
      "click",
      () => {

        $("participantDialog")
          .close();

      }
    );


  /* GUARDAR PARTICIPANTE */

  $("participantForm")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        await saveParticipant();

      }
    );


  /* TABS */

  document
    .querySelectorAll(".tab")
    .forEach(tab => {

      tab.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(".tab")
            .forEach(
              x =>
                x.classList
                  .remove("active")
            );


          tab.classList
            .add("active");


          const daily =
            $("dailyPanel");

          const participantsPanel =
            $("participantsPanel");


          if (
            tab.dataset.tab === "daily"
          ) {

            daily.classList
              .remove("hidden");

            participantsPanel
              .classList
              .add("hidden");

          } else {

            daily.classList
              .add("hidden");

            participantsPanel
              .classList
              .remove("hidden");

          }

        }
      );

    });

}


/* =========================
   ACTUALIZAR FILTROS
========================= */

function updateFilterButtons() {

  document
    .querySelectorAll(".filter-card")
    .forEach(card => {

      card.classList.toggle(
        "active",
        card.dataset.filter ===
          currentFilter
      );

    });

}


/* =========================
   ARRANCAR
========================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    boot
  );

} else {

  boot();

      }
