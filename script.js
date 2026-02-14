import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyCUNjFesHA_nMEsULylFlEdNZHy-MlT7_o",
  authDomain: "webmilestoneplan.firebaseapp.com",
  projectId: "webmilestoneplan",
  storageBucket: "webmilestoneplan.firebasestorage.app",
  messagingSenderId: "757067401738",
  appId: "1:757067401738:web:697d0440b4aa7264562df3",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appEl = document.getElementById("app");
const loadingEl = document.getElementById("authLoading");

let currentUserRole = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const email = user.email.toLowerCase();

  try {
    const ref = doc(db, "allowed_users", email);
    const snap = await getDoc(ref);

    if (!snap.exists() || snap.data().enabled !== true) {
      await signOut(auth);
      window.location.href = "login.html?unauthorized=1";
      return;
    }

    // ✅ STORE ROLE GLOBALLY
    currentUserRole = snap.data().role;

    // 🔐 Apply UI restrictions based on role
   await applyRolePermissions(currentUserRole);


    // ✅ APPROVED → show app
    loadingEl.style.display = "none";
    appEl.classList.remove("hidden");
    restoreWorkOrderIfExists();

  } catch (err) {
    await signOut(auth);
    window.location.href = "login.html?unauthorized=1";
  }
});



const sections = document.querySelectorAll("main section");
const navLinks = document.querySelectorAll(".sidebar a");

let isClickScrolling = false;
let isInitialLoad = true;

// Force top force highlight
window.addEventListener("load", () => {
  window.history.scrollRestoration = "manual";

  setTimeout(() => {
    window.scrollTo(0, 0);

    navLinks.forEach((l) => l.classList.remove("active"));
    const defaultLink = document.querySelector('.sidebar a[href="#summary"]');
    if (defaultLink) defaultLink.classList.add("active");

    isInitialLoad = false;
  }, 0);
});

// Click highlight
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    isClickScrolling = true;

    navLinks.forEach((l) => l.classList.remove("active"));
    link.classList.add("active");

    setTimeout(() => {
      isClickScrolling = false;
    }, 500);
  });
});

// Scroll-based highlight
const observer = new IntersectionObserver(
  (entries) => {
    if (isClickScrolling || isInitialLoad) return;

    const visible = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

    if (!visible.length) return;

    const id = visible[0].target.id;

    navLinks.forEach((l) => l.classList.remove("active"));
    const activeLink = document.querySelector(`.sidebar a[href="#${id}"]`);
    if (activeLink) activeLink.classList.add("active");
  },
  {
    rootMargin: "-20% 0px -70% 0px",
  },
);

sections.forEach((section) => observer.observe(section));
const themeToggle = document.getElementById("themeToggle");

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  // Load saved theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  }
}

const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".sidebar");

if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    document.body.classList.toggle("sidebar-open");
  });
}
navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (window.innerWidth <= 1023) {
      sidebar.classList.remove("open");
      document.body.classList.remove("sidebar-open");
    }
  });
});
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    // 🧹 Clear active Work Order
    localStorage.removeItem("activeWorkOrder");

    signOut(auth).then(() => {
      window.location.href = "login.html";
    });
  });
}

const woModal = document.getElementById("woModal");
const woInput = document.getElementById("workOrderInput");
const woBtn = document.getElementById("enterWorkOrderBtn");
const woError = document.getElementById("woError");

// Hide app until WO is validated
appEl.classList.add("hidden");

woBtn.addEventListener("click", async () => {
  const woId = woInput.value.trim();

  if (!woId) {
    woError.textContent = "Please enter a Work Order number.";
    return;
  }

  woBtn.disabled = true;
  woError.textContent = "Checking work order…";

  try {
    const woRef = doc(db, "workorder", woId);
    const woSnap = await getDoc(woRef);

    if (!woSnap.exists()) {
      woError.textContent = "Work Order not found or access denied.";
      woBtn.disabled = false;
      return;
    }

    // ✅ Optional: access rule
    const data = woSnap.data();
    if (data.enabled === false) {
      woError.textContent = "This Work Order is currently locked.";
      woBtn.disabled = false;
      return;
    }

    // ✅ Success
    localStorage.setItem("activeWorkOrder", woId);
    woModal.style.display = "none";
    appEl.classList.remove("hidden");

    // 🔥 LOAD DATA USING woId
    loadWorkOrderData(woId);
    loadReportSummary();
    loadGeneralInfo();
    wireDayInput();
    await applyRolePermissions(currentUserRole);
  } catch (err) {
    woError.textContent = "Access check failed.";
    woBtn.disabled = false;
  }
});

function showLoading() {
  if (loadingEl) loadingEl.style.display = "flex";
  document.body.classList.add("blurred");
}

function hideLoading() {
  if (loadingEl) loadingEl.style.display = "none";
  document.body.classList.remove("blurred");
}

// 🔥 Universal Save Wrapper
async function withGlobalLoading(asyncTask) {
  showLoading();

  try {
    await asyncTask();
  } catch (err) {
    console.error("Operation failed:", err);
  }

  hideLoading();
}


function loadWorkOrderData(woId) {
  console.log("Loading data for WO:", woId);

  // Example:
  // collection(db, `workorder/${woId}/summary`)
  // collection(db, `workorder/${woId}/contacts`)
}

async function loadReportSummary() {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo) return;

  const ref = doc(db, "workorder", wo, "reportsummary", "main");
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const d = snap.data();

  document.getElementById("reportDate").textContent = d.reportdate || "-";
  document.getElementById("totalDays").textContent = d.days ?? "-";
  document.getElementById("startDate").textContent = d.startdate || "-";
  document.getElementById("endDate").textContent = d.enddate || "-";
}
function wireDayInput() {
  const input = document.getElementById("dayNoInput");
  if (!input) return;

  // Restore saved day on refresh
  const savedDay = localStorage.getItem("activeDay");
  if (savedDay) {
    input.value = savedDay;
    handleDayInputChange();
  }

  // ENTER key
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // ⛔ prevent form submit
      handleDayInputChange();
    }
  });

  // CLICK OUTSIDE / BLUR
  input.addEventListener("blur", () => {
    handleDayInputChange();
  });
}

async function loadGeneralInfo(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo) return;

  const ref = doc(db, "workorder", wo, "generalinfo", "main");

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // reset General Info UI
    document.getElementById("gi-customer").textContent = "-";
    document.getElementById("gi-agency").textContent = "-";
    document.getElementById("gi-tailsign").textContent = "-";
    document.getElementById("tailSign").textContent = "-";
    document.getElementById("gi-station").textContent = "-";
    document.getElementById("gi-aircrafttype").textContent = "-";
    document.getElementById("aircraftType").textContent = "-";
    document.getElementById("gi-bay").textContent = "-";
    document.getElementById("gi-msn").textContent = "-";
    document.getElementById("gi-workorder").textContent = wo;
    document.getElementById("gi-checktype").textContent = "-";
    document.getElementById("gi-workpack").textContent = "-";

    document.title = "Daily Status Report";
    return;
  }

  const d = snap.data();

  document.getElementById("gi-customer").textContent = d.customer || "-";
  document.getElementById("gi-agency").textContent = d.agency || "-";
  document.getElementById("gi-tailsign").textContent = d.tailsign || "-";
  document.getElementById("tailSign").textContent = d.tailsign || "-";
  document.getElementById("gi-station").textContent = d.station || "-";
  document.getElementById("gi-aircrafttype").textContent =
    d.aircrafttype || "-";
  document.getElementById("aircraftType").textContent = d.aircrafttype || "-";
  document.getElementById("gi-bay").textContent = d.bay || "-";
  document.getElementById("gi-msn").textContent = d.msn || "-";
  document.getElementById("gi-workorder").textContent = wo;
  document.getElementById("gi-checktype").textContent = d.checktype || "-";
  document.getElementById("gi-workpack").textContent = d.workpack || "-";

  const tail = d.tailsign || "-";
  document.title = `Daily Status Report – ${tail}`;
}
function restoreWorkOrderIfExists() {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo) return;

  // hide popup
  woModal.style.display = "none";
  appEl.classList.remove("hidden");

  // load default day (Day 1 for now)
  loadGeneralInfo();
  loadReportSummary();
  wireDayInput();

  console.log("Restored WO from storage:", wo);
}
async function loadContacts(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const tbody = document.getElementById("contactsBody");
  if (!tbody) return;

  tbody.innerHTML = ""; // clear on reload / refresh

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(dayNo),
    "contacts",
  );

  const snap = await getDocs(ref);

 const contacts = snap.docs.map(doc => doc.data());

contacts.sort((a, b) =>
  a.category.localeCompare(b.category, undefined, { sensitivity: "base" })
);

