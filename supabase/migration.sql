-- ============================================
-- CRANE APP - Supabase Migration
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

create table public.companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_at timestamptz default now() not null
);

create table public.sites (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null,
  address text not null default '',
  created_at timestamptz default now() not null
);

create table public.cranes (
  id uuid default uuid_generate_v4() primary key,
  site_id uuid references public.sites(id) on delete cascade not null,
  name text not null,
  model text not null default '',
  capacity text not null default '',
  created_at timestamptz default now() not null
);

create table public.profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin','company_admin','appointed_person','crane_supervisor','crane_operator','slinger_signaller','subcontractor')),
  company_id uuid references public.companies(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  subcontractor_company_name text,
  created_at timestamptz default now() not null
);

create table public.subcontractors (
  id uuid default uuid_generate_v4() primary key,
  site_id uuid references public.sites(id) on delete cascade not null,
  company_name text not null,
  contact_name text not null,
  contact_email text not null,
  created_at timestamptz default now() not null
);

create table public.crane_logs (
  id uuid default uuid_generate_v4() primary key,
  crane_id uuid references public.cranes(id) on delete cascade not null,
  site_id uuid references public.sites(id) on delete cascade not null,
  created_by uuid references auth.users(id) not null,
  status text not null check (status in ('Working','Service','Thorough Examination','Breaking Down','Winded Off')),
  job_details text not null default '',
  subcontractor_id uuid references public.subcontractors(id) on delete set null,
  start_time timestamptz default now() not null,
  end_time timestamptz,
  is_open boolean default true not null,
  closed_by uuid references auth.users(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.crane_log_images (
  id uuid default uuid_generate_v4() primary key,
  log_id uuid references public.crane_logs(id) on delete cascade not null,
  image_url text not null,
  created_at timestamptz default now() not null
);

create table public.crane_bookings (
  id uuid default uuid_generate_v4() primary key,
  crane_id uuid references public.cranes(id) on delete cascade not null,
  site_id uuid references public.sites(id) on delete cascade not null,
  subcontractor_id uuid references public.subcontractors(id) on delete set null,
  created_by uuid references auth.users(id) not null,
  job_details text not null default '',
  job_date_start date not null,
  job_date_end date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'pending' check (status in ('pending','approved','cancelled')),
  approved_by uuid references auth.users(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.cancellation_log (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.crane_bookings(id) on delete cascade not null,
  crane_id uuid references public.cranes(id) on delete cascade not null,
  booking_details jsonb not null default '{}'::jsonb,
  cancelled_by uuid references auth.users(id) not null,
  cancelled_at timestamptz default now() not null
);

-- ============================================
-- INDEXES
-- ============================================

create index idx_sites_company on public.sites(company_id);
create index idx_cranes_site on public.cranes(site_id);
create index idx_profiles_user on public.profiles(user_id);
create index idx_profiles_site on public.profiles(site_id);
create index idx_profiles_company on public.profiles(company_id);
create index idx_subcontractors_site on public.subcontractors(site_id);
create index idx_crane_logs_site on public.crane_logs(site_id);
create index idx_crane_logs_crane on public.crane_logs(crane_id);
create index idx_crane_logs_open on public.crane_logs(crane_id, is_open) where is_open = true;
create index idx_crane_bookings_site on public.crane_bookings(site_id);
create index idx_crane_bookings_crane on public.crane_bookings(crane_id);
create index idx_crane_bookings_dates on public.crane_bookings(job_date_start, job_date_end);
create index idx_cancellation_log_booking on public.cancellation_log(booking_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.companies enable row level security;
alter table public.sites enable row level security;
alter table public.cranes enable row level security;
alter table public.profiles enable row level security;
alter table public.subcontractors enable row level security;
alter table public.crane_logs enable row level security;
alter table public.crane_log_images enable row level security;
alter table public.crane_bookings enable row level security;
alter table public.cancellation_log enable row level security;

-- Helper function to get current user role
create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where user_id = auth.uid();
$$ language sql security definer stable;

-- Helper function to get current user site_id
create or replace function public.get_user_site_id()
returns uuid as $$
  select site_id from public.profiles where user_id = auth.uid();
$$ language sql security definer stable;

-- Helper function to get current user company_id
create or replace function public.get_user_company_id()
returns uuid as $$
  select company_id from public.profiles where user_id = auth.uid();
$$ language sql security definer stable;

-- COMPANIES policies
create policy "Admin full access to companies" on public.companies for all using (public.get_user_role() = 'admin');
create policy "Company admin read own company" on public.companies for select using (id = public.get_user_company_id());

-- SITES policies
create policy "Admin full access to sites" on public.sites for all using (public.get_user_role() = 'admin');
create policy "Company admin manage own sites" on public.sites for all using (company_id = public.get_user_company_id() and public.get_user_role() = 'company_admin');
create policy "Site users read own site" on public.sites for select using (id = public.get_user_site_id());

-- CRANES policies
create policy "Admin full access to cranes" on public.cranes for all using (public.get_user_role() = 'admin');
create policy "AP manage site cranes" on public.cranes for all using (site_id = public.get_user_site_id() and public.get_user_role() = 'appointed_person');
create policy "Site users read cranes" on public.cranes for select using (site_id = public.get_user_site_id());

-- PROFILES policies
create policy "Admin full access to profiles" on public.profiles for all using (public.get_user_role() = 'admin');
create policy "Company admin manage company profiles" on public.profiles for all using (company_id = public.get_user_company_id() and public.get_user_role() = 'company_admin');
create policy "AP manage site profiles" on public.profiles for all using (site_id = public.get_user_site_id() and public.get_user_role() = 'appointed_person');
create policy "Users read own profile" on public.profiles for select using (user_id = auth.uid());

-- SUBCONTRACTORS policies
create policy "AP manage subcontractors" on public.subcontractors for all using (site_id = public.get_user_site_id() and public.get_user_role() = 'appointed_person');
create policy "Site users read subcontractors" on public.subcontractors for select using (site_id = public.get_user_site_id());

-- CRANE LOGS policies
create policy "Site users read logs" on public.crane_logs for select using (site_id = public.get_user_site_id());
create policy "Operators create logs" on public.crane_logs for insert with check (site_id = public.get_user_site_id() and public.get_user_role() in ('crane_operator','crane_supervisor'));
create policy "Site users update logs" on public.crane_logs for update using (site_id = public.get_user_site_id() and public.get_user_role() in ('crane_operator','crane_supervisor','appointed_person'));

-- CRANE LOG IMAGES policies
create policy "Site users read images" on public.crane_log_images for select using (exists (select 1 from public.crane_logs cl where cl.id = log_id and cl.site_id = public.get_user_site_id()));
create policy "Log creators manage images" on public.crane_log_images for all using (exists (select 1 from public.crane_logs cl where cl.id = log_id and cl.site_id = public.get_user_site_id()));

-- CRANE BOOKINGS policies
create policy "Site users read bookings" on public.crane_bookings for select using (site_id = public.get_user_site_id());
create policy "AP and subs create bookings" on public.crane_bookings for insert with check (site_id = public.get_user_site_id() and public.get_user_role() in ('appointed_person','subcontractor'));
create policy "AP update bookings" on public.crane_bookings for update using (site_id = public.get_user_site_id() and public.get_user_role() in ('appointed_person','subcontractor'));

-- CANCELLATION LOG policies
create policy "AP read cancellations" on public.cancellation_log for select using (public.get_user_role() in ('appointed_person','admin'));
create policy "Users create cancellations" on public.cancellation_log for insert with check (cancelled_by = auth.uid());

-- ============================================
-- TRIGGER: auto-create profile on signup
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'crane_operator')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
