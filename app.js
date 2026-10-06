import {
  createClient
} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL =
  "https://kxygjwhppuxysvjwnwoc.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_6RvwuZZfDgvyus4BXcrMdw_hHyV_gyD";

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

const $ = id =>
  document.getElementById(id);

let profile = null;
let activeTerm = null;
let cachedLogs = [];
let filteredLogs = [];
let currentTransitionRequest = null;

const authView =
  $("authView");

const appView =
  $("appView");

const loginForm =
  $("loginForm");

const authMessage =
  $("authMessage");

const eventForm =
  $("eventForm");

const formMessage =
  $("formMessage");

const logList =
  $("logList");

const ledgerStatus =
  $("ledgerStatus");

const termAdmin = {

  section:
    $("term-admin-section"),
  currentTerm:
    $("admin-current-term"),
  secretaryPanel:
    $("secretary-transition-panel"),
  pendingPanel:
    $("pending-transition-panel"),
  newTermInput:
    $("new-term-name"),
  requestButton:
    $("btn-request-transition"),
  transitionTitle:
    $("transition-title"),
  transitionRequester:
    $("transition-requester"),
  transitionStatus:
    $("transition-status"),
  deputyArea:
    $("deputy-approval-area"),
  approveButton:
    $("btn-approve-transition"),
  finalizeArea:
    $("secretary-finalize-area"),
  confirmationInput:
    $("final-confirmation"),
  finalizeButton:
    $("btn-finalize-transition"),
  message:
    $("term-admin-message")
};

function showMessage(
  element,
  text,
  type = "error"
) {

  if (!element) return;
  element.textContent = text;
  element.className =
    `message ${type}`;
}

function clearMessage(element) {
  if (!element) return;
  element.textContent = "";
  element.className =
    "message hidden";
}

function isExecutive() {
  return profile?.role === "executive";
}

function prettyDate(value) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  ).format(
    new Date(`${value}T00:00:00`)
  );

}

function safeUrl(value) {
  if (!value) {
    return null;
  }
  try {
    const url =
      new URL(value);
    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function displayDepartment(log) {
  if (log.entry_tag === "EXECUTIVE") {
    return "Executive";
  }
  return (
    log.departments?.name ||
    "Department"
  );
}

function displayTag(log) {
  if (log.entry_tag === "EXECUTIVE") {
    return "Executive";
  }
  return (
    log.profiles?.tag ||
    displayDepartment(log)
  );
}

async function loadProfile(userId) {
  const {
    data,
    error
  } = await supabase
    .from("profiles")
    .select(`
      id,
      name,
      email,
      role,
      position,
      tag,
      department_id,
      departments (
        name
      )
    `)
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }
  profile = data;
  await loadActiveTerm();
}

async function loadActiveTerm() {
  const {
    data,
    error
  } = await supabase
    .from("terms")
    .select("id, name")
    .eq("is_active", true)
    .order(
      "id",
      {
        ascending: false
      }
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  activeTerm = data;
}

function renderIdentity() {
  const department =
    profile.departments?.name;
  $("welcomeName").textContent =
    profile.name;


  const metadata = [
    profile.position,
    department
  ]
    .filter(Boolean)
    .join(" · ");

  $("welcomeMeta").textContent =
    metadata +
    (
      isExecutive()
        ? " · Full ledger access"
        : " · Personal ledger access"
    );

  $("tagBadge").textContent =
    profile.tag ||
    (
      isExecutive()
        ? "Executive"
        : department || "Department"
    );

  $("roleBadge").textContent =
    isExecutive()
      ? "Executive access"
      : "Department access";

  $("accessLabel").textContent =
    isExecutive()
      ? "Secretariat oversight"
      : "Department workspace";

  $("entryTagPreview").textContent =
    isExecutive()
      ? "EXECUTIVE"
      : (
          profile.tag ||
          department ||
          "DEPARTMENT"
        );

  $("ledgerHeading").textContent =
    isExecutive()
      ? "Central ledger"
      : "My ledger";

  $("termPill").textContent =
    `Term ${activeTerm?.name || "—"}`;

  $("executiveFilters")
    .classList.toggle(
      "hidden",
      !isExecutive()
    );

  $("exportControls")
    .classList.toggle(
      "hidden",
      !isExecutive()
    );

}

async function enterApp(user) {
  try {
    await loadProfile(user.id);
    authView.classList.add(
      "hidden"
    );
    appView.classList.remove(
      "hidden"
    );

    renderIdentity();
    await loadFilterOptions();
    await loadLogs();
    await loadTermAdministration();
  } catch (error) {
    console.error(error);
    await supabase.auth.signOut();

    appView.classList.add(
      "hidden"
    );
    authView.classList.remove(
      "hidden"
    );
    showMessage(
      authMessage,
      `Unable to load your Synapse profile: ${error.message}`
    );

  }

}

loginForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();
    clearMessage(
      authMessage
    );
    const button =
      $("loginButton");
    button.disabled = true;
    button.textContent =
      "Signing in…";
    const {
      data,
      error
    } = await supabase.auth
      .signInWithPassword({

        email:
          $("loginEmail")
            .value
            .trim(),

        password:
          $("loginPassword")
            .value
      });

    button.disabled = false;
    button.textContent =
      "Access ledger";
    if (error) {
      showMessage(
        authMessage,
        error.message
      );
      return;
    }

    loginForm.reset();
    await enterApp(
      data.user
    );
  }
);