contacts.forEach(d => {
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>${d.category || ""}</td>
    <td>${d.position || ""}</td>
    <td>${d.name || ""}</td>
    <td>${d.email || ""}</td>
  `;

  tbody.appendChild(tr);
});

}
function applyStatusBadge(el, status) {
  if (!el) return;

  el.classList.remove("ok", "warn", "bad");
  el.classList.add("badge"); // ensure badge class
  el.textContent = status || "-";

  const s = (status || "").toLowerCase();

  // Layover / general statuses
  if (s === "completed" || s === "closed") {
    el.classList.add("ok");
  } else if (s === "ongoing" || s === "pending") {
    el.classList.add("warn");
  } else if (s === "not started" || s === "open") {
    el.classList.add("bad");
  } else if (s === "cancelled") {
    el.classList.add("warn"); // optional choice
  }
}

async function loadLayoverStatus(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const ref = doc(
    db,
    "workorder",
    wo,
    "days",
    String(dayNo),
    "layoverstatus",
    "main",
  );

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    applyStatusBadge(document.getElementById("ls-inspection"), "-");
    applyStatusBadge(document.getElementById("ls-rectification"), "-");
    applyStatusBadge(document.getElementById("ls-reinstallation"), "-");
    applyStatusBadge(document.getElementById("ls-final"), "-");
    return;
  }

  const d = snap.data();

  applyStatusBadge(document.getElementById("ls-inspection"), d.inspection);

  applyStatusBadge(
    document.getElementById("ls-rectification"),
    d.rectification,
  );

  applyStatusBadge(
    document.getElementById("ls-reinstallation"),
    d.reinstallation,
  );

  applyStatusBadge(document.getElementById("ls-final"), d.final);
}
async function loadLayoverDates(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const ref = doc(
    db,
    "workorder",
    wo,
    "days",
    String(dayNo),
    "layoverdate",
    "main",
  );

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    applyStatusBadge(document.getElementById("ld-arrival"), "-");
    applyStatusBadge(document.getElementById("ld-departure"), "-");
    applyStatusBadge(document.getElementById("ld-flighttype"), "-");
    applyStatusBadge(document.getElementById("ld-plannedtat"), "-");
    return;
  }

  const d = snap.data();

  document.getElementById("ld-arrival").textContent = d.arrival || "-";
  document.getElementById("ld-departure").textContent = d.departure || "-";
  document.getElementById("ld-flighttype").textContent = d.flighttype || "-";
  document.getElementById("ld-plannedtat").textContent = d.plannedtat || "-";
}
async function loadTatItems(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const tbody = document.getElementById("tatBody");
  if (!tbody) return;

  tbody.innerHTML = ""; // clear on reload / refresh

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(dayNo),
    "tatitems",
  );

  const snap = await getDocs(ref);

  snap.forEach((docSnap) => {
    const d = docSnap.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.description || "-"}</td>
      <td>${d.skill || "-"}</td>
      <td>${d.details || "-"}</td>
    `;

    tbody.appendChild(tr);
  });
}
async function loadMilestones(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const tbody = document.getElementById("milestonesBody");
  if (!tbody) return;

  tbody.innerHTML = ""; // clear on reload / refresh

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(dayNo),
    "milestones",
  );

  const snap = await getDocs(ref);

  snap.forEach((docSnap) => {
    const d = docSnap.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.description || "-"}</td>
      <td>${d.target || "-"}</td>
      <td>${d.revision || "-"}</td>
      <td>${d.achieved || "-"}</td>
      <td>${d.remarks || ""}</td>
    `;

    tbody.appendChild(tr);
  });
}
async function loadTaskCards(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const tbody = document.getElementById("taskcardBody");
  if (!tbody) return;

  tbody.innerHTML = ""; // clear on reload / refresh

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(dayNo),
    "taskcard",
  );

  const snap = await getDocs(ref);

  snap.forEach((docSnap) => {
    const d = docSnap.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.description || "-"}</td>
      <td>${d.total ?? "-"}</td>
      <td>${d.open ?? "-"}</td>
      <td>${d.closed ?? "-"}</td>
      <td>${d.percentclosed || "-"}</td>
      <td>${d.remarks || ""}</td>
    `;

    tbody.appendChild(tr);
  });
}
async function loadHighlights(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const container = document.getElementById("highlightsBody");
  if (!container) return;

  container.innerHTML = ""; // clear on reload / refresh

  const ref = doc(
    db,
    "workorder",
    wo,
    "days",
    String(dayNo),
    "highlights",
    "main",
  );

  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const { sections = [] } = snap.data();

  sections.forEach((sec) => {
    // Paragraph with label
    if (sec.type === "p") {
      const p = document.createElement("p");

      if (sec.label) {
        const strong = document.createElement("strong");
        strong.textContent = sec.label + ": ";
        p.appendChild(strong);
      }

      p.appendChild(document.createTextNode(sec.text || ""));
      container.appendChild(p);
    }

    // Bullet list (future-proof, already supported)
    if (sec.type === "ul" && Array.isArray(sec.items)) {
      const ul = document.createElement("ul");
      sec.items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }
  });
}
async function loadWorkCenter(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const tbody = document.getElementById("workcenterBody");
  if (!tbody) return;

  tbody.innerHTML = ""; // clear on reload

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(dayNo),
    "workcenter",
  );

  const snap = await getDocs(ref);

  // 🔥 Convert to array first
  const workcenters = snap.docs.map(doc => doc.data());

  // 🔥 Sort alphabetically (case-insensitive)
  workcenters.sort((a, b) =>
    (a.workcenter || "").localeCompare(
      (b.workcenter || ""),
      undefined,
      { sensitivity: "base" }
    )
  );

  // 🔥 Render sorted rows
  workcenters.forEach(d => {

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${d.workcenter || "-"}</td>
      <td>${d.status || "-"}</td>
    `;

    tbody.appendChild(tr);
  });
}

async function loadIDD(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const tbody = document.getElementById("iddBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const ref = collection(db, "workorder", wo, "days", String(dayNo), "idd");
  const snap = await getDocs(ref);

  snap.forEach((docSnap) => {
    const d = docSnap.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.item ?? "-"}</td>
      <td>${d.taskcard || "-"}</td>
      <td>${d.customerref || "-"}</td>
      <td>${d.description || "-"}</td>
      <td></td>
    `;

    const statusSpan = document.createElement("span");
    applyStatusBadge(statusSpan, d.status);
    tr.children[4].appendChild(statusSpan);

    tbody.appendChild(tr);
  });
}
async function loadODD(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const tbody = document.getElementById("oddBody");
  if (!tbody) return;

  tbody.innerHTML = ""; // clear on reload / refresh

  const ref = collection(db, "workorder", wo, "days", String(dayNo), "odd");

  const snap = await getDocs(ref);

  snap.forEach((docSnap) => {
    const d = docSnap.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.item ?? "-"}</td>
      <td>${d.taskcard || "-"}</td>
      <td>${d.customerref || "-"}</td>
      <td>${d.description || "-"}</td>
      <td></td>
    `;

    const statusSpan = document.createElement("span");
    applyStatusBadge(statusSpan, d.status); // 🔥 SAME BADGE LOGIC
    tr.children[4].appendChild(statusSpan);

    tbody.appendChild(tr);
  });
}
async function loadMaterialTools(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const container = document.getElementById("materialsBody");
  if (!container) return;

  container.innerHTML = ""; // clear on reload / refresh

  const ref = doc(
    db,
    "workorder",
    wo,
    "days",
    String(dayNo),
    "materialtools",
    "main",
  );

  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const { sections = [] } = snap.data();

  sections.forEach((sec) => {
    if (sec.type === "p") {
      const p = document.createElement("p");

      if (sec.label) {
        const strong = document.createElement("strong");
        strong.textContent = sec.label + ": ";
        p.appendChild(strong);
      }

      p.appendChild(document.createTextNode(sec.text || ""));
      container.appendChild(p);
    }
  });
}
async function loadRFSS(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const tbody = document.getElementById("rfssBody");
  if (!tbody) return;

  tbody.innerHTML = ""; // clear on reload / refresh

  const ref = collection(db, "workorder", wo, "days", String(dayNo), "rfss");

  const snap = await getDocs(ref);

  snap.forEach((docSnap) => {
    const d = docSnap.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.area || "-"}</td>
      <td>${d.nrref || "-"}</td>
      <td>${d.description || "-"}</td>
      <td>${d.status || "-"}</td>
    `;

    tbody.appendChild(tr);
  });
}
async function loadActionItems(dayNo) {
  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo || !dayNo) return;

  const tbody = document.getElementById("actionBody");
  if (!tbody) return;

  tbody.innerHTML = ""; // clear on reload / refresh

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(dayNo),
    "actionitems",
  );

  const snap = await getDocs(ref);

  snap.forEach((docSnap) => {
    const d = docSnap.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.item ?? "-"}</td>
      <td>${d.description || "-"}</td>
      <td>${d.responsible || "-"}</td>
      <td>${d.target || "-"}</td>
      <td></td>
    `;

    const statusSpan = document.createElement("span");
    applyStatusBadge(statusSpan, d.status); // 🔥 SAME BADGE SYSTEM
    tr.children[4].appendChild(statusSpan);

    tbody.appendChild(tr);
  });
}
function loadAllDayData(dayNo) {
  if (!dayNo) return;

  localStorage.setItem("activeDay", dayNo);

  loadContacts(dayNo);
  loadLayoverStatus(dayNo);
  loadLayoverDates(dayNo);
  loadTatItems(dayNo);
  loadMilestones(dayNo);
  loadTaskCards(dayNo);
  loadHighlights(dayNo);
  loadWorkCenter(dayNo);
  loadIDD(dayNo);
  loadODD(dayNo);
  loadMaterialTools(dayNo);
  loadRFSS(dayNo);
  loadActionItems(dayNo);
}
async function handleDayInputChange() {
  const input = document.getElementById("dayNoInput");
  if (!input) return;

  const day = input.value.trim();
  if (!day) return;

  const wo = localStorage.getItem("activeWorkOrder");
  if (!wo) return;

  const dayRef = doc(db, "workorder", wo, "days", day);
  const snap = await getDoc(dayRef);

  // Save what user typed (always)
  localStorage.setItem("activeDay", day);
  input.value = day;

  if (!snap.exists()) {
    alert(`Day ${day} does not exist`);
    return; // ⛔ do NOT load data
  }

  // ✅ Day exists → load everything
  loadAllDayData(day);
}
const cancelBtn = document.getElementById("cancelWorkOrderBtn");

if (cancelBtn) {
  cancelBtn.addEventListener("click", async () => {
    localStorage.removeItem("activeWorkOrder");
    await signOut(auth);
    window.location.href = "login.html";
  });
}
const createReportBtn = document.getElementById("createReportBtn");

if (createReportBtn) {
  createReportBtn.addEventListener("click", async () => {
    const woId = woInput.value.trim();

    if (!woId) {
      woError.textContent = "Enter a Work Order number first.";
      return;
    }

    woError.textContent = "Checking existing Work Order…";

    try {
      const woRef = doc(db, "workorder", woId);
      const woSnap = await getDoc(woRef);

      // 🔒 PREVENT DUPLICATE
      if (woSnap.exists()) {
        woError.textContent = "Work Order already exists.";
        return;
      }

      // ✅ CREATE BASE WORK ORDER
      await setDoc(woRef, {
        enabled: true,
        createdAt: new Date(),
      });

      // ✅ AUTO-GENERATE DAY 1
      const dayRef = doc(db, "workorder", woId, "days", "1");
      await setDoc(dayRef, {
        createdAt: new Date(),
      });

      // Optional: auto-create substructures
      await setDoc(
        doc(db, "workorder", woId, "days", "1", "layoverstatus", "main"),
        {
          inspection: "Not Started",
          rectification: "Not Started",
          reinstallation: "Not Started",
          final: "Not Started",
        },
      );

      // Save locally
      localStorage.setItem("activeWorkOrder", woId);
      localStorage.setItem("activeDay", "1");

      woModal.style.display = "none";
      appEl.classList.remove("hidden");

      // Load app
      loadGeneralInfo();
      loadReportSummary();
      wireDayInput();
      loadAllDayData("1");
    } catch (err) {
      woError.textContent = "Failed to create report.";
      console.error(err);
    }
  });
}

const createDayBtn = document.getElementById("createDayBtn");

if (createDayBtn) {
  createDayBtn.addEventListener("click", async () => {

    const wo = localStorage.getItem("activeWorkOrder");
    if (!wo) {
      alert("Select a Work Order first.");
      return;
    }

    const nextDay = prompt("Enter Day number to create:");

    if (!nextDay) return;

    const dayRef = doc(db, "workorder", wo, "days", nextDay);

    const existing = await getDoc(dayRef);
    if (existing.exists()) {
      alert("Day already exists.");
      return;
    }

    await setDoc(dayRef, {
      createdAt: new Date()
    });

    alert(`Day ${nextDay} created successfully.`);
  });
}
async function applyRolePermissions(role) {

  const createDayBtn = document.getElementById("createDayBtn");

  const editGeneralBtn = document.getElementById("editGeneralBtn");
  const saveGeneralBtn = document.getElementById("saveGeneralBtn");
  const generalInfoActions = document.getElementById("generalInfoActions");

  const wo = localStorage.getItem("activeWorkOrder");

  let isExpired = true; // secure default

  if (wo) {
    const ref = doc(db, "workorder", wo, "reportsummary", "main");
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const endDateStr = snap.data().enddate;

      if (endDateStr) {
        const today = new Date();
        today.setHours(0,0,0,0);

        const endDate = new Date(endDateStr);
        endDate.setHours(0,0,0,0);

        isExpired = today > endDate;
      }
    }
  }

  // ==========================
  // GENERAL INFO EDIT CONTROL
  // ==========================

  if (role === "admin" && !isExpired) {

    if (generalInfoActions)
      generalInfoActions.classList.remove("hidden");

    if (editGeneralBtn) {
      editGeneralBtn.disabled = false;
      editGeneralBtn.style.opacity = "1";
      editGeneralBtn.style.cursor = "pointer";
    }

  } else {

    if (editGeneralBtn) {
      editGeneralBtn.disabled = true;
      editGeneralBtn.style.opacity = "0.4";
      editGeneralBtn.style.cursor = "not-allowed";
    }

    if (saveGeneralBtn)
      saveGeneralBtn.classList.add("hidden");
  }

    const contactsActions = document.getElementById("contactsActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (contactsActions) contactsActions.classList.remove("hidden");
      } else {
        if (contactsActions) contactsActions.classList.add("hidden");
      }

    const layoverStatusActions = document.getElementById("layoverStatusActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (layoverStatusActions)
          layoverStatusActions.classList.remove("hidden");
      } else {
        if (layoverStatusActions)
          layoverStatusActions.classList.add("hidden");
      }

      const layoverDatesActions = document.getElementById("layoverDatesActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (layoverDatesActions)
          layoverDatesActions.classList.remove("hidden");
      } else {
        if (layoverDatesActions)
          layoverDatesActions.classList.add("hidden");
      }

      const tatActions = document.getElementById("tatActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (tatActions) tatActions.classList.remove("hidden");
      } else {
        if (tatActions) tatActions.classList.add("hidden");
      }
      const milestoneActions = document.getElementById("milestoneActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (milestoneActions) milestoneActions.classList.remove("hidden");
      } else {
        if (milestoneActions) milestoneActions.classList.add("hidden");
      }
      const taskcardActions = document.getElementById("taskcardActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (taskcardActions) taskcardActions.classList.remove("hidden");
      } else {
        if (taskcardActions) taskcardActions.classList.add("hidden");
      }
      const highlightsActions = document.getElementById("highlightsActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (highlightsActions) highlightsActions.classList.remove("hidden");
      } else {
        if (highlightsActions) highlightsActions.classList.add("hidden");
      }
      const workcenterActions = document.getElementById("workcenterActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (workcenterActions) workcenterActions.classList.remove("hidden");
      } else {
        if (workcenterActions) workcenterActions.classList.add("hidden");
      }
      const iddActions = document.getElementById("iddActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (iddActions) iddActions.classList.remove("hidden");
      } else {
        if (iddActions) iddActions.classList.add("hidden");
      }
      const oddActions = document.getElementById("oddActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (oddActions) oddActions.classList.remove("hidden");
      } else {
        if (oddActions) oddActions.classList.add("hidden");
      }
      const materialsActions = document.getElementById("materialsActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (materialsActions) materialsActions.classList.remove("hidden");
      } else {
        if (materialsActions) materialsActions.classList.add("hidden");
      }
      const rfssActions = document.getElementById("rfssActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (rfssActions) rfssActions.classList.remove("hidden");
      } else {
        if (rfssActions) rfssActions.classList.add("hidden");
      }
      const actionActions = document.getElementById("actionActions");
      if ((role === "admin" || role === "editor") && !isExpired) {
        if (actionActions) actionActions.classList.remove("hidden");
      } else {
        if (actionActions) actionActions.classList.add("hidden");
      }

}
let originalGeneralInfoData = {};

const editGeneralBtn = document.getElementById("editGeneralBtn");
const saveGeneralBtn = document.getElementById("saveGeneralBtn");

const editableGeneralFields = [
  "gi-customer",
  "gi-agency",
  "gi-tailsign",
  "gi-station",
  "gi-aircrafttype",
  "gi-bay",
  "gi-msn",
  "gi-checktype",
  "gi-workpack"
];


if (editGeneralBtn && saveGeneralBtn) {

  // =========================
  // ENTER EDIT MODE
  // =========================
 editGeneralBtn.addEventListener("click", () => {

  originalGeneralInfoData = {};

  editableGeneralFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      originalGeneralInfoData[id] = el.textContent;
      el.setAttribute("contenteditable", "true");
      el.classList.add("editing");
    }
  });

  editGeneralBtn.classList.add("hidden");
  saveGeneralBtn.classList.remove("hidden");
});


  // =========================
  // SAVE GENERAL INFO
  // =========================
 saveGeneralBtn.addEventListener("click", async () => {

  await withGlobalLoading(async () => {

    const wo = localStorage.getItem("activeWorkOrder");
    if (!wo) return;

    const data = {
      customer: document.getElementById("gi-customer")?.textContent || "",
      agency: document.getElementById("gi-agency")?.textContent || "",
      tailsign: document.getElementById("gi-tailsign")?.textContent || "",
      station: document.getElementById("gi-station")?.textContent || "",
      aircrafttype: document.getElementById("gi-aircrafttype")?.textContent || "",
      bay: document.getElementById("gi-bay")?.textContent || "",
      msn: document.getElementById("gi-msn")?.textContent || "",
      checktype: document.getElementById("gi-checktype")?.textContent || "",
      workpack: document.getElementById("gi-workpack")?.textContent || ""
    };

    const ref = doc(db, "workorder", wo, "generalinfo", "main");
    await setDoc(ref, data, { merge: true });

    exitEditMode();
    loadGeneralInfo();
  });

});


  // =========================
  // ESC KEY CANCEL
  // =========================
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !editGeneralBtn.classList.contains("hidden")) {
      return; // not editing
    }

    if (e.key === "Escape") {
      cancelEditMode();
    }
  });
}
function exitEditMode() {
  editableGeneralFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.removeAttribute("contenteditable");
      el.classList.remove("editing");
    }
  });

  saveGeneralBtn.classList.add("hidden");
  editGeneralBtn.classList.remove("hidden");
}


function cancelEditMode() {

  editableGeneralFields.forEach(id => {
    const el = document.getElementById(id);
    if (el && originalGeneralInfoData[id] !== undefined) {
      el.textContent = originalGeneralInfoData[id];
      el.removeAttribute("contenteditable");
      el.classList.remove("editing");
    }
  });

  saveGeneralBtn.classList.add("hidden");
  editGeneralBtn.classList.remove("hidden");
}
const editContactsBtn = document.getElementById("editContactsBtn");
const saveContactsBtn = document.getElementById("saveContactsBtn");
const addContactBtn = document.getElementById("addContactBtn");

let originalContactsData = [];
let contactsEditMode = false;

if (editContactsBtn && saveContactsBtn) {

  editContactsBtn.addEventListener("click", () => {
    enterContactsEditMode();
  });

  saveContactsBtn.addEventListener("click", async () => {
    await saveContacts();
  });

  addContactBtn.addEventListener("click", () => {
    addContactRow();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && contactsEditMode) {
      cancelContactsEdit();
    }
  });
}
function enterContactsEditMode() {
document.getElementById("contactsDeleteHeader")
  ?.classList.remove("hidden");

  const tbody = document.getElementById("contactsBody");
  if (!tbody) return;

  originalContactsData = [];
  contactsEditMode = true;

Array.from(tbody.rows).forEach(row => {

  const rowData = [];
  Array.from(row.cells).forEach(cell => {
    rowData.push(cell.textContent);
    cell.setAttribute("contenteditable", "true");
    cell.classList.add("editing");
  });

  originalContactsData.push(rowData);

  // 🔥 Add delete cell if not already present
  if (row.cells.length === 4) {
    const deleteCell = document.createElement("td");

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑";
    deleteBtn.classList.add("delete-btn");

    deleteBtn.addEventListener("click", () => {
      row.remove();
    });

    deleteCell.appendChild(deleteBtn);
    row.appendChild(deleteCell);
  }
});


  editContactsBtn.classList.add("hidden");
  saveContactsBtn.classList.remove("hidden");
  addContactBtn.classList.remove("hidden");
}
function cancelContactsEdit() {

  const tbody = document.getElementById("contactsBody");
  if (!tbody) return;

  Array.from(tbody.rows).forEach((row, rowIndex) => {
    Array.from(row.cells).forEach((cell, cellIndex) => {
      cell.textContent = originalContactsData[rowIndex][cellIndex];
      cell.removeAttribute("contenteditable");
      cell.classList.remove("editing");
    });
  });
document.getElementById("contactsDeleteHeader")
  ?.classList.add("hidden");

Array.from(tbody.rows).forEach(row => {
  if (row.cells.length === 5) {
    row.deleteCell(4);
  }
});

  contactsEditMode = false;

  saveContactsBtn.classList.add("hidden");
  addContactBtn.classList.add("hidden");
  editContactsBtn.classList.remove("hidden");
}
async function saveContacts() {

  const wo = localStorage.getItem("activeWorkOrder");
  const day = localStorage.getItem("activeDay");

  if (!wo || !day) return;

  const tbody = document.getElementById("contactsBody");
  if (!tbody) return;

  const ref = collection(db, "workorder", wo, "days", day, "contacts");

  // 🔹 Hide delete header
  document.getElementById("contactsDeleteHeader")
    ?.classList.add("hidden");

  // 🔹 Remove delete column from UI
  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 5) {
      row.deleteCell(4);
    }
  });

  // 🔥 STEP 1 — DELETE ALL EXISTING CONTACT DOCS
  const existingSnap = await getDocs(ref);
  const deletePromises = existingSnap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);

  // 🔥 STEP 2 — COLLECT CURRENT TABLE ROWS
  const rows = Array.from(tbody.rows)
    .map(row => {
      const [category, position, name, email] =
        Array.from(row.cells).map(cell => cell.textContent.trim());

      if (!category && !position && !name && !email) return null;

      return { category, position, name, email };
    })
    .filter(Boolean);

  // 🔥 STEP 3 — SAVE CLEAN DATA USING STABLE IDS
  const savePromises = rows.map((contact, index) =>
    setDoc(doc(ref, `contact_${index}`), contact)
  );

  await Promise.all(savePromises);

  // 🔹 Reset UI
  contactsEditMode = false;

  saveContactsBtn.classList.add("hidden");
  addContactBtn.classList.add("hidden");
  editContactsBtn.classList.remove("hidden");

  loadContacts(day);
}


saveContactsBtn.addEventListener("click", async () => {
  await withGlobalLoading(saveContacts);
});



function addContactRow() {

  const tbody = document.getElementById("contactsBody");
  if (!tbody) return;

  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
  `;

  tbody.appendChild(tr);
}

