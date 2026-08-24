import { db, applyStoredTheme, friendlyAuthError } from "./auth.js";

applyStoredTheme();

const form = document.getElementById("form");
const alertBox = document.getElementById("alert");
const submit = document.getElementById("submit");
const strength = document.getElementById("strength");

function show(kind, msg) {
  alertBox.className = kind === "error" ? "auth-err" : "auth-ok";
  alertBox.innerHTML = msg;
  alertBox.hidden = false;
}

const { data: existing } = await db.auth.getSession();
if (existing.session) location.replace("index.html");

form.password.addEventListener("input", () => {
  const v = form.password.value;
  const score = [v.length >= 8, v.length >= 12, /[A-Z]/.test(v), /[0-9]/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
  strength.textContent = v.length < 8
    ? "At least 8 characters."
    : ["", "Weak", "Fair", "Good", "Strong", "Very strong"][score] + " password.";
  strength.className = "hint" + (v.length >= 8 && score >= 3 ? " hint-ok" : "");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const full_name = form.full_name.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;

  if (!full_name) return show("error", "Enter your full name.");
  if (!email) return show("error", "Enter your work email.");
  if (password.length < 8) return show("error", "Password must be at least 8 characters.");
  if (password !== form.confirm.value) return show("error", "The two passwords don't match.");

  submit.disabled = true;
  submit.textContent = "Creating account…";
  // full_name lands in user metadata, which the signup trigger copies into
  // `staff`. Role and status are never taken from metadata — it is user-editable.
  const { data, error } = await db.auth.signUp({
    email, password, options: { data: { full_name } },
  });
  submit.disabled = false;
  submit.textContent = "Create account";

  if (error) return show("error", friendlyAuthError(error.message));

  // A session here means email confirmation is switched off, so the account is
  // live immediately — but still pending approval.
  if (data.session) return location.replace("index.html");

  form.querySelectorAll("input, button").forEach((el) => (el.disabled = true));
  show("ok",
    "<strong>Account created.</strong><br>Check <em>" + email.replace(/[<>&]/g, "") +
    "</em> for a confirmation link. After confirming, an administrator has to approve your access before the CRM opens up." +
    '<br><br><a href="login.html">Go to sign in</a>');
});
