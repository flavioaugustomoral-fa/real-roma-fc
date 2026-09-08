-- ==============================================================================
-- SISTEMA DE GESTÃO DE PELADA - SUPABASE / POSTGRESQL SCHEMA & RLS POLICIES
-- ==============================================================================
-- Observação sobre segurança: este app protege ações de Admin com um PIN
-- verificado no front-end (não usa Supabase Auth). Por isso as políticas de
-- RLS abaixo liberam leitura e escrita públicas (via chave anônima) em vez de
-- exigir auth.role() = 'authenticated'. Adequado para um app de uso interno
-- entre amigos, sem dados sensíveis. Os IDs são TEXT (não UUID) porque o app
-- gera seus próprios IDs no cliente (ex: "p_1699999999_ab3de").

-- 0. Recria do zero: remove qualquer tentativa anterior de schema (ex: com
-- IDs do tipo UUID, incompatíveis com os IDs em texto gerados pelo app) para
-- garantir que o script abaixo rode de forma limpa e consistente.
DROP VIEW IF EXISTS view_ranking_gols;
DROP VIEW IF EXISTS view_ranking_assistencias;
DROP TABLE IF EXISTS public.stat_events CASCADE;
DROP TABLE IF EXISTS public.match_players CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.pelada_settings CASCADE;
DROP TYPE IF EXISTS match_status_enum CASCADE;
DROP TYPE IF EXISTS stat_event_type_enum CASCADE;

-- 1. Habilitar extensão necessária para normalização de texto
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 2. Tabela: players (identidade interna do jogador)
CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_normalized ON public.players(normalized_name);

-- 3. Tabela: matches (peladas)
DO $$ BEGIN
  CREATE TYPE match_status_enum AS ENUM ('DRAFT', 'IN_PROGRESS', 'FINALIZED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.matches (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  time TIME DEFAULT '19:00',
  status match_status_enum NOT NULL DEFAULT 'DRAFT',
  created_by TEXT NOT NULL DEFAULT 'Administrador',
  finalized_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_matches_date ON public.matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);

-- 4. Tabela: match_players (participações oficiais daquela pelada)
CREATE TABLE IF NOT EXISTS public.match_players (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  player_name_as_entered TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_player_per_match UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_players_match ON public.match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player ON public.match_players(player_id);

-- 5. Tabela: stat_events (lançamentos individuais de gols e assistências)
DO $$ BEGIN
  CREATE TYPE stat_event_type_enum AS ENUM ('GOAL', 'ASSIST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.stat_events (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  type stat_event_type_enum NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'Participante',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stat_events_match ON public.stat_events(match_id);
CREATE INDEX IF NOT EXISTS idx_stat_events_player_type ON public.stat_events(player_id, type);

-- 6. Tabela: audit_logs (registro de ações administrativas)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  match_id TEXT REFERENCES public.matches(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Tabela: pelada_settings (configurações compartilhadas do grupo - linha única)
CREATE TABLE IF NOT EXISTS public.pelada_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  pelada_name TEXT NOT NULL DEFAULT 'Pelada dos Amigos',
  logo_url TEXT,
  admin_pin TEXT NOT NULL DEFAULT '1234',
  venue_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- FUNÇÃO DE NORMALIZAÇÃO AUTOMÁTICA DE NOMES
-- ==============================================================================
CREATE OR REPLACE FUNCTION normalize_player_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN TRIM(REGEXP_REPLACE(LOWER(UNACCENT(input_text)), '\s+', ' ', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Leitura e escrita públicas via chave anônima. A proteção de ações de Admin
-- (criar/finalizar pelada, editar placar) é feita pelo PIN no front-end, não
-- pelo banco de dados.
-- ==============================================================================

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pelada_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso publico total" ON public.players;
CREATE POLICY "Acesso publico total" ON public.players FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico total" ON public.matches;
CREATE POLICY "Acesso publico total" ON public.matches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico total" ON public.match_players;
CREATE POLICY "Acesso publico total" ON public.match_players FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico total" ON public.audit_logs;
CREATE POLICY "Acesso publico total" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico total" ON public.pelada_settings;
CREATE POLICY "Acesso publico total" ON public.pelada_settings FOR ALL USING (true) WITH CHECK (true);

-- stat_events: leitura, atualização e exclusão públicas, mas a inserção só é
-- permitida enquanto a pelada estiver EM ANDAMENTO (regra de integridade dos
-- dados, independente do PIN).
DROP POLICY IF EXISTS "Leitura publica stat_events" ON public.stat_events;
CREATE POLICY "Leitura publica stat_events" ON public.stat_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insercao apenas em pelada em andamento" ON public.stat_events;
CREATE POLICY "Insercao apenas em pelada em andamento"
ON public.stat_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND m.status = 'IN_PROGRESS'
  )
);

DROP POLICY IF EXISTS "Atualizacao publica stat_events" ON public.stat_events;
CREATE POLICY "Atualizacao publica stat_events" ON public.stat_events FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Exclusao publica stat_events" ON public.stat_events;
CREATE POLICY "Exclusao publica stat_events" ON public.stat_events FOR DELETE USING (true);

-- ==============================================================================
-- REALTIME: garante que INSERT/UPDATE/DELETE sejam transmitidos aos clientes
-- ==============================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.match_players;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stat_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pelada_settings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- VIEWS DE RANKINGS OFICIAIS (APENAS PELADAS FINALIZADAS)
-- ==============================================================================

CREATE OR REPLACE VIEW view_ranking_gols AS
SELECT
  ROW_NUMBER() OVER (ORDER BY COUNT(se.id) DESC, COUNT(DISTINCT mp.match_id) ASC, p.display_name ASC) AS posicao,
  p.id AS player_id,
  p.display_name,
  COUNT(se.id) AS total_gols,
  COUNT(DISTINCT mp.match_id) AS peladas_disputadas,
  ROUND(COUNT(se.id)::numeric / NULLIF(COUNT(DISTINCT mp.match_id), 0), 2) AS media_gols_por_pelada
FROM public.players p
INNER JOIN public.match_players mp ON mp.player_id = p.id
INNER JOIN public.matches m ON m.id = mp.match_id AND m.status = 'FINALIZED'
LEFT JOIN public.stat_events se ON se.player_id = p.id AND se.match_id = m.id AND se.type = 'GOAL'
GROUP BY p.id, p.display_name
HAVING COUNT(se.id) > 0
ORDER BY total_gols DESC, peladas_disputadas ASC, p.display_name ASC;

CREATE OR REPLACE VIEW view_ranking_assistencias AS
SELECT
  ROW_NUMBER() OVER (ORDER BY COUNT(se.id) DESC, COUNT(DISTINCT mp.match_id) ASC, p.display_name ASC) AS posicao,
  p.id AS player_id,
  p.display_name,
  COUNT(se.id) AS total_assistencias,
  COUNT(DISTINCT mp.match_id) AS peladas_disputadas,
  ROUND(COUNT(se.id)::numeric / NULLIF(COUNT(DISTINCT mp.match_id), 0), 2) AS media_assistencias_por_pelada
FROM public.players p
INNER JOIN public.match_players mp ON mp.player_id = p.id
INNER JOIN public.matches m ON m.id = mp.match_id AND m.status = 'FINALIZED'
LEFT JOIN public.stat_events se ON se.player_id = p.id AND se.match_id = m.id AND se.type = 'ASSIST'
GROUP BY p.id, p.display_name
HAVING COUNT(se.id) > 0
ORDER BY total_assistencias DESC, peladas_disputadas ASC, p.display_name ASC;
