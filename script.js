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
const auth = getAuth();
const db = getFirestore();

const appEl = document.getElementById("app");
const loadingEl = document.getElementById("authLoading");

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

    // ✅ APPROVED → show app
    loadingEl.style.display = "none";
    appEl.classList.remove("hidden");
    restoreWorkOrderIfExists();
  } catch (err) {
    // ❌ Blocked by rules or error
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
  } catch (err) {
    woError.textContent = "Access check failed.";
    woBtn.disabled = false;
  }
});
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

  snap.forEach((docSnap) => {
    const d = docSnap.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.category || "-"}</td>
      <td>${d.position || "-"}</td>
      <td>${d.name || "-"}</td>
      <td>${d.email || "-"}</td>
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

  tbody.innerHTML = ""; // clear on reload / refresh

  const ref = collection(
    db,
    "workorder",
    wo,
    "days",
    String(dayNo),
    "workcenter",
  );

  const snap = await getDocs(ref);

  snap.forEach((docSnap) => {
    const d = docSnap.data();

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