// EDIT/SAVE LAYOVER STATUS
const editLayoverBtn = document.getElementById("editLayoverBtn");
const saveLayoverBtn = document.getElementById("saveLayoverBtn");

let originalLayoverData = {};
let layoverEditMode = false;

const layoverFields = [
  "ls-inspection",
  "ls-rectification",
  "ls-reinstallation",
  "ls-final"
];

if (editLayoverBtn && saveLayoverBtn) {

  // ENTER EDIT MODE
  editLayoverBtn.addEventListener("click", () => {

    originalLayoverData = {};
    layoverEditMode = true;

    layoverFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        originalLayoverData[id] = el.textContent;

        el.setAttribute("contenteditable", "true");
        el.classList.add("editing");

        // remove badge color while editing
        el.classList.remove("ok", "warn", "bad");
      }
    });

    editLayoverBtn.classList.add("hidden");
    saveLayoverBtn.classList.remove("hidden");
  });


  // SAVE LAYOVER STATUS
  saveLayoverBtn.addEventListener("click", async () => {

    await withGlobalLoading(async () => {

      const wo = localStorage.getItem("activeWorkOrder");
      const day = localStorage.getItem("activeDay");

      if (!wo || !day) return;

      const data = {
        inspection: document.getElementById("ls-inspection")?.textContent.trim() || "",
        rectification: document.getElementById("ls-rectification")?.textContent.trim() || "",
        reinstallation: document.getElementById("ls-reinstallation")?.textContent.trim() || "",
        final: document.getElementById("ls-final")?.textContent.trim() || ""
      };

      const ref = doc(
        db,
        "workorder",
        wo,
        "days",
        String(day),
        "layoverstatus",
        "main"
      );

      await setDoc(ref, data, { merge: true });

      exitLayoverEditMode();
      loadLayoverStatus(day);
    });

  });


  // ESC CANCEL
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && layoverEditMode) {
      cancelLayoverEditMode();
    }
  });
}

