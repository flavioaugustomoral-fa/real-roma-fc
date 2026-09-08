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
DROP FUNCTION IF EXISTS check_admin_pin(TEXT);
DROP FUNCTION IF EXISTS verify_admin_pin(TEXT);
DROP FUNCTION IF EXISTS admin_upsert_player(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS admin_upsert_match(TEXT, TEXT, DATE, TIME, match_status_enum, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS admin_delete_match(TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_upsert_match_player(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS admin_replace_match_players(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS admin_delete_stat_event(TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_insert_stat_event(TEXT, TEXT, TEXT, TEXT, stat_event_type_enum, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS admin_insert_audit_log(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS admin_upsert_settings(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_wipe_all(TEXT);

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
-- Leitura pública via chave anônima. Ações de Admin (criar/editar/finalizar/
-- excluir pelada, corrigir súmula, trocar configurações) NÃO são mais escritas
-- direto pelo cliente: elas só acontecem através das funções admin_* mais
-- abaixo, que conferem o PIN dentro do próprio banco antes de gravar. Lançar
-- gol/assistência continua público e direto (qualquer participante, sem PIN),
-- mas só enquanto a pelada estiver EM ANDAMENTO.
-- ==============================================================================

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pelada_settings ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas (versões anteriores deste script liberavam escrita
-- pública direta nessas tabelas; isso não existe mais).
DROP POLICY IF EXISTS "Acesso publico total" ON public.players;
DROP POLICY IF EXISTS "Acesso publico total" ON public.matches;
DROP POLICY IF EXISTS "Acesso publico total" ON public.match_players;
DROP POLICY IF EXISTS "Acesso publico total" ON public.audit_logs;
DROP POLICY IF EXISTS "Acesso publico total" ON public.pelada_settings;
DROP POLICY IF EXISTS "Atualizacao publica stat_events" ON public.stat_events;
DROP POLICY IF EXISTS "Exclusao publica stat_events" ON public.stat_events;

-- Leitura pública em todas as tabelas (nenhum dado sensível fica em colunas
-- lidas por SELECT * — o PIN de admin_pin é tratado à parte, ver GRANT abaixo).
DROP POLICY IF EXISTS "Leitura publica players" ON public.players;
CREATE POLICY "Leitura publica players" ON public.players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura publica matches" ON public.matches;
CREATE POLICY "Leitura publica matches" ON public.matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura publica match_players" ON public.match_players;
CREATE POLICY "Leitura publica match_players" ON public.match_players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura publica audit_logs" ON public.audit_logs;
CREATE POLICY "Leitura publica audit_logs" ON public.audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura publica pelada_settings" ON public.pelada_settings;
CREATE POLICY "Leitura publica pelada_settings" ON public.pelada_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura publica stat_events" ON public.stat_events;
CREATE POLICY "Leitura publica stat_events" ON public.stat_events FOR SELECT USING (true);

-- stat_events: inserção pública (qualquer participante lança seu próprio gol/
-- assistência, sem PIN), mas só enquanto a pelada estiver EM ANDAMENTO.
-- Atualização/exclusão foram removidas daqui: correções passam a exigir o PIN
-- via admin_delete_stat_event().
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

-- pelada_settings: esconde a coluna admin_pin de qualquer leitura via API,
-- mesmo com a policy de SELECT acima liberada. Um "select *" do cliente falha
-- se tentar ler admin_pin; por isso o app só faz select das colunas liberadas.
REVOKE ALL ON public.pelada_settings FROM anon, authenticated;
GRANT SELECT (id, pelada_name, logo_url, venue_name, updated_at) ON public.pelada_settings TO anon, authenticated;

-- ==============================================================================
-- FUNÇÕES DE ADMIN (SECURITY DEFINER): conferem o PIN dentro do banco antes de
-- gravar. É por aqui que toda escrita de Admin passa agora — o cliente nunca
-- mais escreve direto nas tabelas de matches/players/match_players/audit_logs
-- /pelada_settings, e nunca lê ou guarda o PIN localmente.
-- ==============================================================================

-- Helper interno: gera erro se o PIN não bater. Enquanto pelada_settings ainda
-- não tiver nenhuma linha (projeto Supabase recém-criado), libera qualquer PIN
-- — é a janela de "bootstrap" usada para semear o app na primeira vez.
CREATE OR REPLACE FUNCTION check_admin_pin(p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pelada_settings WHERE id = 'default')
     AND NOT EXISTS (SELECT 1 FROM public.pelada_settings WHERE id = 'default' AND admin_pin = p_pin) THEN
    RAISE EXCEPTION 'PIN de administrador inválido' USING ERRCODE = '28000';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION verify_admin_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.pelada_settings WHERE id = 'default' AND admin_pin = p_pin);
$$;

CREATE OR REPLACE FUNCTION admin_upsert_player(
  p_pin TEXT, p_id TEXT, p_display_name TEXT, p_normalized_name TEXT, p_created_at TIMESTAMPTZ
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  INSERT INTO public.players (id, display_name, normalized_name, created_at)
  VALUES (p_id, p_display_name, p_normalized_name, COALESCE(p_created_at, NOW()))
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    normalized_name = EXCLUDED.normalized_name;
END;
$$;

CREATE OR REPLACE FUNCTION admin_upsert_match(
  p_pin TEXT, p_id TEXT, p_date DATE, p_time TIME, p_status match_status_enum,
  p_created_by TEXT, p_finalized_by TEXT, p_created_at TIMESTAMPTZ, p_finalized_at TIMESTAMPTZ, p_notes TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  INSERT INTO public.matches (id, date, time, status, created_by, finalized_by, created_at, finalized_at, notes)
  VALUES (p_id, p_date, p_time, p_status, p_created_by, p_finalized_by, COALESCE(p_created_at, NOW()), p_finalized_at, p_notes)
  ON CONFLICT (id) DO UPDATE SET
    date = EXCLUDED.date,
    time = EXCLUDED.time,
    status = EXCLUDED.status,
    created_by = EXCLUDED.created_by,
    finalized_by = EXCLUDED.finalized_by,
    finalized_at = EXCLUDED.finalized_at,
    notes = EXCLUDED.notes;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_match(p_pin TEXT, p_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  DELETE FROM public.matches WHERE id = p_id;
END;
$$;

-- Substitui toda a lista de participantes de uma pelada (apaga e reinsere).
-- Usada tanto para lançar a lista inicial quanto para uma correção do Admin.
CREATE OR REPLACE FUNCTION admin_replace_match_players(p_pin TEXT, p_match_id TEXT, p_rows JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r JSONB;
BEGIN
  PERFORM check_admin_pin(p_pin);
  DELETE FROM public.match_players WHERE match_id = p_match_id;
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO public.match_players (id, match_id, player_id, player_name_as_entered, created_at)
    VALUES (
      r->>'id', p_match_id, r->>'playerId', r->>'playerNameAsEntered',
      COALESCE((r->>'createdAt')::timestamptz, NOW())
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_stat_event(p_pin TEXT, p_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  DELETE FROM public.stat_events WHERE id = p_id;
END;
$$;

-- Só para semear/restaurar dados de exemplo (peladas já FINALIZADAS): grava um
-- gol/assistência ignorando a regra "só em pelada em andamento", já que aqui
-- quem está autorizando é o PIN de Admin, não um participante ao vivo.
CREATE OR REPLACE FUNCTION admin_insert_stat_event(
  p_pin TEXT, p_id TEXT, p_match_id TEXT, p_player_id TEXT, p_type stat_event_type_enum,
  p_created_by TEXT, p_created_at TIMESTAMPTZ
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  INSERT INTO public.stat_events (id, match_id, player_id, type, created_by, created_at)
  VALUES (p_id, p_match_id, p_player_id, p_type, p_created_by, COALESCE(p_created_at, NOW()))
  ON CONFLICT (id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION admin_insert_audit_log(
  p_pin TEXT, p_id TEXT, p_match_id TEXT, p_action TEXT, p_details TEXT, p_performed_by TEXT, p_created_at TIMESTAMPTZ
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  INSERT INTO public.audit_logs (id, match_id, action, details, performed_by, created_at)
  VALUES (p_id, p_match_id, p_action, p_details, p_performed_by, COALESCE(p_created_at, NOW()));
END;
$$;

-- Cria/atualiza as configurações do grupo. Se a linha ainda não existir
-- (projeto novo), aceita qualquer PIN e cria a linha (bootstrap). Se já
-- existir, exige que p_pin bata com o PIN atual. p_new_pin é opcional (só
-- enviado quando o Admin está trocando o PIN). Retorna FALSE se o PIN
-- informado estiver errado (linha já existente), sem alterar nada.
CREATE OR REPLACE FUNCTION admin_upsert_settings(
  p_pin TEXT, p_pelada_name TEXT, p_logo_url TEXT, p_venue_name TEXT, p_new_pin TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_pin TEXT;
BEGIN
  SELECT admin_pin INTO v_current_pin FROM public.pelada_settings WHERE id = 'default';

  IF v_current_pin IS NOT NULL AND v_current_pin <> p_pin THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.pelada_settings (id, pelada_name, logo_url, admin_pin, venue_name, updated_at)
  VALUES (
    'default', p_pelada_name, p_logo_url,
    COALESCE(NULLIF(p_new_pin, ''), COALESCE(v_current_pin, '1234')),
    p_venue_name, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    pelada_name = EXCLUDED.pelada_name,
    logo_url = EXCLUDED.logo_url,
    admin_pin = EXCLUDED.admin_pin,
    venue_name = EXCLUDED.venue_name,
    updated_at = NOW();

  RETURN TRUE;
END;
$$;

-- Apaga todos os dados de jogadores/peladas/lançamentos/logs (usado só pelo
-- botão "Restaurar Dados Iniciais" do Admin). Não mexe em pelada_settings —
-- nome do grupo, logo e PIN continuam os mesmos depois de um reset.
CREATE OR REPLACE FUNCTION admin_wipe_all(p_pin TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  -- "WHERE true" satisfaz a proteção do Supabase contra DELETE sem WHERE.
  DELETE FROM public.stat_events WHERE true;
  DELETE FROM public.match_players WHERE true;
  DELETE FROM public.audit_logs WHERE true;
  DELETE FROM public.matches WHERE true;
  DELETE FROM public.players WHERE true;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_admin_pin(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_player(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_match(TEXT, TEXT, DATE, TIME, match_status_enum, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_match(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_replace_match_players(TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_stat_event(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_insert_stat_event(TEXT, TEXT, TEXT, TEXT, stat_event_type_enum, TEXT, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_insert_audit_log(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_settings(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_wipe_all(TEXT) TO anon, authenticated;

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
