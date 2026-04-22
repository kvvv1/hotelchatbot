-- ============================================================
-- 007_manual_inventory_snapshot.sql
-- Fallback de disponibilidade manual quando a API do PMS nao
-- estiver liberada. Armazena o ultimo snapshot importado.
-- ============================================================

alter table hotels
  add column if not exists manual_inventory_snapshot jsonb,
  add column if not exists manual_inventory_updated_at timestamptz,
  add column if not exists manual_inventory_source text;