$("logoutButton").addEventListener(
  "click",
  async () => {
    await supabase.auth.signOut();
    profile = null;
    activeTerm = null;
    cachedLogs = [];
    filteredLogs = [];
    currentTransitionRequest = null;
    appView.classList.add(
      "hidden"
    );

    authView.classList.remove(
      "hidden"
    );
    clearMessage(
      authMessage
    );
  }
);

document
  .querySelectorAll(".tab")
  .forEach(button => {
    button.addEventListener(
      "click",
      async () => {
        document
          .querySelectorAll(".tab")
          .forEach(tab => {

            tab.classList.toggle(
              "active",
              tab === button
            );
          });

        const showLedger =
          button.dataset.pane ===
          "ledger";
        $("newPane")
          .classList.toggle(
            "hidden",
            showLedger
          );
        $("ledgerPane")
          .classList.toggle(
            "hidden",
            !showLedger
          );

        if (showLedger) {
          await loadLogs();
        }
      }
    );
  });

eventForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();
    clearMessage(
      formMessage
    );
    if (!activeTerm) {
      showMessage(
        formMessage,
        "No active Synapse term exists."
      );
      return;
    }

    const button =
      $("submitEvent");
    button.disabled = true;
    button.textContent =
      "Appending…";

    const date =
      $("eventDate").value;

    const day =
      new Intl.DateTimeFormat(
        "en-US",
        {
          weekday: "long"
        }
      ).format(
        new Date(
          `${date}T12:00:00`
        )
      );

    const registrationsValue =
      $("eventRegistrations").value;

    const {
      data: authData,
      error: authError
    } = await supabase.auth
      .getUser();
    if (
      authError ||
      !authData.user
    ) {
      button.disabled = false;
      button.textContent =
        "Append to ledger";
      showMessage(
        formMessage,
        "Your login session has expired. Please sign in again."
      );
      return;
    }

    const payload = {
      created_by:
        authData.user.id,
      day_of_week:
        day,
      event_date:
        date,

      title:
        $("eventTitle")
          .value
          .trim(),

      event_type:
        $("eventType")
          .value
          .trim(),

      description:
        $("eventDescription")
          .value
          .trim(),

      registrations:
        registrationsValue === ""
          ? null
          : Number(
              registrationsValue
            ),

      participants:
        Number(
          $("eventParticipants")
            .value
        ),

      youtube_link:
        $("eventYoutube")
          .value
          .trim() || null,

      drive_link:
        $("eventDrive")
          .value
          .trim()

    };

    const {
      error
    } = await supabase
      .from("event_logs")
      .insert(payload);


    button.disabled = false;

    button.textContent =
      "Append to ledger";


    if (error) {

      showMessage(
        formMessage,
        error.message
      );

      return;

    }


    eventForm.reset();


    showMessage(
      formMessage,
      "Entry added to the central ledger.",
      "success"
    );


    await loadLogs();

  }
);


