// A tiny stand-in for the supabase-js client, implementing only the surface
// app.js actually uses. Data lives in localStorage, so edits survive a refresh
// but never leave the browser.
import { CUSTOMERS, FLIGHTS, ORDERS } from "./fixtures.js";

const KEY = "crm-demo-data";
const seed = () => structuredClone({ customers: CUSTOMERS, flights: FLIGHTS, orders: ORDERS });

let store;
try {
  const saved = localStorage.getItem(KEY);
  store = saved ? JSON.parse(saved) : seed();
} catch {
  store = seed();
}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} };

export function resetDemoData() {
  store = seed();
  persist();
}

const uid = () => "x" + Math.random().toString(36).slice(2, 10);
const ok = (data = null) => Promise.resolve({ data, error: null });
const fail = (message) => Promise.resolve({ data: null, error: { message } });

// Mirrors the DB constraints so the demo rejects the same things the real one does.
function validate(table, row) {
  const rows = store[table];
  const dup = (field, label) =>
    row[field] != null && rows.some((r) => r.id !== row.id && String(r[field]).toLowerCase() === String(row[field]).toLowerCase())
      ? `${label} "${row[field]}" is already taken` : null;

  if (table === "customers") return dup("email", "Email") || dup("frequent_flyer_number", "Frequent flyer number");
  if (table === "orders") {
    const seatTaken = row.seat_number && rows.some(
      (r) => r.id !== row.id && r.flight_id === row.flight_id && r.seat_number === row.seat_number);
    return dup("booking_ref", "Booking reference") || (seatTaken ? `Seat ${row.seat_number} is already sold on that flight` : null);
  }
  if (table === "flights") {
    if (row.origin === row.destination) return "Origin and destination must differ";
    if (new Date(row.arrival_time) <= new Date(row.departure_time)) return "Arrival must be after departure";
    if (row.seats_available > row.capacity) return "Seats available cannot exceed capacity";
    const clash = rows.some((r) => r.id !== row.id && r.flight_number === row.flight_number && r.departure_time === row.departure_time);
    return clash ? `${row.flight_number} already departs at that time` : null;
  }
  return null;
}

// Rebuilds the joins that PostgREST would do for `*, customers(...), flights(...)`.
function hydrate(table, rows) {
  if (table !== "orders") return rows;
  return rows.map((o) => {
    const c = store.customers.find((x) => x.id === o.customer_id);
    const f = store.flights.find((x) => x.id === o.flight_id);
    return {
      ...o,
      customers: c ? { first_name: c.first_name, last_name: c.last_name, email: c.email } : null,
      flights: f ? { flight_number: f.flight_number, origin: f.origin, destination: f.destination, departure_time: f.departure_time } : null,
    };
  });
}

function from(table) {
  const q = { op: "select", filters: [], sort: null, payload: null };

  const builder = {
    select() { q.op = "select"; return builder; },
    insert(payload) { q.op = "insert"; q.payload = payload; return builder; },
    update(payload) { q.op = "update"; q.payload = payload; return builder; },
    delete() { q.op = "delete"; return builder; },
    eq(col, val) { q.filters.push([col, val]); return builder; },
    order(col, opts = {}) { q.sort = [col, opts.ascending === false ? -1 : 1]; return builder; },
    then(resolve, reject) { return run().then(resolve, reject); },
  };

  async function run() {
    const rows = store[table];
    const matches = (r) => q.filters.every(([c, v]) => r[c] === v);

    if (q.op === "select") {
      let out = hydrate(table, rows.filter(matches));
      if (q.sort) {
        const [col, dir] = q.sort;
        out = [...out].sort((a, b) => (a[col] > b[col] ? dir : a[col] < b[col] ? -dir : 0));
      }
      return ok(out);
    }

    if (q.op === "insert") {
      const row = { id: uid(), created_at: new Date().toISOString(), booked_at: new Date().toISOString(), ...q.payload };
      const err = validate(table, row);
      if (err) return fail(err);
      rows.push(row);
      persist();
      return ok([row]);
    }

    if (q.op === "update") {
      const target = rows.find(matches);
      if (!target) return fail("Row not found");
      Object.assign(target, q.payload, { updated_at: new Date().toISOString() });
      persist();
      return ok([target]);
    }

    if (q.op === "delete") {
      const i = rows.findIndex(matches);
      if (i < 0) return fail("Row not found");
      // Mirrors `on delete restrict` on the orders foreign keys.
      const fk = table === "customers" ? "customer_id" : table === "flights" ? "flight_id" : null;
      if (fk && store.orders.some((o) => o[fk] === rows[i].id))
        return fail(`Cannot delete: orders still reference this ${table.replace(/s$/, "")}`);
      rows.splice(i, 1);
      persist();
      return ok([]);
    }
  }

  return builder;
}

export function createDemoClient() {
  return {
    from,
    auth: {
      getSession: async () => ({ data: { session: { user: { email: "demo@skyline.local" } } } }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: null }),
    },
  };
}
