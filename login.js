import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
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

// Auto-redirect if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "index";
  }
});

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const errorMsg = document.getElementById("errorMsg");

  const email = emailInput.value;
  const password = passwordInput.value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      window.location.href = "index";
    })
    .catch((error) => {
      if (error.code === "auth/wrong-password") {
        errorMsg.textContent = "Incorrect password.";
      } else if (error.code === "auth/user-not-found") {
        errorMsg.textContent =
          "Account not found. Contact administrator for access.";
      } else {
        errorMsg.textContent = error.message;
      }
    });
});
document.getElementById("createAccountBtn").addEventListener("click", () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorMsg = document.getElementById("errorMsg");
  const createBtn = document.getElementById("createAccountBtn"); // 👈 ADD THIS

  if (!email || !password) {
    errorMsg.textContent = "Email and password are required.";
    return;
  }

  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
      window.location.href = "index";
    })
    .catch((error) => {
      if (error.code === "auth/email-already-in-use") {
        errorMsg.textContent =
          "This account already exists. Please sign in or contact the administrator.";

        // 👇 THIS is the missing behavior
        createBtn.style.display = "none";
      } else if (error.code === "auth/weak-password") {
        errorMsg.textContent = "Password must be at least 6 characters.";
      } else {
        errorMsg.textContent = error.message;
      }
    });
});

// Optional polish: re-show "Create Password" when email changes
const emailField = document.getElementById("email");
const createBtn = document.getElementById("createAccountBtn");

if (emailField && createBtn) {
  emailField.addEventListener("input", () => {
    createBtn.style.display = "block";
  });
}
