# Skyline CRM — Airline Customer Relationship Management

> **You are on the `demo-no-login` branch.** The app runs entirely in your
> browser against bundled fixtures in `web/fixtures.js` — no login, no Supabase
> connection, and no API key in this branch at all. Edits persist to
> localStorage and there is a **Reset demo data** button in the sidebar.
> Switch to `main` for the real, RLS-protected build.

A small CRM for an airline: **flights**, **customers**, and **orders**, backed by
Supabase (Postgres + Auth + Data API) with a zero-build web front end.

![status](https://img.shields.io/badge/status-demo-blue)

## Live project

| | |
|---|---|
| Supabase org | `Airline CRM` |
| Supabase project | `airline-crm` (`qqjbomzxqvbauutvhrpk`, `eu-central-1`) |
| API URL | `https://qqjbomzxqvbauutvhrpk.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/qqjbomzxqvbauutvhrpk |

## Data model

Three tables, all in `public`, all with Row Level Security enabled.

### `customers`
Passenger profiles and loyalty state.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `first_name`, `last_name` | `text` | 1–100 chars |
| `email` | `citext` | unique, case-insensitive |
| `phone` | `text` | |
| `frequent_flyer_number` | `text` | unique |
| `tier` | `customer_tier` | `basic` \| `silver` \| `gold` \| `platinum` |
| `date_of_birth` | `date` | |
| `country` | `char(2)` | ISO-3166 alpha-2 |
| `created_at`, `updated_at` | `timestamptz` | `updated_at` maintained by trigger |

### `flights`
The schedule, with capacity and operational status.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `flight_number` | `text` | `^[A-Z0-9]{2}[0-9]{1,4}$` |
| `origin`, `destination` | `char(3)` | IATA; must differ |
| `departure_time`, `arrival_time` | `timestamptz` | arrival must be after departure |
| `aircraft_type` | `text` | |
| `capacity`, `seats_available` | `integer` | `seats_available <= capacity` |
| `base_price` | `numeric(10,2)` | |
| `status` | `flight_status` | `scheduled` \| `boarding` \| `departed` \| `landed` \| `delayed` \| `cancelled` |

Unique on `(flight_number, departure_time)` — a flight number operates at most
once per departure instant.

### `orders`
Bookings that join a customer to a flight.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `booking_ref` | `text` | unique PNR, `^[A-Z0-9]{6}$` |
| `customer_id` | `uuid` | → `customers.id`, `on delete restrict` |
| `flight_id` | `uuid` | → `flights.id`, `on delete restrict` |
| `cabin` | `cabin_class` | `economy` \| `premium_economy` \| `business` \| `first` |
| `seat_number` | `text` | e.g. `12A` |
| `passenger_count` | `integer` | 1–9 |
| `total_amount` | `numeric(10,2)` | |
| `currency` | `char(3)` | default `USD` |
| `status` | `order_status` | `pending` \| `confirmed` \| `checked_in` \| `cancelled` \| `refunded` |

Unique on `(flight_id, seat_number)` — a seat is sold once per flight.
Both foreign keys are indexed.

## Security model

This is an **internal staff CRM**, so access is all-or-nothing by role:

- RLS is enabled on all three tables.
- Policies target `TO authenticated` only, for `select` / `insert` / `update` / `delete`.
  `update` policies carry both `USING` and `WITH CHECK`.
- The `anon` role is granted nothing — an unauthenticated caller sees zero rows.
- The browser uses the **publishable** key (`web/config.js`), which is safe to
  commit. The secret / `service_role` key is never used client-side and is not
  in this repo.

If you later expose customer-facing self-service, replace the blanket
`using (true)` policies with ownership predicates (e.g. `customer_id = auth.uid()`).

## Running the demo

No login, no keys, no setup:

```bash
cd web
python3 -m http.server 5173
# open http://localhost:5173
```

### Why fixtures instead of opening up the database

Git branches do not branch Postgres. Granting `anon` read access so this branch
could skip the login would have made the live `customers` table readable from
`main` too — and the publishable key ships to every browser regardless of
whether the repo is public or private. Bundling the data is the only version of
"no login" that leaves the real database untouched.

## What's in the UI

- **Dashboard** — booked revenue, upcoming flights, customer count, load factor,
  and the next five departures.
- **Flights** — schedule table with a seats-sold bar and inline status changes.
- **Customers** — profiles, loyalty tier, and per-customer order counts.
- **Orders** — bookings joined to customer and flight, with inline status changes.

All three tables support search, create (modal form with client-side validation
mirroring the DB constraints), inline status updates, and delete.
Light/dark themes follow the OS and can be toggled manually.

## Repo layout

```
supabase/
  config.toml
  migrations/
    20260824104404_init_crm_schema.sql   # tables, enums, indexes, triggers, RLS
web/
  index.html      # shell
  styles.css      # design tokens + layout, theme-aware
  app.js          # data access, views, forms (vanilla ES modules)
  config.js       # project URL + publishable key
```

## Known issues

- **Advisor `extension_in_public`** — `citext` is installed in the `public`
  schema. The documented fix (`alter extension citext set schema extensions`)
  blocked on a lock and was rolled back rather than left as an unapplied
  migration. A clean alternative is to drop `citext` and use `text` with a
  unique index on `lower(email)`.
- The UI was hand-built. The original plan was to generate it with the Stitch
  MCP server, which is not installed in this environment.
