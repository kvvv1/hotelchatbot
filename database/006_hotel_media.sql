-- ================================================================
-- 006 — Galeria de mídia, tags em leads, templates de mensagem
-- ================================================================

-- Tabela de mídia do hotel (fotos de quartos, áreas, etc.)
CREATE TABLE IF NOT EXISTS hotel_media (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  storage_path TEXT,                    -- caminho no Supabase Storage para deletar
  category    TEXT        NOT NULL DEFAULT 'general',
  caption     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_media_hotel_id ON hotel_media(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_media_category  ON hotel_media(hotel_id, category);

-- RLS
ALTER TABLE hotel_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel staff can manage own media"
  ON hotel_media FOR ALL
  USING (
    hotel_id IN (
      SELECT hotel_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Tags nos leads (array de texto)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Templates de mensagem rápida no bot_settings
ALTER TABLE bot_settings
  ADD COLUMN IF NOT EXISTS quick_templates JSONB NOT NULL DEFAULT '[]';

-- ================================================================
-- Supabase Storage bucket para a galeria do hotel.
-- Mantemos o bucket publico para que as URLs possam ser abertas
-- no WhatsApp sem autenticacao.
-- ================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('hotel-media', 'hotel-media', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

-- Os uploads/remocoes rodam por API server-side com service role,
-- entao nao precisamos de policies de escrita em storage.objects.
