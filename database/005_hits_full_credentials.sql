-- ============================================================
-- 005_hits_full_credentials.sql
-- Credenciais completas HITS PMS por hotel
-- ============================================================

alter table hotels
  add column if not exists hits_api_url text,
  add column if not exists hits_api_key text,
  add column if not exists hits_tenant_name text,
  add column if not exists hits_property_code integer,
  add column if not exists hits_client_id text;