// ============================================================
// EXECUTIVE FILTER OPTIONS
// ============================================================

async function loadFilterOptions() {

  if (!isExecutive()) {
    return;
  }


  const {
    data,
    error
  } = await supabase
    .from("departments")
    .select("id, name")
    .order("name");


  if (error) {

    console.error(
      "Department filter error:",
      error
    );

    return;

  }


  const select =
    $("departmentFilter");


  select.innerHTML = `
    <option value="ALL">
      All departments
    </option>

    <option value="EXECUTIVE">
      Executive entries
    </option>
  `;


  (data || []).forEach(
    department => {

      select.add(
        new Option(
          department.name,
          String(
            department.id
          )
        )
      );

    }
  );

}


// ============================================================
// LOAD ACTIVE LEDGER
// ============================================================

async function loadLogs() {

  ledgerStatus
    .classList
    .remove("hidden");


  ledgerStatus.textContent =
    "Loading records…";


  logList.innerHTML = "";


  if (!activeTerm) {

    cachedLogs = [];

    filteredLogs = [];


    renderStats([]);


    ledgerStatus.textContent =
      "No active Synapse term exists.";

    return;

  }


  /*
    We explicitly query the active term instead of downloading
    old terms and filtering them in the browser.
  */

  const {
    data,
    error
  } = await supabase
    .from("event_logs")
    .select(`
      id,
      term_id,
      title,
      event_date,
      event_type,
      description,
      registrations,
      participants,
      youtube_link,
      drive_link,
      created_at,
      entry_tag,
      department_id,
      created_by,

      departments (
        name
      ),

      profiles!event_logs_created_by_fkey (
        name,
        position,
        tag
      )
    `)
    .eq(
      "term_id",
      activeTerm.id
    )
    .order(
      "event_date",
      {
        ascending: false
      }
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    console.error(error);


    ledgerStatus.textContent =
      `Unable to load records: ${error.message}`;

    return;

  }


  /*
    RLS performs the actual visibility enforcement:

    Executive:
      receives all records in active term.

    Department Head:
      receives only rows created by that authenticated user.
  */

  cachedLogs =
    data || [];


  populateTypeFilter();

  applyFilters();

}


// ============================================================
// EVENT TYPE FILTER
// ============================================================

function populateTypeFilter() {

  if (!isExecutive()) {
    return;
  }


  const select =
    $("typeFilter");


  const currentValue =
    select.value;


  const types = [
    ...new Set(
      cachedLogs
        .map(
          log =>
            log.event_type
        )
        .filter(Boolean)
    )
  ].sort(
    (a, b) =>
      a.localeCompare(b)
  );


  select.innerHTML =
    `<option value="ALL">All types</option>`;


  types.forEach(
    type => {

      select.add(
        new Option(
          type,
          type
        )
      );

    }
  );


  const stillExists =
    [...select.options]
      .some(
        option =>
          option.value ===
          currentValue
      );


  if (stillExists) {

    select.value =
      currentValue;

  }

}


// ============================================================
// FILTER LEDGER
// ============================================================