function exitLayoverEditMode() {

  layoverFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.removeAttribute("contenteditable");
      el.classList.remove("editing");
    }
  });

  layoverEditMode = false;

  saveLayoverBtn.classList.add("hidden");
  editLayoverBtn.classList.remove("hidden");
}

function cancelLayoverEditMode() {

  layoverFields.forEach(id => {
    const el = document.getElementById(id);
    if (el && originalLayoverData[id] !== undefined) {
      el.textContent = originalLayoverData[id];
      el.removeAttribute("contenteditable");
      el.classList.remove("editing");
    }
  });

  layoverEditMode = false;

  saveLayoverBtn.classList.add("hidden");
  editLayoverBtn.classList.remove("hidden");
}

// EDIT/SAVE LAYOVER DATES
const editLayoverDatesBtn = document.getElementById("editLayoverDatesBtn");
const saveLayoverDatesBtn = document.getElementById("saveLayoverDatesBtn");

let originalLayoverDatesData = {};
let layoverDatesEditMode = false;

const layoverDateFields = [
  "ld-arrival",
  "ld-departure",
  "ld-flighttype",
  "ld-plannedtat"
];

if (editLayoverDatesBtn && saveLayoverDatesBtn) {

  // ENTER EDIT MODE
  editLayoverDatesBtn.addEventListener("click", () => {

    originalLayoverDatesData = {};
    layoverDatesEditMode = true;

    layoverDateFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        originalLayoverDatesData[id] = el.textContent;

        el.setAttribute("contenteditable", "true");
        el.classList.add("editing");
      }
    });

    editLayoverDatesBtn.classList.add("hidden");
    saveLayoverDatesBtn.classList.remove("hidden");
  });


  // SAVE
  saveLayoverDatesBtn.addEventListener("click", async () => {

    await withGlobalLoading(async () => {

      const wo = localStorage.getItem("activeWorkOrder");
      const day = localStorage.getItem("activeDay");

      if (!wo || !day) return;

      const data = {
        arrival: document.getElementById("ld-arrival")?.textContent.trim() || "",
        departure: document.getElementById("ld-departure")?.textContent.trim() || "",
        flighttype: document.getElementById("ld-flighttype")?.textContent.trim() || "",
        plannedtat: document.getElementById("ld-plannedtat")?.textContent.trim() || ""
      };

      const ref = doc(
        db,
        "workorder",
        wo,
        "days",
        String(day),
        "layoverdate",
        "main"
      );

      await setDoc(ref, data, { merge: true });

      exitLayoverDatesEditMode();
      loadLayoverDates(day);
    });

  });


  // ESC CANCEL
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && layoverDatesEditMode) {
      cancelLayoverDatesEditMode();
    }
  });
}

function exitLayoverDatesEditMode() {

  layoverDateFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.removeAttribute("contenteditable");
      el.classList.remove("editing");
    }
  });

  layoverDatesEditMode = false;

  saveLayoverDatesBtn.classList.add("hidden");
  editLayoverDatesBtn.classList.remove("hidden");
}

function cancelLayoverDatesEditMode() {

  layoverDateFields.forEach(id => {
    const el = document.getElementById(id);
    if (el && originalLayoverDatesData[id] !== undefined) {
      el.textContent = originalLayoverDatesData[id];
      el.removeAttribute("contenteditable");
      el.classList.remove("editing");
    }
  });

  layoverDatesEditMode = false;

  saveLayoverDatesBtn.classList.add("hidden");
  editLayoverDatesBtn.classList.remove("hidden");
}

// EDIT/SAVE TAT RELEVANT ITEMS

const editTatBtn = document.getElementById("editTatBtn");
const saveTatBtn = document.getElementById("saveTatBtn");
const addTatBtn = document.getElementById("addTatBtn");

let tatEditMode = false;
let originalTatData = [];

if (editTatBtn && saveTatBtn) {

  editTatBtn.addEventListener("click", () => {
    enterTatEditMode();
  });

  saveTatBtn.addEventListener("click", async () => {
    await withGlobalLoading(saveTatItems);
  });

  addTatBtn.addEventListener("click", () => {
    addTatRow();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && tatEditMode) {
      cancelTatEdit();
    }
  });
}

