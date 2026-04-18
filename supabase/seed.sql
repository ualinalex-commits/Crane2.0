-- ============================================
-- CRANE APP - Seed Data
-- Run AFTER migration.sql
-- ============================================
-- NOTE: You must create auth users first via Supabase Dashboard or Auth API.
-- The passwords below are for reference. Create these users with Supabase Auth,
-- then update the UUIDs in this script to match.

-- Replace these UUIDs with actual auth.users IDs after creating them:
-- Admin:            admin@crane.app         / password123
-- Company Admin:    companyadmin@crane.app  / password123
-- Appointed Person: ap@crane.app           / password123
-- Crane Supervisor: supervisor@crane.app    / password123
-- Crane Operator:   operator@crane.app      / password123
-- Slinger:          slinger@crane.app       / password123
-- Subcontractor:    sub@crane.app           / password123

-- Step 1: Create Company
insert into public.companies (id, name) values
  ('a0000000-0000-0000-0000-000000000001', 'Acme Construction Ltd');

-- Step 2: Create Site
insert into public.sites (id, company_id, name, address) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Central Tower Project', '123 Main Street, London EC1A 1BB');

-- Step 3: Create Cranes
insert into public.cranes (id, site_id, name, model, capacity) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Tower Crane 1', 'Liebherr 280 EC-H 12', '12 tonnes'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Tower Crane 2', 'Potain MDT 389', '16 tonnes'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Mobile Crane 1', 'Tadano GR-1000XL', '100 tonnes');

-- Step 4: Create Subcontractor
insert into public.subcontractors (id, site_id, company_name, contact_name, contact_email) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Smith Steel Erectors', 'James Smith', 'sub@crane.app');

-- Step 5: Create profiles (update user_id values after creating auth users)
-- These will be auto-created by the trigger, but if you need to set company/site:
--
-- UPDATE public.profiles SET
--   company_id = 'a0000000-0000-0000-0000-000000000001',
--   role = 'admin'
-- WHERE email = 'admin@crane.app';
--
-- UPDATE public.profiles SET
--   company_id = 'a0000000-0000-0000-0000-000000000001',
--   role = 'company_admin'
-- WHERE email = 'companyadmin@crane.app';
--
-- UPDATE public.profiles SET
--   company_id = 'a0000000-0000-0000-0000-000000000001',
--   site_id = 'b0000000-0000-0000-0000-000000000001',
--   role = 'appointed_person'
-- WHERE email = 'ap@crane.app';
--
-- UPDATE public.profiles SET
--   company_id = 'a0000000-0000-0000-0000-000000000001',
--   site_id = 'b0000000-0000-0000-0000-000000000001',
--   role = 'crane_supervisor'
-- WHERE email = 'supervisor@crane.app';
--
-- UPDATE public.profiles SET
--   company_id = 'a0000000-0000-0000-0000-000000000001',
--   site_id = 'b0000000-0000-0000-0000-000000000001',
--   role = 'crane_operator'
-- WHERE email = 'operator@crane.app';
--
-- UPDATE public.profiles SET
--   company_id = 'a0000000-0000-0000-0000-000000000001',
--   site_id = 'b0000000-0000-0000-0000-000000000001',
--   role = 'slinger_signaller'
-- WHERE email = 'slinger@crane.app';
--
-- UPDATE public.profiles SET
--   company_id = 'a0000000-0000-0000-0000-000000000001',
--   site_id = 'b0000000-0000-0000-0000-000000000001',
--   role = 'subcontractor',
--   subcontractor_company_name = 'Smith Steel Erectors'
-- WHERE email = 'sub@crane.app';
