-- ============================================================
-- 004_add_hits_to_hotels.sql
-- Adiciona credenciais HITS PMS por hotel
-- ============================================================

alter table hotels
  add column if not exists hits_api_url text,
  add column if not exists hits_api_key text;