function enterTatEditMode() {

  const tbody = document.getElementById("tatBody");
  if (!tbody) return;

  tatEditMode = true;
  originalTatData = [];

  document.getElementById("tatDeleteHeader")
    ?.classList.remove("hidden");

  Array.from(tbody.rows).forEach(row => {

    const rowData = [];

    Array.from(row.cells).forEach(cell => {
      rowData.push(cell.textContent);
      cell.setAttribute("contenteditable", "true");
      cell.classList.add("editing");
    });

    originalTatData.push(rowData);

    // Add delete button column
    if (row.cells.length === 3) {
      const deleteCell = document.createElement("td");

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑";
      deleteBtn.classList.add("delete-btn");

      deleteBtn.addEventListener("click", () => {
        row.remove();
      });

      deleteCell.appendChild(deleteBtn);
      row.appendChild(deleteCell);
    }
  });

  editTatBtn.classList.add("hidden");
  saveTatBtn.classList.remove("hidden");
  addTatBtn.classList.remove("hidden");
}

function cancelTatEdit() {

  const tbody = document.getElementById("tatBody");
  if (!tbody) return;

  Array.from(tbody.rows).forEach((row, rowIndex) => {
    Array.from(row.cells).forEach((cell, cellIndex) => {
      if (originalTatData[rowIndex])
        cell.textContent = originalTatData[rowIndex][cellIndex];

      cell.removeAttribute("contenteditable");
      cell.classList.remove("editing");
    });
  });

  document.getElementById("tatDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 4) {
      row.deleteCell(3);
    }
  });

  tatEditMode = false;

  saveTatBtn.classList.add("hidden");
  addTatBtn.classList.add("hidden");
  editTatBtn.classList.remove("hidden");
}

function addTatRow() {

  const tbody = document.getElementById("tatBody");
  if (!tbody) return;

  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
  `;

  // Add delete column
  const deleteCell = document.createElement("td");
  const deleteBtn = document.createElement("button");

  deleteBtn.textContent = "🗑";
  deleteBtn.classList.add("delete-btn");

  deleteBtn.addEventListener("click", () => {
    tr.remove();
  });

  deleteCell.appendChild(deleteBtn);
  tr.appendChild(deleteCell);

  tbody.appendChild(tr);
}

async function saveTatItems() {

  const wo = localStorage.getItem("activeWorkOrder");
  const day = localStorage.getItem("activeDay");

  if (!wo || !day) return;

  const tbody = document.getElementById("tatBody");
  if (!tbody) return;

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(day),
    "tatitems"
  );

  // Remove delete column header
  document.getElementById("tatDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 4) {
      row.deleteCell(3);
    }
  });

  // Delete existing docs
  const existingSnap = await getDocs(ref);
  const deletePromises = existingSnap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);

  // Collect rows
  const rows = Array.from(tbody.rows)
    .map(row => {
      const [description, skill, details] =
        Array.from(row.cells).map(cell => cell.textContent.trim());

      if (!description && !skill && !details) return null;

      return { description, skill, details };
    })
    .filter(Boolean);

  // Save clean indexed docs
  const savePromises = rows.map((item, index) =>
    setDoc(doc(ref, `tat_${index}`), item)
  );

  await Promise.all(savePromises);

  tatEditMode = false;

  saveTatBtn.classList.add("hidden");
  addTatBtn.classList.add("hidden");
  editTatBtn.classList.remove("hidden");

  loadTatItems(day);
}
// EDIT-SAVE MILESTONE
const editMilestoneBtn = document.getElementById("editMilestoneBtn");
const saveMilestoneBtn = document.getElementById("saveMilestoneBtn");
const addMilestoneBtn = document.getElementById("addMilestoneBtn");

let milestoneEditMode = false;
let originalMilestoneData = [];

if (editMilestoneBtn && saveMilestoneBtn) {

  editMilestoneBtn.addEventListener("click", () => {
    enterMilestoneEditMode();
  });

  saveMilestoneBtn.addEventListener("click", async () => {
    await withGlobalLoading(saveMilestones);
  });

  addMilestoneBtn.addEventListener("click", () => {
    addMilestoneRow();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && milestoneEditMode) {
      cancelMilestoneEdit();
    }
  });
}

function enterMilestoneEditMode() {

  const tbody = document.getElementById("milestonesBody");
  if (!tbody) return;

  milestoneEditMode = true;
  originalMilestoneData = [];

  document.getElementById("milestoneDeleteHeader")
    ?.classList.remove("hidden");

  Array.from(tbody.rows).forEach(row => {

    const rowData = [];

    Array.from(row.cells).forEach(cell => {
      rowData.push(cell.textContent);
      cell.setAttribute("contenteditable", "true");
      cell.classList.add("editing");
    });

    originalMilestoneData.push(rowData);

    if (row.cells.length === 5) {
      const deleteCell = document.createElement("td");

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑";
      deleteBtn.classList.add("delete-btn");

      deleteBtn.addEventListener("click", () => {
        row.remove();
      });

      deleteCell.appendChild(deleteBtn);
      row.appendChild(deleteCell);
    }
  });

  editMilestoneBtn.classList.add("hidden");
  saveMilestoneBtn.classList.remove("hidden");
  addMilestoneBtn.classList.remove("hidden");
}

function cancelMilestoneEdit() {

  const tbody = document.getElementById("milestonesBody");
  if (!tbody) return;

  Array.from(tbody.rows).forEach((row, rowIndex) => {
    Array.from(row.cells).forEach((cell, cellIndex) => {
      if (originalMilestoneData[rowIndex])
        cell.textContent = originalMilestoneData[rowIndex][cellIndex];

      cell.removeAttribute("contenteditable");
      cell.classList.remove("editing");
    });
  });

  document.getElementById("milestoneDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 6) {
      row.deleteCell(5);
    }
  });

  milestoneEditMode = false;

  saveMilestoneBtn.classList.add("hidden");
  addMilestoneBtn.classList.add("hidden");
  editMilestoneBtn.classList.remove("hidden");
}

function addMilestoneRow() {

  const tbody = document.getElementById("milestonesBody");
  if (!tbody) return;

  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
  `;

  const deleteCell = document.createElement("td");
  const deleteBtn = document.createElement("button");

  deleteBtn.textContent = "🗑";
  deleteBtn.classList.add("delete-btn");

  deleteBtn.addEventListener("click", () => {
    tr.remove();
  });

  deleteCell.appendChild(deleteBtn);
  tr.appendChild(deleteCell);

  tbody.appendChild(tr);
}

async function saveMilestones() {

  const wo = localStorage.getItem("activeWorkOrder");
  const day = localStorage.getItem("activeDay");

  if (!wo || !day) return;

  const tbody = document.getElementById("milestonesBody");
  if (!tbody) return;

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(day),
    "milestones"
  );

  document.getElementById("milestoneDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 6) {
      row.deleteCell(5);
    }
  });

  // Delete old docs
  const existingSnap = await getDocs(ref);
  const deletePromises = existingSnap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletePromises);

  const rows = Array.from(tbody.rows)
    .map(row => {
      const [description, target, revision, achieved, remarks] =
        Array.from(row.cells).map(cell => cell.textContent.trim());

      if (!description && !target && !revision && !achieved && !remarks)
        return null;

      return { description, target, revision, achieved, remarks };
    })
    .filter(Boolean);

  const savePromises = rows.map((item, index) =>
    setDoc(doc(ref, `milestone_${index}`), item)
  );

  await Promise.all(savePromises);

  milestoneEditMode = false;

  saveMilestoneBtn.classList.add("hidden");
  addMilestoneBtn.classList.add("hidden");
  editMilestoneBtn.classList.remove("hidden");

  loadMilestones(day);
}

//EDITSAVE TASKCARD STATUS
const editTaskcardBtn = document.getElementById("editTaskcardBtn");
const saveTaskcardBtn = document.getElementById("saveTaskcardBtn");
const addTaskcardBtn = document.getElementById("addTaskcardBtn");

let taskcardEditMode = false;
let originalTaskcardData = [];

