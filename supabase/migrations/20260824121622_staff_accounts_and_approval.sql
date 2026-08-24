-- Staff accounts with an admin approval gate.
--
-- Self-service signup is now open, so "authenticated" can no longer mean
-- "trusted". A new signup lands in `staff` as `pending` and can read nothing;
-- an admin must approve it before any CRM data becomes visible.

create type staff_role as enum ('admin', 'agent');
create type staff_status as enum ('pending', 'approved', 'suspended');

create table staff (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        staff_role not null default 'agent',
  status      staff_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null
);

create index staff_status_idx on staff (status);
create index staff_approved_by_idx on staff (approved_by);

create trigger staff_set_updated_at before update on staff
  for each row execute function set_updated_at();

-- ------------------------------------------------- provision on signup
-- Runs as definer because a signing-up user has no rights on `staff` yet.
-- Only full_name is taken from user metadata: it is user-editable, so role and
-- status are never sourced from it.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------- authorization helpers
-- Kept out of `public` so they are not callable as a Data API endpoint.
-- Definer rights let them read `staff` without tripping that table's own RLS,
-- which is what stops the policies below from recursing.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_approved_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and status = 'approved'
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and status = 'approved' and role = 'admin'
  );
$$;

revoke execute on function private.is_approved_staff() from public, anon;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_approved_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

-- ------------------------------------------------- staff table RLS
alter table staff enable row level security;

-- Everyone signed in can see their own row, so the app can tell them whether
-- they are pending, approved or suspended.
create policy "read own staff row" on staff for select to authenticated
  using (id = (select auth.uid()));

create policy "admins read all staff" on staff for select to authenticated
  using (private.is_admin());

create policy "admins update staff" on staff for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- No insert policy: rows are created only by the signup trigger.
grant select, update on staff to authenticated;

-- ------------------------------------------------- re-gate the CRM tables
-- Replaces the blanket `using (true)` policies, which trusted any
-- authenticated user.
drop policy "staff read customers"   on customers;
drop policy "staff write customers"  on customers;
drop policy "staff update customers" on customers;
drop policy "staff delete customers" on customers;
drop policy "staff read flights"   on flights;
drop policy "staff write flights"  on flights;
drop policy "staff update flights" on flights;
drop policy "staff delete flights" on flights;
drop policy "staff read orders"   on orders;
drop policy "staff write orders"  on orders;
drop policy "staff update orders" on orders;
drop policy "staff delete orders" on orders;

create policy "approved staff read customers"   on customers for select to authenticated using (private.is_approved_staff());
create policy "approved staff write customers"  on customers for insert to authenticated with check (private.is_approved_staff());
create policy "approved staff update customers" on customers for update to authenticated using (private.is_approved_staff()) with check (private.is_approved_staff());
create policy "approved staff delete customers" on customers for delete to authenticated using (private.is_approved_staff());

create policy "approved staff read flights"   on flights for select to authenticated using (private.is_approved_staff());
create policy "approved staff write flights"  on flights for insert to authenticated with check (private.is_approved_staff());
create policy "approved staff update flights" on flights for update to authenticated using (private.is_approved_staff()) with check (private.is_approved_staff());
create policy "approved staff delete flights" on flights for delete to authenticated using (private.is_approved_staff());

create policy "approved staff read orders"   on orders for select to authenticated using (private.is_approved_staff());
create policy "approved staff write orders"  on orders for insert to authenticated with check (private.is_approved_staff());
create policy "approved staff update orders" on orders for update to authenticated using (private.is_approved_staff()) with check (private.is_approved_staff());
create policy "approved staff delete orders" on orders for delete to authenticated using (private.is_approved_staff());

-- ------------------------------------------------- bootstrap
-- Anyone who already had an account predates the approval gate, so they become
-- the founding admins. On a fresh project this is the single user created by
-- scripts/create-staff-user.sh.
insert into staff (id, email, role, status, approved_at)
select id, email, 'admin', 'approved', now() from auth.users
on conflict (id) do nothing;
