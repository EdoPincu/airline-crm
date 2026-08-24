import { db, applyStoredTheme, friendlyAuthError } from "./auth.js";

applyStoredTheme();

const form = document.getElementById("form");
const alertBox = document.getElementById("alert");
const submit = document.getElementById("submit");

function show(kind, msg) {
  alertBox.className = kind === "error" ? "auth-err" : "auth-ok";
  alertBox.textContent = msg;
  alertBox.hidden = false;
}

// Already signed in? Skip the form.
const { data: existing } = await db.auth.getSession();
if (existing.session) location.replace("index.html");

// ?registered=1 comes back from the signup page.
if (new URLSearchParams(location.search).has("registered"))
  show("ok", "Account created. Once your email is confirmed and an admin approves you, sign in here.");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) return show("error", "Enter your email and password.");

  submit.disabled = true;
  submit.textContent = "Signing in…";
  const { error } = await db.auth.signInWithPassword({ email, password });
  submit.disabled = false;
  submit.textContent = "Sign in";

  if (error) return show("error", friendlyAuthError(error.message));
  location.replace("index.html");
});