if (editTaskcardBtn && saveTaskcardBtn) {

  editTaskcardBtn.addEventListener("click", () => {
    enterTaskcardEditMode();
  });

  saveTaskcardBtn.addEventListener("click", async () => {
    await withGlobalLoading(saveTaskcards);
  });

  addTaskcardBtn.addEventListener("click", () => {
    addTaskcardRow();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && taskcardEditMode) {
      cancelTaskcardEdit();
    }
  });
}
function enterTaskcardEditMode() {

  const tbody = document.getElementById("taskcardBody");
  if (!tbody) return;

  taskcardEditMode = true;
  originalTaskcardData = [];

  document.getElementById("taskcardDeleteHeader")
    ?.classList.remove("hidden");

  Array.from(tbody.rows).forEach(row => {

    const rowData = [];

    Array.from(row.cells).forEach(cell => {
      rowData.push(cell.textContent);
      cell.setAttribute("contenteditable", "true");
      cell.classList.add("editing");
    });

    originalTaskcardData.push(rowData);

    if (row.cells.length === 6) {
      const deleteCell = document.createElement("td");

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑";
      deleteBtn.classList.add("delete-btn");

      deleteBtn.addEventListener("click", () => {
        row.remove();
      });

      deleteCell.appendChild(deleteBtn);
      row.appendChild(deleteCell);
    }
  });

  editTaskcardBtn.classList.add("hidden");
  saveTaskcardBtn.classList.remove("hidden");
  addTaskcardBtn.classList.remove("hidden");
}
function addTaskcardRow() {

  const tbody = document.getElementById("taskcardBody");
  if (!tbody) return;

  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
  `;

  const deleteCell = document.createElement("td");
  const deleteBtn = document.createElement("button");

  deleteBtn.textContent = "🗑";
  deleteBtn.classList.add("delete-btn");

  deleteBtn.addEventListener("click", () => {
    tr.remove();
  });

  deleteCell.appendChild(deleteBtn);
  tr.appendChild(deleteCell);

  tbody.appendChild(tr);
}
function cancelTaskcardEdit() {

  const tbody = document.getElementById("taskcardBody");
  if (!tbody) return;

  Array.from(tbody.rows).forEach((row, rowIndex) => {
    Array.from(row.cells).forEach((cell, cellIndex) => {
      if (originalTaskcardData[rowIndex])
        cell.textContent = originalTaskcardData[rowIndex][cellIndex];

      cell.removeAttribute("contenteditable");
      cell.classList.remove("editing");
    });
  });

  document.getElementById("taskcardDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 7) {
      row.deleteCell(6);
    }
  });

  taskcardEditMode = false;

  saveTaskcardBtn.classList.add("hidden");
  addTaskcardBtn.classList.add("hidden");
  editTaskcardBtn.classList.remove("hidden");
}
async function saveTaskcards() {

  const wo = localStorage.getItem("activeWorkOrder");
  const day = localStorage.getItem("activeDay");

  if (!wo || !day) return;

  const tbody = document.getElementById("taskcardBody");
  if (!tbody) return;

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(day),
    "taskcard"
  );

  document.getElementById("taskcardDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 7) {
      row.deleteCell(6);
    }
  });

  // Delete old docs
  const existingSnap = await getDocs(ref);
  await Promise.all(existingSnap.docs.map(d => deleteDoc(d.ref)));

  const rows = Array.from(tbody.rows)
    .map(row => {
      const [description, total, open, closed, percentclosed, remarks] =
        Array.from(row.cells).map(cell => cell.textContent.trim());

      if (!description && !total && !open && !closed && !percentclosed && !remarks)
        return null;

      return {
        description,
        total,
        open,
        closed,
        percentclosed,
        remarks
      };
    })
    .filter(Boolean);

  const savePromises = rows.map((item, index) =>
    setDoc(doc(ref, `taskcard_${index}`), item)
  );

  await Promise.all(savePromises);

  taskcardEditMode = false;

  saveTaskcardBtn.classList.add("hidden");
  addTaskcardBtn.classList.add("hidden");
  editTaskcardBtn.classList.remove("hidden");

  loadTaskCards(day);
}
//EDIT SAVE GENERAL HIGHLIGHTS

const editHighlightsBtn = document.getElementById("editHighlightsBtn");
const saveHighlightsBtn = document.getElementById("saveHighlightsBtn");
const addParagraphBtn = document.getElementById("addParagraphBtn");
const addBulletBtn = document.getElementById("addBulletBtn");

let highlightsEditMode = false;
let originalHighlightsHTML = "";
if (editHighlightsBtn && saveHighlightsBtn) {

  editHighlightsBtn.addEventListener("click", () => {

    const container = document.getElementById("highlightsBody");
    if (!container) return;

    highlightsEditMode = true;
    originalHighlightsHTML = container.innerHTML;

    container.setAttribute("contenteditable", "true");
    container.classList.add("editing");

    editHighlightsBtn.classList.add("hidden");
    saveHighlightsBtn.classList.remove("hidden");
    addParagraphBtn.classList.remove("hidden");
    addBulletBtn.classList.remove("hidden");
  });

}

  addParagraphBtn.addEventListener("click", () => {

    const container = document.getElementById("highlightsBody");

    const p = document.createElement("p");
    p.innerHTML = "<strong>Label:</strong> New highlight text";
    container.appendChild(p);
  });

  addBulletBtn.addEventListener("click", () => {

    const container = document.getElementById("highlightsBody");

    const ul = document.createElement("ul");

    const li = document.createElement("li");
    li.textContent = "New bullet point";

    ul.appendChild(li);
    container.appendChild(ul);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && highlightsEditMode) {
      cancelHighlightsEdit();
    }
  });
function cancelHighlightsEdit() {

  const container = document.getElementById("highlightsBody");
  if (!container) return;

  container.innerHTML = originalHighlightsHTML;

  container.removeAttribute("contenteditable");
  container.classList.remove("editing");

  highlightsEditMode = false;

  saveHighlightsBtn.classList.add("hidden");
  addParagraphBtn.classList.add("hidden");
  addBulletBtn.classList.add("hidden");
  editHighlightsBtn.classList.remove("hidden");
}
saveHighlightsBtn.addEventListener("click", async () => {

  await withGlobalLoading(async () => {

    const wo = localStorage.getItem("activeWorkOrder");
    const day = localStorage.getItem("activeDay");

    if (!wo || !day) return;

    const container = document.getElementById("highlightsBody");

    const sections = [];

    Array.from(container.children).forEach(el => {

      if (el.tagName === "P") {

        const strong = el.querySelector("strong");

        sections.push({
          type: "p",
          label: strong ? strong.textContent.replace(":", "") : "",
          text: el.textContent.replace(strong?.textContent || "", "").trim()
        });

      } else if (el.tagName === "UL") {

        const items = Array.from(el.querySelectorAll("li"))
          .map(li => li.textContent.trim());

        sections.push({
          type: "ul",
          items
        });
      }
    });

    const ref = doc(
      db,
      "workorder",
      wo,
      "days",
      String(day),
      "highlights",
      "main"
    );

    await setDoc(ref, { sections }, { merge: true });

    exitHighlightsEditMode();
    loadHighlights(day);
  });
});
function exitHighlightsEditMode() {

  const container = document.getElementById("highlightsBody");
  if (!container) return;

  container.removeAttribute("contenteditable");
  container.classList.remove("editing");

  highlightsEditMode = false;

  saveHighlightsBtn.classList.add("hidden");
  addParagraphBtn.classList.add("hidden");
  addBulletBtn.classList.add("hidden");
  editHighlightsBtn.classList.remove("hidden");
}
//EDIT SAVE WORKSTATION
const editWorkcenterBtn = document.getElementById("editWorkcenterBtn");
const saveWorkcenterBtn = document.getElementById("saveWorkcenterBtn");
const addWorkcenterBtn = document.getElementById("addWorkcenterBtn");

let workcenterEditMode = false;
let originalWorkcenterData = [];
if (editWorkcenterBtn && saveWorkcenterBtn) {

  editWorkcenterBtn.addEventListener("click", () => {
    enterWorkcenterEditMode();
  });

  saveWorkcenterBtn.addEventListener("click", async () => {
    await withGlobalLoading(saveWorkcenters);
  });

  addWorkcenterBtn.addEventListener("click", () => {
    addWorkcenterRow();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && workcenterEditMode) {
      cancelWorkcenterEdit();
    }
  });
}
function enterWorkcenterEditMode() {

  const tbody = document.getElementById("workcenterBody");
  if (!tbody) return;

  workcenterEditMode = true;
  originalWorkcenterData = [];

  document.getElementById("workcenterDeleteHeader")
    ?.classList.remove("hidden");

  Array.from(tbody.rows).forEach(row => {

    const rowData = [];

    Array.from(row.cells).forEach(cell => {
      rowData.push(cell.textContent);
      cell.setAttribute("contenteditable", "true");
      cell.classList.add("editing");
    });

    originalWorkcenterData.push(rowData);

    if (row.cells.length === 2) {
      const deleteCell = document.createElement("td");

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑";
      deleteBtn.classList.add("delete-btn");

      deleteBtn.addEventListener("click", () => {
        row.remove();
      });

      deleteCell.appendChild(deleteBtn);
      row.appendChild(deleteCell);
    }
  });

  editWorkcenterBtn.classList.add("hidden");
  saveWorkcenterBtn.classList.remove("hidden");
  addWorkcenterBtn.classList.remove("hidden");
}
function addWorkcenterRow() {

  const tbody = document.getElementById("workcenterBody");
  if (!tbody) return;

  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
  `;

  const deleteCell = document.createElement("td");
  const deleteBtn = document.createElement("button");

  deleteBtn.textContent = "🗑";
  deleteBtn.classList.add("delete-btn");

  deleteBtn.addEventListener("click", () => {
    tr.remove();
  });

  deleteCell.appendChild(deleteBtn);
  tr.appendChild(deleteCell);

  tbody.appendChild(tr);
}
function cancelWorkcenterEdit() {

  const tbody = document.getElementById("workcenterBody");
  if (!tbody) return;

  Array.from(tbody.rows).forEach((row, rowIndex) => {
    Array.from(row.cells).forEach((cell, cellIndex) => {
      if (originalWorkcenterData[rowIndex])
        cell.textContent = originalWorkcenterData[rowIndex][cellIndex];

      cell.removeAttribute("contenteditable");
      cell.classList.remove("editing");
    });
  });

  document.getElementById("workcenterDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 3) {
      row.deleteCell(2);
    }
  });

  workcenterEditMode = false;

  saveWorkcenterBtn.classList.add("hidden");
  addWorkcenterBtn.classList.add("hidden");
  editWorkcenterBtn.classList.remove("hidden");
}
async function saveWorkcenters() {

  const wo = localStorage.getItem("activeWorkOrder");
  const day = localStorage.getItem("activeDay");

  if (!wo || !day) return;

  const tbody = document.getElementById("workcenterBody");
  if (!tbody) return;

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(day),
    "workcenter"
  );

  document.getElementById("workcenterDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 3) {
      row.deleteCell(2);
    }
  });

  const existingSnap = await getDocs(ref);
  await Promise.all(existingSnap.docs.map(d => deleteDoc(d.ref)));

  const rows = Array.from(tbody.rows)
    .map(row => {
      const [workcenter, status] =
        Array.from(row.cells).map(cell => cell.textContent.trim());

      if (!workcenter && !status) return null;

      return { workcenter, status };
    })
    .filter(Boolean);

  const savePromises = rows.map((item, index) =>
    setDoc(doc(ref, `workcenter_${index}`), item)
  );

  await Promise.all(savePromises);

  workcenterEditMode = false;

  saveWorkcenterBtn.classList.add("hidden");
  addWorkcenterBtn.classList.add("hidden");
  editWorkcenterBtn.classList.remove("hidden");

  loadWorkCenter(day);
}
//ADD-EDIT-SAVE IDD
const editIddBtn = document.getElementById("editIddBtn");
const saveIddBtn = document.getElementById("saveIddBtn");
const addIddBtn = document.getElementById("addIddBtn");