function applyFilters() {

  let rows =
    [...cachedLogs];


  if (isExecutive()) {

    const query =
      $("searchFilter")
        .value
        .trim()
        .toLowerCase();


    const department =
      $("departmentFilter")
        .value;


    const type =
      $("typeFilter")
        .value;


    if (query) {

      rows =
        rows.filter(
          log => {

            const searchable = [

              log.title,

              log.description,

              log.event_type,

              log.profiles?.name,

              log.profiles?.position,

              log.profiles?.tag,

              log.departments?.name

            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();


            return searchable
              .includes(query);

          }
        );

    }


    if (
      department ===
      "EXECUTIVE"
    ) {

      rows =
        rows.filter(
          log =>
            log.entry_tag ===
            "EXECUTIVE"
        );

    } else if (
      department !== "ALL"
    ) {

      rows =
        rows.filter(
          log =>
            String(
              log.department_id
            ) === department
        );

    }


    if (type !== "ALL") {

      rows =
        rows.filter(
          log =>
            log.event_type ===
            type
        );

    }

  }


  filteredLogs =
    rows;


  renderStats(
    rows
  );


  renderLogs(
    rows
  );

}


// ============================================================
// STATS
// ============================================================

function renderStats(rows) {

  $("statRecords").textContent =
    rows.length;


  $("statParticipants").textContent =
    rows
      .reduce(
        (
          sum,
          log
        ) =>
          sum +
          (
            Number(
              log.participants
            ) || 0
          ),
        0
      )
      .toLocaleString(
        "en-IN"
      );


  const departments =
    new Set(
      rows.map(
        displayDepartment
      )
    );


  $("statDepartments").textContent =
    departments.size;

}


// ============================================================
// RENDER LEDGER
// ============================================================

function renderLogs(rows) {

  if (!rows.length) {

    ledgerStatus
      .classList
      .remove("hidden");


    ledgerStatus.textContent =
      "No records found for this view.";


    logList.innerHTML = "";

    return;

  }


  ledgerStatus
    .classList
    .add("hidden");


  logList.innerHTML = "";


  rows.forEach(
    log => {

      const card =
        document.createElement(
          "article"
        );


      card.className =
        "log-card";


      // --------------------------------
      // TOP TAGS
      // --------------------------------

      const top =
        document.createElement(
          "div"
        );


      top.className =
        "log-top";


      const tags =
        document.createElement(
          "div"
        );


      tags.className =
        "log-tags";


      const tag =
        document.createElement(
          "span"
        );


      tag.className =
        `pill ${
          log.entry_tag ===
          "EXECUTIVE"
            ? "gold"
            : ""
        }`;


      tag.textContent =
        log.entry_tag ===
        "EXECUTIVE"
          ? "EXECUTIVE"
          : displayTag(log);


      tags.appendChild(
        tag
      );


      const department =
        document.createElement(
          "span"
        );


      department.className =
        "pill subtle";


      department.textContent =
        displayDepartment(log);


      tags.appendChild(
        department
      );


      const type =
        document.createElement(
          "span"
        );


      type.className =
        "pill";


      type.textContent =
        log.event_type;


      top.append(
        tags,
        type
      );


      card.appendChild(
        top
      );


      // --------------------------------
      // TITLE
      // --------------------------------

      const title =
        document.createElement(
          "h3"
        );


      title.textContent =
        log.title;


      card.appendChild(
        title
      );


      // --------------------------------
      // META
      // --------------------------------

      const meta =
        document.createElement(
          "div"
        );


      meta.className =
        "log-meta";


      meta.textContent =
        `${prettyDate(log.event_date)} · ` +
        `Logged by ${log.profiles?.name || "Synapse member"}` +
        (
          log.profiles?.position
            ? ` (${log.profiles.position})`
            : ""
        );


      card.appendChild(
        meta
      );


      // --------------------------------
      // DESCRIPTION
      // --------------------------------

      const description =
        document.createElement(
          "p"
        );


      description.className =
        "log-desc";


      description.textContent =
        log.description;


      card.appendChild(
        description
      );


      // --------------------------------
      // METRICS
      // --------------------------------

      const metrics =
        document.createElement(
          "div"
        );


      metrics.className =
        "metrics";


      const registrations =
        document.createElement(
          "span"
        );


      registrations.className =
        "metric";


      registrations.textContent =
        `Registrations: ${
          log.registrations ??
          "Open / N.A."
        }`;


      const participants =
        document.createElement(
          "span"
        );


      participants.className =
        "metric";


      participants.textContent =
        `Participants: ${log.participants}`;


      metrics.append(
        registrations,
        participants
      );


      card.appendChild(
        metrics
      );


      // --------------------------------
      // LINKS
      // --------------------------------

      const links =
        document.createElement(
          "div"
        );


      links.className =
        "links";


      let hasLinks =
        false;


      const drive =
        safeUrl(
          log.drive_link
        );


      if (drive) {

        const anchor =
          document.createElement(
            "a"
          );


        anchor.href =
          drive;

        anchor.target =
          "_blank";

        anchor.rel =
          "noopener noreferrer";

        anchor.textContent =
          "Open asset folder ↗";


        links.appendChild(
          anchor
        );


        hasLinks =
          true;

      }


      const recording =
        safeUrl(
          log.youtube_link
        );


      if (recording) {

        const anchor =
          document.createElement(
            "a"
          );


        anchor.href =
          recording;

        anchor.target =
          "_blank";

        anchor.rel =
          "noopener noreferrer";

        anchor.textContent =
          "Watch recording ↗";


        links.appendChild(
          anchor
        );


        hasLinks =
          true;

      }


      if (hasLinks) {

        card.appendChild(
          links
        );

      }


      logList.appendChild(
        card
      );

    }
  );

}


// ============================================================
// FILTER EVENTS
// ============================================================

$("searchFilter")
  ?.addEventListener(
    "input",
    applyFilters
  );


$("departmentFilter")
  ?.addEventListener(
    "change",
    applyFilters
  );


$("typeFilter")
  ?.addEventListener(
    "change",
    applyFilters
  );


$("refreshButton")
  .addEventListener(
    "click",
    async () => {

      await loadActiveTerm();

      renderIdentity();

      await loadLogs();

      await loadTermAdministration();

    }
  );


// ============================================================
// EXECUTIVE EXPORT
// ============================================================

function exportRows() {

  if (!isExecutive()) {
    return [];
  }


  return (
    $("exportScope").value ===
    "ALL"
      ? [...cachedLogs]
      : [...filteredLogs]
  );

}


function exportBaseName() {

  const term =
    (
      activeTerm?.name ||
      "active-term"
    )
      .replace(
        /[^a-z0-9_-]+/gi,
        "-"
      );


  const scope =
    $("exportScope").value ===
    "ALL"
      ? "complete"
      : "filtered";


  return (
    `synapse-ledger-${term}-${scope}`
  );

}


function downloadFile(
  content,
  mimeType,
  extension
) {

  if (!isExecutive()) {
    return;
  }


  const blob =
    new Blob(
      [content],
      {
        type: mimeType
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const anchor =
    document.createElement(
      "a"
    );


  anchor.href =
    url;


  anchor.download =
    `${exportBaseName()}.${extension}`;


  document.body
    .appendChild(
      anchor
    );


  anchor.click();


  anchor.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );

}


function exportObject(log) {

  return {

    id:
      log.id,

    term:
      activeTerm?.name || "",

    date:
      log.event_date,

    type:
      log.event_type,

    title:
      log.title,

    tag:
      displayTag(log),

    department:
      displayDepartment(log),

    logged_by:
      log.profiles?.name ||
      "Synapse member",

    position:
      log.profiles?.position ||
      "",

    description:
      log.description,

    registrations:
      log.registrations,

    participants:
      log.participants,

    recording_link:
      log.youtube_link ||
      "",

    asset_link:
      log.drive_link ||
      "",

    created_at:
      log.created_at

  };

}


function csvCell(value) {

  const stringValue =
    String(
      value ?? ""
    );


  return (
    `"${stringValue.replaceAll(
      '"',
      '""'
    )}"`
  );

}


// ------------------------------------------------------------
// TXT
// ------------------------------------------------------------

function exportTxt() {

  if (!isExecutive()) {
    return;
  }


  const rows =
    exportRows();


  if (!rows.length) {

    alert(
      "There are no records in this export."
    );

    return;

  }


  let output =
    "SYNAPSE — IIT MADRAS BS\n" +
    "OPERATIONS LEDGER\n" +
    `TERM ${activeTerm?.name || "—"}\n` +
    `${"=".repeat(64)}\n\n`;


  rows.forEach(
    (
      log,
      index
    ) => {

      const record =
        exportObject(log);


      output +=
        `LOG #${String(index + 1).padStart(3, "0")}\n` +

        `Date: ${record.date}\n` +

        `Tag: ${record.tag}\n` +

        `Department: ${record.department}\n` +

        `Type: ${record.type}\n` +

        `Title: ${record.title}\n` +

        `Logged by: ${record.logged_by}` +

        (
          record.position
            ? ` (${record.position})`
            : ""
        ) +

        `\n\n${record.description}\n\n` +

        `Registrations: ${
          record.registrations ??
          "Open / N.A."
        }\n` +

        `Participants: ${record.participants}\n` +

        `Recording: ${
          record.recording_link ||
          "—"
        }\n` +

        `Assets: ${
          record.asset_link ||
          "—"
        }\n` +

        `${"-".repeat(64)}\n\n`;

    }
  );


  downloadFile(
    output,
    "text/plain;charset=utf-8",
    "txt"
  );

}


// ------------------------------------------------------------
// CSV
// ------------------------------------------------------------

function exportCsv() {

  if (!isExecutive()) {
    return;
  }


  const rows =
    exportRows()
      .map(
        exportObject
      );


  if (!rows.length) {

    alert(
      "There are no records in this export."
    );

    return;

  }


  const headers = [

    "id",
    "term",
    "date",
    "type",
    "title",
    "tag",
    "department",
    "logged_by",
    "position",
    "description",
    "registrations",
    "participants",
    "recording_link",
    "asset_link",
    "created_at"

  ];


  const csv = [

    headers
      .map(csvCell)
      .join(","),

    ...rows.map(
      row =>
        headers
          .map(
            header =>
              csvCell(
                row[header]
              )
          )
          .join(",")
    )

  ].join("\r\n");


  downloadFile(
    "\uFEFF" + csv,
    "text/csv;charset=utf-8",
    "csv"
  );

}


// ------------------------------------------------------------
// JSON
// ------------------------------------------------------------

function exportJson() {

  if (!isExecutive()) {
    return;
  }


  const rows =
    exportRows();


  if (!rows.length) {

    alert(
      "There are no records in this export."
    );

    return;

  }


  const exportData = {

    organization:
      "Synapse — IIT Madras BS",

    term:
      activeTerm?.name ||
      null,

    scope:
      $("exportScope").value ===
      "ALL"
        ? "complete"
        : "filtered",

    exported_at:
      new Date()
        .toISOString(),

    record_count:
      rows.length,

    records:
      rows.map(
        exportObject
      )

  };


  downloadFile(
    JSON.stringify(
      exportData,
      null,
      2
    ),
    "application/json;charset=utf-8",
    "json"
  );

}


$("exportTxt")
  .addEventListener(
    "click",
    exportTxt
  );


$("exportCsv")
  .addEventListener(
    "click",
    exportCsv
  );


$("exportJson")
  .addEventListener(
    "click",
    exportJson
  );


// ============================================================
// TERM ADMINISTRATION
// ============================================================

function setTermAdminMessage(
  text,
  isError = false
) {

  if (!termAdmin.message) {
    return;
  }


  if (!text) {

    clearMessage(
      termAdmin.message
    );

    return;

  }


  showMessage(
    termAdmin.message,
    text,
    isError
      ? "error"
      : "success"
  );

}


// ============================================================
// LOAD TERM ADMINISTRATION
// ============================================================

async function loadTermAdministration() {

  if (!termAdmin.section) {
    return;
  }


  // Default: hide everything.

  termAdmin.section
    .classList
    .add("hidden");


  termAdmin.secretaryPanel
    .classList
    .add("hidden");


  termAdmin.pendingPanel
    .classList
    .add("hidden");


  termAdmin.deputyArea
    .classList
    .add("hidden");


  termAdmin.finalizeArea
    .classList
    .add("hidden");


  currentTransitionRequest =
    null;


  setTermAdminMessage("");


  // Department heads never see this section.

  if (!isExecutive()) {
    return;
  }


  termAdmin.section
    .classList
    .remove("hidden");


  termAdmin.currentTerm
    .textContent =
      activeTerm?.name ||
      "No active term";


  if (!activeTerm) {

    setTermAdminMessage(
      "No active Synapse term exists.",
      true
    );

    return;

  }


  // ----------------------------------------------------------
  // FIND UNFINISHED REQUEST
  // ----------------------------------------------------------

  const {
    data,
    error
  } = await supabase
    .from(
      "term_transition_requests"
    )
    .select(`
      id,
      current_term_id,
      new_term_name,
      requested_by,
      deputy_approved_by,
      status,
      requested_at,
      deputy_approved_at
    `)
    .in(
      "status",
      [
        "PENDING",
        "DEPUTY_APPROVED"
      ]
    )
    .order(
      "requested_at",
      {
        ascending: false
      }
    )
    .limit(1);


  if (error) {

    console.error(
      "Transition status error:",
      error
    );


    setTermAdminMessage(
      "Could not retrieve term-transition status.",
      true
    );

    return;

  }


  const transition =
    data?.[0] ||
    null;


  // ----------------------------------------------------------
  // NO REQUEST
  // ----------------------------------------------------------

  if (!transition) {

    if (
      profile.position ===
      "Secretary"
    ) {

      termAdmin.secretaryPanel
        .classList
        .remove("hidden");

    }


    return;

  }


  currentTransitionRequest =
    transition;


  termAdmin.pendingPanel
    .classList
    .remove("hidden");


  termAdmin.transitionTitle
    .textContent =
      `${activeTerm.name} → ${transition.new_term_name}`;


  termAdmin.transitionStatus
    .textContent =
      transition.status ===
      "DEPUTY_APPROVED"
        ? "Deputy Approved"
        : "Awaiting Deputy Approval";


  // ----------------------------------------------------------
  // REQUESTER NAME
  // ----------------------------------------------------------

  const {
    data: requester
  } = await supabase
    .from("profiles")
    .select("name")
    .eq(
      "id",
      transition.requested_by
    )
    .maybeSingle();


  termAdmin.transitionRequester
    .textContent =
      requester?.name ||
      "Secretary";


  // ----------------------------------------------------------
  // DEPUTY SECRETARY CONTROL
  // ----------------------------------------------------------

  if (
    profile.position ===
      "Deputy Secretary" &&
    transition.status ===
      "PENDING"
  ) {

    termAdmin.deputyArea
      .classList
      .remove("hidden");

  }

  if (
    profile.position ===
      "Secretary" &&
    transition.status ===
      "DEPUTY_APPROVED"
  ) {
    termAdmin.finalizeArea
      .classList
      .remove("hidden");
  }
}

termAdmin.requestButton
  ?.addEventListener(
    "click",
    async () => {

      const newTerm =
        termAdmin.newTermInput
          .value
          .trim();
      if (!newTerm) {
        setTermAdminMessage(
          "Enter the new term name.",
          true
        );
        return;

      }

      const proceed =
        window.confirm(

          `Request transition from ` +
          `"${activeTerm?.name || "current term"}" ` +
          `to "${newTerm}"?\n\n` +

          `The Deputy Secretary must approve this request before it can be finalized.`

        );

      if (!proceed) {
        return;
      }

      termAdmin.requestButton
        .disabled = true;

      termAdmin.requestButton
        .textContent =
          "Creating Request...";
      setTermAdminMessage(
        "Creating transition request..."
      );

      const {
        data,
        error
      } = await supabase.rpc(
        "request_term_transition",
        {
          requested_new_term:
            newTerm
        }
      );
      termAdmin.requestButton
        .disabled = false;
      termAdmin.requestButton
        .textContent =
          "Request Term Transition";
      if (error) {
        console.error(error);
        setTermAdminMessage(
          error.message,
          true
        );
        return;
      }
      termAdmin.newTermInput
        .value = "";
      setTermAdminMessage(
        `Transition request #${data} created. Deputy Secretary approval is required.`
      );
      await loadTermAdministration();
    }
  );

termAdmin.approveButton
  ?.addEventListener(
    "click",
    async () => {
      if (!currentTransitionRequest) {
        return;
      }

      const proceed =
        window.confirm(

          `Approve the transition to ` +
          `"${currentTransitionRequest.new_term_name}"?\n\n` +

          `The Secretary will still need to perform the final confirmation.`

        );
      if (!proceed) {
        return;
      }
      termAdmin.approveButton
        .disabled = true;
      termAdmin.approveButton
        .textContent =
          "Approving...";

      const {
        error
      } = await supabase.rpc(
        "approve_term_transition",
        {
          transition_id:
            currentTransitionRequest.id
        }
      );

      termAdmin.approveButton
        .disabled = false;

      termAdmin.approveButton
        .textContent =
          "Approve as Deputy Secretary";

      if (error) {
        console.error(error);
        setTermAdminMessage(
          error.message,
          true
        );
        return;
      }
      setTermAdminMessage(
        "Deputy Secretary approval recorded."
      );
      await loadTermAdministration();
    }
  );

termAdmin.finalizeButton
  ?.addEventListener(
    "click",
    async () => {

      if (!currentTransitionRequest) {
        return;
      }

      const confirmation =
        termAdmin.confirmationInput
          .value
          .trim();
      if (
        confirmation !==
        "START NEW TERM"
      ) {
        setTermAdminMessage(
          'Type exactly "START NEW TERM" to continue.',
          true
        );
        return;
      }

      const newTerm =
        currentTransitionRequest
          .new_term_name;

      const proceed =
        window.confirm(

          `FINAL CONFIRMATION\n\n` +

          `Close "${activeTerm?.name || "the current term"}" ` +
          `and start "${newTerm}"?\n\n` +

          `The active ledger will immediately switch to the new term.`

        );
      if (!proceed) {
        return;
      }
      termAdmin.finalizeButton
        .disabled = true;
      termAdmin.finalizeButton
        .textContent =
          "Starting New Term...";

      const {
        error
      } = await supabase.rpc(
        "finalize_term_transition",
        {
          transition_id:
            currentTransitionRequest.id,

          confirmation_text:
            confirmation
        }
      );

      termAdmin.finalizeButton
        .disabled = false;

      termAdmin.finalizeButton
        .textContent =
          "Close Current Term & Start New Term";

      if (error) {
        console.error(error);
        setTermAdminMessage(
          error.message,
          true
        );
        return;
      }
      termAdmin.confirmationInput
        .value = "";
      setTermAdminMessage(
        `"${newTerm}" is now the active Synapse term.`
      );
      setTimeout(
        () => {

          window.location.reload();
        },
        1000
      );
    }
  );

const {
  data: {
    session
  }
} =
  await supabase.auth
    .getSession();
if (
  session?.user
) {
  await enterApp(
    session.user
  );
}
