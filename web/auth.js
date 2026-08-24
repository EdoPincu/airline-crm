// Shared Supabase client and helpers for the auth pages and the app shell.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const { url, key } = window.CRM_CONFIG;
export const db = createClient(url, key);

export function applyStoredTheme() {
  try {
    const t = localStorage.getItem("crm-theme");
    if (t) document.documentElement.setAttribute("data-theme", t);
  } catch {}
}

// The signed-in user's row in `staff`. RLS lets everyone read their own row,
// so this works even while the account is still pending.
export async function fetchStaff() {
  const { data, error } = await db.from("staff").select("*").maybeSingle();
  if (error) return { staff: null, error: error.message };
  return { staff: data, error: null };
}

export function friendlyAuthError(message) {
  const m = String(message || "");
  if (/Invalid login credentials/i.test(m)) return "That email and password combination doesn't match an account.";
  if (/Email not confirmed/i.test(m)) return "Confirm your email address first — check your inbox for the link.";
  if (/User already registered/i.test(m)) return "An account with that email already exists. Try signing in instead.";
  if (/Signups not allowed/i.test(m)) return "Registration is currently closed. Ask an administrator to create your account.";
  if (/Password should be/i.test(m)) return m;
  if (/rate limit|too many/i.test(m)) return "Too many attempts. Wait a minute and try again.";
  return m || "Something went wrong. Try again.";
}