let iddEditMode = false;
let originalIddData = [];
if (editIddBtn && saveIddBtn) {

  editIddBtn.addEventListener("click", () => {
    enterIddEditMode();
  });

  saveIddBtn.addEventListener("click", async () => {
    await withGlobalLoading(saveIdd);
  });

  addIddBtn.addEventListener("click", () => {
    addIddRow();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && iddEditMode) {
      cancelIddEdit();
    }
  });
}
function enterIddEditMode() {

  const tbody = document.getElementById("iddBody");
  if (!tbody) return;

  iddEditMode = true;
  originalIddData = [];

  document.getElementById("iddDeleteHeader")
    ?.classList.remove("hidden");

  Array.from(tbody.rows).forEach(row => {

    const rowData = [];

    // Extract text from badge if exists
    const statusCell = row.cells[4];
    const badge = statusCell.querySelector("span");

    const statusText = badge ? badge.textContent : statusCell.textContent;

    rowData.push(
      row.cells[0].textContent,
      row.cells[1].textContent,
      row.cells[2].textContent,
      row.cells[3].textContent,
      statusText
    );

    // Make editable
    for (let i = 0; i < 5; i++) {
      row.cells[i].textContent = rowData[i];
      row.cells[i].setAttribute("contenteditable", "true");
      row.cells[i].classList.add("editing");
    }

    originalIddData.push(rowData);

    if (row.cells.length === 5) {
      const deleteCell = document.createElement("td");

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑";
      deleteBtn.classList.add("delete-btn");

      deleteBtn.addEventListener("click", () => {
        row.remove();
      });

      deleteCell.appendChild(deleteBtn);
      row.appendChild(deleteCell);
    }
  });

  editIddBtn.classList.add("hidden");
  saveIddBtn.classList.remove("hidden");
  addIddBtn.classList.remove("hidden");
}
function addIddRow() {

  const tbody = document.getElementById("iddBody");
  if (!tbody) return;

  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
  `;

  const deleteCell = document.createElement("td");
  const deleteBtn = document.createElement("button");

  deleteBtn.textContent = "🗑";
  deleteBtn.classList.add("delete-btn");

  deleteBtn.addEventListener("click", () => {
    tr.remove();
  });

  deleteCell.appendChild(deleteBtn);
  tr.appendChild(deleteCell);

  tbody.appendChild(tr);
}
function cancelIddEdit() {

  const tbody = document.getElementById("iddBody");
  if (!tbody) return;

  Array.from(tbody.rows).forEach((row, rowIndex) => {

    for (let i = 0; i < 5; i++) {
      if (originalIddData[rowIndex]) {
        row.cells[i].textContent = originalIddData[rowIndex][i];
      }

      row.cells[i].removeAttribute("contenteditable");
      row.cells[i].classList.remove("editing");
    }
  });

  document.getElementById("iddDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 6) {
      row.deleteCell(5);
    }
  });

  iddEditMode = false;

  saveIddBtn.classList.add("hidden");
  addIddBtn.classList.add("hidden");
  editIddBtn.classList.remove("hidden");

  loadIDD(localStorage.getItem("activeDay"));
}
async function saveIdd() {

  const wo = localStorage.getItem("activeWorkOrder");
  const day = localStorage.getItem("activeDay");

  if (!wo || !day) return;

  const tbody = document.getElementById("iddBody");
  if (!tbody) return;

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(day),
    "idd"
  );

  document.getElementById("iddDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 6) {
      row.deleteCell(5);
    }
  });

  const existingSnap = await getDocs(ref);
  await Promise.all(existingSnap.docs.map(d => deleteDoc(d.ref)));

  const rows = Array.from(tbody.rows)
    .map(row => {
      const [item, taskcard, customerref, description, status] =
        Array.from(row.cells).map(cell => cell.textContent.trim());

      if (!item && !taskcard && !customerref && !description && !status)
        return null;

      return { item, taskcard, customerref, description, status };
    })
    .filter(Boolean);

  const savePromises = rows.map((entry, index) =>
    setDoc(doc(ref, `idd_${index}`), entry)
  );

  await Promise.all(savePromises);

  iddEditMode = false;

  saveIddBtn.classList.add("hidden");
  addIddBtn.classList.add("hidden");
  editIddBtn.classList.remove("hidden");

  loadIDD(day);
}
//ADD-EDIT-SAVE ODD
const editOddBtn = document.getElementById("editOddBtn");
const saveOddBtn = document.getElementById("saveOddBtn");
const addOddBtn = document.getElementById("addOddBtn");

let oddEditMode = false;
let originalOddData = [];
if (editOddBtn && saveOddBtn) {

  editOddBtn.addEventListener("click", () => {
    enterOddEditMode();
  });

  saveOddBtn.addEventListener("click", async () => {
    await withGlobalLoading(saveOdd);
  });

  addOddBtn.addEventListener("click", () => {
    addOddRow();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && oddEditMode) {
      cancelOddEdit();
    }
  });
}
function enterOddEditMode() {

  const tbody = document.getElementById("oddBody");
  if (!tbody) return;

  oddEditMode = true;
  originalOddData = [];

  document.getElementById("oddDeleteHeader")
    ?.classList.remove("hidden");

  Array.from(tbody.rows).forEach(row => {

    const statusCell = row.cells[4];
    const badge = statusCell.querySelector("span");
    const statusText = badge ? badge.textContent : statusCell.textContent;

    const rowData = [
      row.cells[0].textContent,
      row.cells[1].textContent,
      row.cells[2].textContent,
      row.cells[3].textContent,
      statusText
    ];

    for (let i = 0; i < 5; i++) {
      row.cells[i].textContent = rowData[i];
      row.cells[i].setAttribute("contenteditable", "true");
      row.cells[i].classList.add("editing");
    }

    originalOddData.push(rowData);

    if (row.cells.length === 5) {
      const deleteCell = document.createElement("td");

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑";
      deleteBtn.classList.add("delete-btn");

      deleteBtn.addEventListener("click", () => {
        row.remove();
      });

      deleteCell.appendChild(deleteBtn);
      row.appendChild(deleteCell);
    }
  });

  editOddBtn.classList.add("hidden");
  saveOddBtn.classList.remove("hidden");
  addOddBtn.classList.remove("hidden");
}
function addOddRow() {

  const tbody = document.getElementById("oddBody");
  if (!tbody) return;

  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
  `;

  const deleteCell = document.createElement("td");
  const deleteBtn = document.createElement("button");

  deleteBtn.textContent = "🗑";
  deleteBtn.classList.add("delete-btn");

  deleteBtn.addEventListener("click", () => {
    tr.remove();
  });

  deleteCell.appendChild(deleteBtn);
  tr.appendChild(deleteCell);

  tbody.appendChild(tr);
}
function cancelOddEdit() {

  const tbody = document.getElementById("oddBody");
  if (!tbody) return;

  Array.from(tbody.rows).forEach((row, rowIndex) => {

    for (let i = 0; i < 5; i++) {
      if (originalOddData[rowIndex]) {
        row.cells[i].textContent = originalOddData[rowIndex][i];
      }

      row.cells[i].removeAttribute("contenteditable");
      row.cells[i].classList.remove("editing");
    }
  });

  document.getElementById("oddDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 6) {
      row.deleteCell(5);
    }
  });

  oddEditMode = false;

  saveOddBtn.classList.add("hidden");
  addOddBtn.classList.add("hidden");
  editOddBtn.classList.remove("hidden");

  loadODD(localStorage.getItem("activeDay"));
}
async function saveOdd() {

  const wo = localStorage.getItem("activeWorkOrder");
  const day = localStorage.getItem("activeDay");

  if (!wo || !day) return;

  const tbody = document.getElementById("oddBody");
  if (!tbody) return;

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(day),
    "odd"
  );

  document.getElementById("oddDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 6) {
      row.deleteCell(5);
    }
  });

  const existingSnap = await getDocs(ref);
  await Promise.all(existingSnap.docs.map(d => deleteDoc(d.ref)));

  const rows = Array.from(tbody.rows)
    .map(row => {
      const [item, taskcard, customerref, description, status] =
        Array.from(row.cells).map(cell => cell.textContent.trim());

      if (!item && !taskcard && !customerref && !description && !status)
        return null;

      return { item, taskcard, customerref, description, status };
    })
    .filter(Boolean);

  const savePromises = rows.map((entry, index) =>
    setDoc(doc(ref, `odd_${index}`), entry)
  );

  await Promise.all(savePromises);

  oddEditMode = false;

  saveOddBtn.classList.add("hidden");
  addOddBtn.classList.add("hidden");
  editOddBtn.classList.remove("hidden");

  loadODD(day);
}
//EDIT-ADD-SAVE MATRIAL AND TOOLS
const editMaterialsBtn = document.getElementById("editMaterialsBtn");
const saveMaterialsBtn = document.getElementById("saveMaterialsBtn");
const addMaterialsBtn = document.getElementById("addMaterialsBtn");

