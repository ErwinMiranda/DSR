import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login";
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
    signOut(auth).then(() => {
      window.location.href = "login";
    });
  });
}
