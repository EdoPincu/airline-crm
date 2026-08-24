import { createDemoClient, resetDemoData } from "./demo-store.js";

// Demo branch: no Supabase connection and no auth. Data is bundled fixtures
// held in localStorage, so nothing here can reach the live database.
const db = createDemoClient();
const root = document.getElementById("root");

const state = { view: "dashboard", session: null, flights: [], customers: [], orders: [], q: "", modal: null };

/* ------------------------------------------------------------- utilities */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n, c = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n ?? 0);
const dt = (s) =>
  s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const day = (s) => (s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—");

const TONE = {
  scheduled: "info", boarding: "warn", departed: "info", landed: "ok", delayed: "warn", cancelled: "bad",
  pending: "warn", confirmed: "ok", checked_in: "info", refunded: "mute",
  basic: "mute", silver: "mute", gold: "warn", platinum: "info",
};
const pill = (v) => `<span class="pill pill-${TONE[v] || "mute"}">${esc(String(v).replace(/_/g, " "))}</span>`;

function toast(msg) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/* ------------------------------------------------------------------ data */
async function loadAll() {
  const [f, c, o] = await Promise.all([
    db.from("flights").select("*").order("departure_time"),
    db.from("customers").select("*").order("last_name"),
    db.from("orders").select("*, customers(first_name,last_name,email), flights(flight_number,origin,destination,departure_time)").order("booked_at", { ascending: false }),
  ]);
  for (const r of [f, c, o]) if (r.error) toast(r.error.message);
  state.flights = f.data || [];
  state.customers = c.data || [];
  state.orders = o.data || [];
}

async function mutate(fn, okMsg) {
  const { error } = await fn();
  if (error) return toast(error.message);
  state.modal = null;
  await loadAll();
  render();
  if (okMsg) toast(okMsg);
}

/* ----------------------------------------------------------------- shell */
const NAV = [
  ["dashboard", "◧", "Dashboard"],
  ["flights", "✈", "Flights"],
  ["customers", "☺", "Customers"],
  ["orders", "🎟", "Orders"],
];

function render() {
  const v = state.view;
  root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">✈</div>
          <div><div class="brand-name">Skyline CRM</div><div class="brand-sub">Airline operations</div></div></div>
        <nav class="nav">
          ${NAV.map(([id, ic, label]) =>
            `<button data-view="${id}" ${v === id ? 'aria-current="page"' : ""}><span aria-hidden="true">${ic}</span>${label}</button>`).join("")}
        </nav>
        <div class="sidebar-foot">
          <div class="who"><span class="pill pill-warn">Demo mode</span></div>
          <button class="btn btn-sm" id="theme">Toggle theme</button>
          <button class="btn btn-sm" id="reset">Reset demo data</button>
        </div>
      </aside>
      <main class="main">${
        v === "dashboard" ? viewDashboard() :
        v === "flights" ? viewFlights() :
        v === "customers" ? viewCustomers() : viewOrders()
      }</main>
    </div>
    ${state.modal ? renderModal() : ""}`;
  wire();
}

function wire() {
  root.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { state.view = b.dataset.view; state.q = ""; render(); }));
  const rs = document.getElementById("reset");
  if (rs) rs.onclick = async () => {
    if (!confirm("Reset the demo data back to its original state?")) return;
    resetDemoData();
    await loadAll();
    render();
    toast("Demo data reset");
  };
  const th = document.getElementById("theme");
  if (th) th.onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : cur === "light" ? "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("crm-theme", next); } catch {}
  };
  const s = document.getElementById("q");
  if (s) s.oninput = (e) => { state.q = e.target.value; const f = document.getElementById("rows"); if (f) f.innerHTML = currentRows(); bindRowActions(); };
  root.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => { state.modal = b.dataset.open; render(); }));
  bindRowActions();
  bindModal();
}

function bindRowActions() {
  document.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
    const [table, id] = b.dataset.del.split(":");
    if (confirm(`Delete this ${table.replace(/s$/, "")}? This cannot be undone.`)) {
      mutate(() => db.from(table).delete().eq("id", id), "Deleted");
    }
  }));
  document.querySelectorAll("[data-status]").forEach((sel) => (sel.onchange = () => {
    const [table, id] = sel.dataset.status.split(":");
    mutate(() => db.from(table).update({ status: sel.value }).eq("id", id), "Status updated");
  }));
}

/* ------------------------------------------------------------- dashboard */
function viewDashboard() {
  const now = Date.now();
  const upcoming = state.flights.filter((f) => new Date(f.departure_time) > now && f.status !== "cancelled");
  const live = state.orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded");
  const revenue = live.reduce((s, o) => s + Number(o.total_amount), 0);
  const seats = upcoming.reduce((a, f) => ({ cap: a.cap + f.capacity, free: a.free + f.seats_available }), { cap: 0, free: 0 });
  const loadFactor = seats.cap ? Math.round(((seats.cap - seats.free) / seats.cap) * 100) : 0;

  const stat = (label, value, note) =>
    `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`;

  return `
    <div class="page-head"><div><h1>Dashboard</h1><p>Live snapshot across flights, customers and orders.</p></div></div>
    <div class="stats">
      ${stat("Booked revenue", money(revenue), `${live.length} active order${live.length === 1 ? "" : "s"}`)}
      ${stat("Upcoming flights", upcoming.length, `${state.flights.length} in schedule`)}
      ${stat("Customers", state.customers.length, `${state.customers.filter((c) => c.tier === "gold" || c.tier === "platinum").length} premium tier`)}
      ${stat("Load factor", loadFactor + "%", `${seats.free} seats still open`)}
    </div>
    <div class="card">
      <div class="card-head"><h2>Next departures</h2>
        <button class="btn btn-sm" data-view="flights">View all</button></div>
      <div class="table-scroll"><table>
        <thead><tr><th>Flight</th><th>Route</th><th>Departs</th><th>Status</th><th class="num">Seats left</th></tr></thead>
        <tbody>${
          upcoming.slice(0, 5).map((f) => `<tr>
            <td class="mono">${esc(f.flight_number)}</td>
            <td><span class="route">${esc(f.origin)}<span class="arrow">→</span>${esc(f.destination)}</span></td>
            <td>${dt(f.departure_time)}</td>
            <td>${pill(f.status)}</td>
            <td class="num">${f.seats_available}</td></tr>`).join("") ||
          `<tr><td colspan="5" class="empty">No upcoming flights.</td></tr>`
        }</tbody></table></div>
    </div>`;
}

/* ---------------------------------------------------------------- tables */
function match(hay) { return hay.toLowerCase().includes(state.q.toLowerCase()); }

function currentRows() {
  if (state.view === "flights") return flightRows();
  if (state.view === "customers") return customerRows();
  if (state.view === "orders") return orderRows();
  return "";
}

function shell(title, sub, addLabel, addKey, head, rows) {
  return `
    <div class="page-head">
      <div><h1>${title}</h1><p>${sub}</p></div>
      <div class="head-actions">
        <input id="q" class="search" placeholder="Search…" value="${esc(state.q)}">
        <button class="btn btn-primary" data-open="${addKey}">+ ${addLabel}</button>
      </div>
    </div>
    <div class="card"><div class="table-scroll"><table>
      <thead><tr>${head}</tr></thead>
      <tbody id="rows">${rows}</tbody>
    </table></div></div>`;
}

const STATUS_SEL = (table, row, opts) =>
  `<select class="btn-sm" data-status="${table}:${row.id}" style="padding:4px 8px;width:auto">
    ${opts.map((o) => `<option value="${o}" ${row.status === o ? "selected" : ""}>${o.replace(/_/g, " ")}</option>`).join("")}
  </select>`;

function flightRows() {
  const rows = state.flights.filter((f) => match(`${f.flight_number} ${f.origin} ${f.destination} ${f.aircraft_type || ""} ${f.status}`));
  if (!rows.length) return `<tr><td colspan="7" class="empty">No flights match.</td></tr>`;
  return rows.map((f) => {
    const sold = f.capacity - f.seats_available;
    const pct = Math.round((sold / f.capacity) * 100);
    return `<tr>
      <td class="mono">${esc(f.flight_number)}<div class="sub">${esc(f.aircraft_type || "—")}</div></td>
      <td><span class="route">${esc(f.origin)}<span class="arrow">→</span>${esc(f.destination)}</span></td>
      <td>${dt(f.departure_time)}<div class="sub">arrives ${dt(f.arrival_time)}</div></td>
      <td>${STATUS_SEL("flights", f, ["scheduled", "boarding", "departed", "landed", "delayed", "cancelled"])}</td>
      <td class="num">${money(f.base_price)}</td>
      <td><div class="bar"><i style="width:${pct}%"></i></div><div class="sub">${sold}/${f.capacity} sold</div></td>
      <td><button class="btn btn-sm btn-ghost btn-danger" data-del="flights:${f.id}">Delete</button></td>
    </tr>`;
  }).join("");
}

function viewFlights() {
  return shell("Flights", "Schedule, capacity and operational status.", "New flight", "flight",
    `<th>Flight</th><th>Route</th><th>Departure</th><th>Status</th><th class="num">Base fare</th><th>Load</th><th></th>`,
    flightRows());
}

function customerRows() {
  const rows = state.customers.filter((c) => match(`${c.first_name} ${c.last_name} ${c.email} ${c.frequent_flyer_number || ""} ${c.tier}`));
  if (!rows.length) return `<tr><td colspan="6" class="empty">No customers match.</td></tr>`;
  return rows.map((c) => {
    const n = state.orders.filter((o) => o.customer_id === c.id).length;
    return `<tr>
      <td><strong>${esc(c.first_name)} ${esc(c.last_name)}</strong><div class="sub">${esc(c.email)}</div></td>
      <td>${pill(c.tier)}</td>
      <td class="mono">${esc(c.frequent_flyer_number || "—")}</td>
      <td>${esc(c.phone || "—")}<div class="sub">${esc(c.country || "")}</div></td>
      <td class="num">${n}</td>
      <td><button class="btn btn-sm btn-ghost btn-danger" data-del="customers:${c.id}">Delete</button></td>
    </tr>`;
  }).join("");
}

function viewCustomers() {
  return shell("Customers", "Passenger profiles and loyalty tiers.", "New customer", "customer",
    `<th>Customer</th><th>Tier</th><th>Frequent flyer</th><th>Contact</th><th class="num">Orders</th><th></th>`,
    customerRows());
}

function orderRows() {
  const rows = state.orders.filter((o) =>
    match(`${o.booking_ref} ${o.customers?.first_name || ""} ${o.customers?.last_name || ""} ${o.flights?.flight_number || ""} ${o.status} ${o.cabin}`));
  if (!rows.length) return `<tr><td colspan="7" class="empty">No orders match.</td></tr>`;
  return rows.map((o) => `<tr>
    <td class="mono"><strong>${esc(o.booking_ref)}</strong><div class="sub">${day(o.booked_at)}</div></td>
    <td>${esc(o.customers ? `${o.customers.first_name} ${o.customers.last_name}` : "—")}
        <div class="sub">${esc(o.customers?.email || "")}</div></td>
    <td class="mono">${esc(o.flights?.flight_number || "—")}
        <div class="sub">${esc(o.flights ? `${o.flights.origin} → ${o.flights.destination}` : "")}</div></td>
    <td>${esc(o.cabin.replace(/_/g, " "))}<div class="sub">seat ${esc(o.seat_number || "—")} · ${o.passenger_count} pax</div></td>
    <td>${STATUS_SEL("orders", o, ["pending", "confirmed", "checked_in", "cancelled", "refunded"])}</td>
    <td class="num">${money(o.total_amount, o.currency)}</td>
    <td><button class="btn btn-sm btn-ghost btn-danger" data-del="orders:${o.id}">Delete</button></td>
  </tr>`).join("");
}

function viewOrders() {
  return shell("Orders", "Bookings linking customers to flights.", "New order", "order",
    `<th>Booking</th><th>Customer</th><th>Flight</th><th>Cabin</th><th>Status</th><th class="num">Total</th><th></th>`,
    orderRows());
}

/* ----------------------------------------------------------------- modal */
const field = (name, label, attrs = "", wide = false) =>
  `<div class="field${wide ? " wide" : ""}"><label for="${name}">${label}</label><input id="${name}" name="${name}" ${attrs}></div>`;
const select = (name, label, opts, wide = false) =>
  `<div class="field${wide ? " wide" : ""}"><label for="${name}">${label}</label><select id="${name}" name="${name}">
    ${opts.map((o) => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join("")}</select></div>`;

const FORMS = {
  flight: {
    title: "New flight",
    body: () =>
      field("flight_number", "Flight number", 'required placeholder="LY315" pattern="[A-Z0-9]{2}[0-9]{1,4}"') +
      field("aircraft_type", "Aircraft", 'placeholder="Boeing 787-9"') +
      field("origin", "Origin (IATA)", 'required placeholder="TLV" pattern="[A-Za-z]{3}" maxlength="3"') +
      field("destination", "Destination (IATA)", 'required placeholder="JFK" pattern="[A-Za-z]{3}" maxlength="3"') +
      field("departure_time", "Departure", 'type="datetime-local" required') +
      field("arrival_time", "Arrival", 'type="datetime-local" required') +
      field("capacity", "Capacity", 'type="number" min="1" value="180" required') +
      field("seats_available", "Seats available", 'type="number" min="0" value="180" required') +
      field("base_price", "Base fare (USD)", 'type="number" min="0" step="0.01" value="300" required') +
      select("status", "Status", [["scheduled", "Scheduled"], ["boarding", "Boarding"], ["delayed", "Delayed"], ["cancelled", "Cancelled"]]),
    build: (d) => ({
      ...d,
      flight_number: d.flight_number.toUpperCase(),
      origin: d.origin.toUpperCase(),
      destination: d.destination.toUpperCase(),
      departure_time: new Date(d.departure_time).toISOString(),
      arrival_time: new Date(d.arrival_time).toISOString(),
      capacity: +d.capacity, seats_available: +d.seats_available, base_price: +d.base_price,
    }),
    table: "flights",
  },
  customer: {
    title: "New customer",
    body: () =>
      field("first_name", "First name", "required") +
      field("last_name", "Last name", "required") +
      field("email", "Email", 'type="email" required', true) +
      field("phone", "Phone", 'placeholder="+972-50-1234567"') +
      field("frequent_flyer_number", "Frequent flyer #", 'placeholder="FF100234"') +
      select("tier", "Tier", [["basic", "Basic"], ["silver", "Silver"], ["gold", "Gold"], ["platinum", "Platinum"]]) +
      field("country", "Country (ISO-2)", 'placeholder="IL" maxlength="2"'),
    build: (d) => ({
      ...d,
      country: d.country ? d.country.toUpperCase() : null,
      phone: d.phone || null,
      frequent_flyer_number: d.frequent_flyer_number || null,
    }),
    table: "customers",
  },
  order: {
    title: "New order",
    body: () =>
      field("booking_ref", "Booking reference", 'required maxlength="6" placeholder="QK4T7A" pattern="[A-Za-z0-9]{6}"') +
      select("cabin", "Cabin", [["economy", "Economy"], ["premium_economy", "Premium economy"], ["business", "Business"], ["first", "First"]]) +
      select("customer_id", "Customer", state.customers.map((c) => [c.id, `${c.last_name}, ${c.first_name}`]), true) +
      select("flight_id", "Flight", state.flights.map((f) => [f.id, `${f.flight_number} · ${f.origin}→${f.destination} · ${dt(f.departure_time)}`]), true) +
      field("seat_number", "Seat", 'placeholder="12A" pattern="[0-9]{1,2}[A-Ka-k]"') +
      field("passenger_count", "Passengers", 'type="number" min="1" max="9" value="1" required') +
      field("total_amount", "Total (USD)", 'type="number" min="0" step="0.01" required') +
      select("status", "Status", [["pending", "Pending"], ["confirmed", "Confirmed"], ["checked_in", "Checked in"], ["cancelled", "Cancelled"]]),
    build: (d) => ({
      ...d,
      booking_ref: d.booking_ref.toUpperCase(),
      seat_number: d.seat_number ? d.seat_number.toUpperCase() : null,
      passenger_count: +d.passenger_count,
      total_amount: +d.total_amount,
    }),
    table: "orders",
  },
};

function renderModal() {
  const f = FORMS[state.modal];
  return `<div class="modal-backdrop" id="backdrop"><form class="modal" id="modal-form">
    <div class="modal-head"><h2>${f.title}</h2><button type="button" class="btn btn-sm btn-ghost" id="close">✕</button></div>
    <div class="modal-body">${f.body()}</div>
    <div class="modal-foot">
      <button type="button" class="btn" id="cancel">Cancel</button>
      <button class="btn btn-primary">Create</button>
    </div></form></div>`;
}

function bindModal() {
  const form = document.getElementById("modal-form");
  if (!form) return;
  const close = () => { state.modal = null; render(); };
  document.getElementById("close").onclick = close;
  document.getElementById("cancel").onclick = close;
  document.getElementById("backdrop").onclick = (e) => { if (e.target.id === "backdrop") close(); };
  form.onsubmit = (e) => {
    e.preventDefault();
    const spec = FORMS[state.modal];
    const data = Object.fromEntries(new FormData(form).entries());
    mutate(() => db.from(spec.table).insert(spec.build(data)), "Created");
  };
}

/* ------------------------------------------------------------------ boot */
try {
  const t = localStorage.getItem("crm-theme");
  if (t) document.documentElement.setAttribute("data-theme", t);
} catch {}

async function boot() {
  await loadAll();
  render();
}
boot();