let materialsEditMode = false;
let originalMaterialsHTML = "";
if (editMaterialsBtn && saveMaterialsBtn) {

  editMaterialsBtn.addEventListener("click", () => {

    const container = document.getElementById("materialsBody");
    if (!container) return;

    materialsEditMode = true;
    originalMaterialsHTML = container.innerHTML;

    container.setAttribute("contenteditable", "true");
    container.classList.add("editing");

    editMaterialsBtn.classList.add("hidden");
    saveMaterialsBtn.classList.remove("hidden");
    addMaterialsBtn.classList.remove("hidden");
  });
  addMaterialsBtn.addEventListener("click", () => {

    const container = document.getElementById("materialsBody");

    const p = document.createElement("p");
    p.innerHTML = "<strong>Label:</strong> New material/tooling note";

    container.appendChild(p);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && materialsEditMode) {
      cancelMaterialsEdit();
    }
  });
}
function cancelMaterialsEdit() {

  const container = document.getElementById("materialsBody");
  if (!container) return;

  container.innerHTML = originalMaterialsHTML;

  container.removeAttribute("contenteditable");
  container.classList.remove("editing");

  materialsEditMode = false;

  saveMaterialsBtn.classList.add("hidden");
  addMaterialsBtn.classList.add("hidden");
  editMaterialsBtn.classList.remove("hidden");
}
saveMaterialsBtn.addEventListener("click", async () => {

  await withGlobalLoading(async () => {

    const wo = localStorage.getItem("activeWorkOrder");
    const day = localStorage.getItem("activeDay");

    if (!wo || !day) return;

    const container = document.getElementById("materialsBody");

    const sections = [];

    Array.from(container.children).forEach(el => {

      if (el.tagName === "P") {

        const strong = el.querySelector("strong");

        sections.push({
          type: "p",
          label: strong ? strong.textContent.replace(":", "") : "",
          text: el.textContent.replace(strong?.textContent || "", "").trim()
        });
      }
    });

    const ref = doc(
      db,
      "workorder",
      wo,
      "days",
      String(day),
      "materialtools",
      "main"
    );

    await setDoc(ref, { sections }, { merge: true });

    exitMaterialsEditMode();
    loadMaterialTools(day);
  });
});
function exitMaterialsEditMode() {

  const container = document.getElementById("materialsBody");
  if (!container) return;

  container.removeAttribute("contenteditable");
  container.classList.remove("editing");

  materialsEditMode = false;

  saveMaterialsBtn.classList.add("hidden");
  addMaterialsBtn.classList.add("hidden");
  editMaterialsBtn.classList.remove("hidden");
}
//ADD-EDIT-SAVE RFSS
const editRfssBtn = document.getElementById("editRfssBtn");
const saveRfssBtn = document.getElementById("saveRfssBtn");
const addRfssBtn = document.getElementById("addRfssBtn");

let rfssEditMode = false;
let originalRfssData = [];
if (editRfssBtn && saveRfssBtn) {

  editRfssBtn.addEventListener("click", () => {
    enterRfssEditMode();
  });

  saveRfssBtn.addEventListener("click", async () => {
    await withGlobalLoading(saveRfss);
  });

  addRfssBtn.addEventListener("click", () => {
    addRfssRow();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && rfssEditMode) {
      cancelRfssEdit();
    }
  });
}
function enterRfssEditMode() {

  const tbody = document.getElementById("rfssBody");
  if (!tbody) return;

  rfssEditMode = true;
  originalRfssData = [];

  document.getElementById("rfssDeleteHeader")
    ?.classList.remove("hidden");

  Array.from(tbody.rows).forEach(row => {

    const rowData = [];

    for (let i = 0; i < 4; i++) {
      rowData.push(row.cells[i].textContent);

      row.cells[i].setAttribute("contenteditable", "true");
      row.cells[i].classList.add("editing");
    }

    originalRfssData.push(rowData);

    if (row.cells.length === 4) {
      const deleteCell = document.createElement("td");

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑";
      deleteBtn.classList.add("delete-btn");

      deleteBtn.addEventListener("click", () => {
        row.remove();
      });

      deleteCell.appendChild(deleteBtn);
      row.appendChild(deleteCell);
    }
  });

  editRfssBtn.classList.add("hidden");
  saveRfssBtn.classList.remove("hidden");
  addRfssBtn.classList.remove("hidden");
}
function addRfssRow() {

  const tbody = document.getElementById("rfssBody");
  if (!tbody) return;

  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
  `;

  const deleteCell = document.createElement("td");
  const deleteBtn = document.createElement("button");

  deleteBtn.textContent = "🗑";
  deleteBtn.classList.add("delete-btn");

  deleteBtn.addEventListener("click", () => {
    tr.remove();
  });

  deleteCell.appendChild(deleteBtn);
  tr.appendChild(deleteCell);

  tbody.appendChild(tr);
}
function cancelRfssEdit() {

  const tbody = document.getElementById("rfssBody");
  if (!tbody) return;

  Array.from(tbody.rows).forEach((row, rowIndex) => {

    for (let i = 0; i < 4; i++) {
      if (originalRfssData[rowIndex]) {
        row.cells[i].textContent = originalRfssData[rowIndex][i];
      }

      row.cells[i].removeAttribute("contenteditable");
      row.cells[i].classList.remove("editing");
    }
  });

  document.getElementById("rfssDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 5) {
      row.deleteCell(4);
    }
  });

  rfssEditMode = false;

  saveRfssBtn.classList.add("hidden");
  addRfssBtn.classList.add("hidden");
  editRfssBtn.classList.remove("hidden");

  loadRFSS(localStorage.getItem("activeDay"));
}
async function saveRfss() {

  const wo = localStorage.getItem("activeWorkOrder");
  const day = localStorage.getItem("activeDay");

  if (!wo || !day) return;

  const tbody = document.getElementById("rfssBody");
  if (!tbody) return;

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(day),
    "rfss"
  );

  document.getElementById("rfssDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 5) {
      row.deleteCell(4);
    }
  });

  const existingSnap = await getDocs(ref);
  await Promise.all(existingSnap.docs.map(d => deleteDoc(d.ref)));

  const rows = Array.from(tbody.rows)
    .map(row => {
      const [area, nrref, description, status] =
        Array.from(row.cells).map(cell => cell.textContent.trim());

      if (!area && !nrref && !description && !status)
        return null;

      return { area, nrref, description, status };
    })
    .filter(Boolean);

  const savePromises = rows.map((entry, index) =>
    setDoc(doc(ref, `rfss_${index}`), entry)
  );

  await Promise.all(savePromises);

  rfssEditMode = false;

  saveRfssBtn.classList.add("hidden");
  addRfssBtn.classList.add("hidden");
  editRfssBtn.classList.remove("hidden");

  loadRFSS(day);
}
//EDIT-ADD-SAVE Action Items
const editActionBtn = document.getElementById("editActionBtn");
const saveActionBtn = document.getElementById("saveActionBtn");
const addActionBtn = document.getElementById("addActionBtn");

let actionEditMode = false;
let originalActionData = [];
if (editActionBtn && saveActionBtn) {

  editActionBtn.addEventListener("click", () => {
    enterActionEditMode();
  });

  saveActionBtn.addEventListener("click", async () => {
    await withGlobalLoading(saveActionItems);
  });

  addActionBtn.addEventListener("click", () => {
    addActionRow();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && actionEditMode) {
      cancelActionEdit();
    }
  });
}
function enterActionEditMode() {

  const tbody = document.getElementById("actionBody");
  if (!tbody) return;

  actionEditMode = true;
  originalActionData = [];

  document.getElementById("actionDeleteHeader")
    ?.classList.remove("hidden");

  Array.from(tbody.rows).forEach(row => {

    const statusCell = row.cells[4];
    const badge = statusCell.querySelector("span");
    const statusText = badge ? badge.textContent : statusCell.textContent;

    const rowData = [
      row.cells[0].textContent,
      row.cells[1].textContent,
      row.cells[2].textContent,
      row.cells[3].textContent,
      statusText
    ];

    for (let i = 0; i < 5; i++) {
      row.cells[i].textContent = rowData[i];
      row.cells[i].setAttribute("contenteditable", "true");
      row.cells[i].classList.add("editing");
    }

    originalActionData.push(rowData);

    if (row.cells.length === 5) {
      const deleteCell = document.createElement("td");

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑";
      deleteBtn.classList.add("delete-btn");

      deleteBtn.addEventListener("click", () => {
        row.remove();
      });

      deleteCell.appendChild(deleteBtn);
      row.appendChild(deleteCell);
    }
  });

  editActionBtn.classList.add("hidden");
  saveActionBtn.classList.remove("hidden");
  addActionBtn.classList.remove("hidden");
}
function addActionRow() {

  const tbody = document.getElementById("actionBody");
  if (!tbody) return;

  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
    <td contenteditable="true" class="editing"></td>
  `;

  const deleteCell = document.createElement("td");
  const deleteBtn = document.createElement("button");

  deleteBtn.textContent = "🗑";
  deleteBtn.classList.add("delete-btn");

  deleteBtn.addEventListener("click", () => {
    tr.remove();
  });

  deleteCell.appendChild(deleteBtn);
  tr.appendChild(deleteCell);

  tbody.appendChild(tr);
}
function cancelActionEdit() {

  const tbody = document.getElementById("actionBody");
  if (!tbody) return;

  Array.from(tbody.rows).forEach((row, rowIndex) => {

    for (let i = 0; i < 5; i++) {
      if (originalActionData[rowIndex]) {
        row.cells[i].textContent = originalActionData[rowIndex][i];
      }

      row.cells[i].removeAttribute("contenteditable");
      row.cells[i].classList.remove("editing");
    }
  });

  document.getElementById("actionDeleteHeader")
    ?.classList.add("hidden");

  Array.from(tbody.rows).forEach(row => {
    if (row.cells.length === 6) {
      row.deleteCell(5);
    }
  });

  actionEditMode = false;

  saveActionBtn.classList.add("hidden");
  addActionBtn.classList.add("hidden");
  editActionBtn.classList.remove("hidden");

  loadActionItems(localStorage.getItem("activeDay"));
}

 
