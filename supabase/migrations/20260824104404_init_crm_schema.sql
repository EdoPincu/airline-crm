-- Airline CRM: customers, flights, orders.
-- Internal staff CRM: every table is RLS-protected and reachable only by
-- authenticated staff. The anon role is never granted access.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Keeps updated_at honest without trusting the client to send it.
create or replace function set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- customers
create type customer_tier as enum ('basic', 'silver', 'gold', 'platinum');

create table customers (
  id                     uuid primary key default gen_random_uuid(),
  first_name             text not null check (length(first_name) between 1 and 100),
  last_name              text not null check (length(last_name) between 1 and 100),
  email                  citext not null unique,
  phone                  text,
  frequent_flyer_number  text unique,
  tier                   customer_tier not null default 'basic',
  date_of_birth          date,
  country                char(2),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index customers_last_name_idx on customers (last_name);
create index customers_tier_idx on customers (tier);

-- ------------------------------------------------------------------ flights
create type flight_status as enum ('scheduled', 'boarding', 'departed', 'landed', 'delayed', 'cancelled');

create table flights (
  id              uuid primary key default gen_random_uuid(),
  flight_number   text not null check (flight_number ~ '^[A-Z0-9]{2}[0-9]{1,4}$'),
  origin          char(3) not null check (origin ~ '^[A-Z]{3}$'),
  destination     char(3) not null check (destination ~ '^[A-Z]{3}$'),
  departure_time  timestamptz not null,
  arrival_time    timestamptz not null,
  aircraft_type   text,
  capacity        integer not null check (capacity > 0),
  seats_available integer not null check (seats_available >= 0),
  base_price      numeric(10,2) not null check (base_price >= 0),
  status          flight_status not null default 'scheduled',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint flights_distinct_endpoints check (origin <> destination),
  constraint flights_arrival_after_departure check (arrival_time > departure_time),
  constraint flights_seats_within_capacity check (seats_available <= capacity),
  -- A given flight number operates at most once per departure instant.
  constraint flights_number_departure_unique unique (flight_number, departure_time)
);

create index flights_departure_time_idx on flights (departure_time);
create index flights_route_idx on flights (origin, destination, departure_time);
create index flights_status_idx on flights (status);

-- ------------------------------------------------------------------- orders
create type order_status as enum ('pending', 'confirmed', 'checked_in', 'cancelled', 'refunded');
create type cabin_class as enum ('economy', 'premium_economy', 'business', 'first');

create table orders (
  id              uuid primary key default gen_random_uuid(),
  booking_ref     text not null unique check (booking_ref ~ '^[A-Z0-9]{6}$'),
  customer_id     uuid not null references customers (id) on delete restrict,
  flight_id       uuid not null references flights (id) on delete restrict,
  cabin           cabin_class not null default 'economy',
  seat_number     text check (seat_number ~ '^[0-9]{1,2}[A-K]$'),
  passenger_count integer not null default 1 check (passenger_count between 1 and 9),
  total_amount    numeric(10,2) not null check (total_amount >= 0),
  currency        char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status          order_status not null default 'pending',
  booked_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- One seat can only be sold once per flight.
  constraint orders_seat_unique_per_flight unique (flight_id, seat_number)
);

-- Index every foreign key: unindexed FKs make joins and parent deletes slow.
create index orders_customer_id_idx on orders (customer_id);
create index orders_flight_id_idx on orders (flight_id);
create index orders_status_idx on orders (status);
create index orders_booked_at_idx on orders (booked_at desc);

-- ----------------------------------------------------------------- triggers
create trigger customers_set_updated_at before update on customers
  for each row execute function set_updated_at();
create trigger flights_set_updated_at before update on flights
  for each row execute function set_updated_at();
create trigger orders_set_updated_at before update on orders
  for each row execute function set_updated_at();

-- --------------------------------------------------------------------- RLS
-- Staff-only CRM: authenticated users get full access, anon gets nothing.
alter table customers enable row level security;
alter table flights   enable row level security;
alter table orders    enable row level security;

create policy "staff read customers"   on customers for select to authenticated using (true);
create policy "staff write customers"  on customers for insert to authenticated with check (true);
create policy "staff update customers" on customers for update to authenticated using (true) with check (true);
create policy "staff delete customers" on customers for delete to authenticated using (true);

create policy "staff read flights"   on flights for select to authenticated using (true);
create policy "staff write flights"  on flights for insert to authenticated with check (true);
create policy "staff update flights" on flights for update to authenticated using (true) with check (true);
create policy "staff delete flights" on flights for delete to authenticated using (true);

create policy "staff read orders"   on orders for select to authenticated using (true);
create policy "staff write orders"  on orders for insert to authenticated with check (true);
create policy "staff update orders" on orders for update to authenticated using (true) with check (true);
create policy "staff delete orders" on orders for delete to authenticated using (true);

-- Expose to the Data API for authenticated staff only.
grant usage on schema public to authenticated;
grant select, insert, update, delete on customers, flights, orders to authenticated;
