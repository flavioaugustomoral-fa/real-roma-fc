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
DROP TABLE IF EXISTS public.games CASCADE;
DROP TABLE IF EXISTS public.match_players CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.pelada_settings CASCADE;
DROP TABLE IF EXISTS public.seasons CASCADE;
DROP TABLE IF EXISTS public.season_stat_adjustments CASCADE;
DROP TYPE IF EXISTS match_status_enum CASCADE;
DROP TYPE IF EXISTS stat_event_type_enum CASCADE;
DROP FUNCTION IF EXISTS check_admin_pin(TEXT);
DROP FUNCTION IF EXISTS verify_admin_pin(TEXT);
DROP FUNCTION IF EXISTS admin_upsert_player(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS admin_upsert_match(TEXT, TEXT, DATE, TIME, match_status_enum, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS admin_upsert_match(TEXT, TEXT, DATE, TIME, match_status_enum, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_delete_match(TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_upsert_match_player(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS admin_replace_match_players(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS admin_delete_stat_event(TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_insert_stat_event(TEXT, TEXT, TEXT, TEXT, stat_event_type_enum, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS admin_add_stat_event(TEXT, TEXT, TEXT, TEXT, stat_event_type_enum, TEXT);
DROP FUNCTION IF EXISTS admin_add_stat_event(TEXT, TEXT, TEXT, TEXT, stat_event_type_enum, TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_rename_player(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_create_team(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS admin_delete_team(TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_set_team_roster(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS admin_create_game(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS admin_delete_game(TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_insert_audit_log(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS admin_upsert_settings(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_upsert_settings(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS admin_wipe_all(TEXT);
DROP FUNCTION IF EXISTS admin_create_season(TEXT, TEXT, TEXT, DATE, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS admin_finalize_season(TEXT, DATE, TEXT, DATE, TEXT);
DROP FUNCTION IF EXISTS admin_rename_season(TEXT, TEXT, TEXT);

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
  notes TEXT,
  mvp_player_id TEXT REFERENCES public.players(id)
);

CREATE INDEX IF NOT EXISTS idx_matches_date ON public.matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);

-- 4. Tabela: teams (times avulsos, montados dentro de uma rodada)
CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_match ON public.teams(match_id);

-- 5. Tabela: match_players (participações oficiais daquela pelada). team_id
-- fica nulo nas rodadas antigas (sem times) — o app trata isso como o modo
-- "clássico" da tela da rodada.
CREATE TABLE IF NOT EXISTS public.match_players (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  player_name_as_entered TEXT NOT NULL,
  team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_player_per_match UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_players_match ON public.match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player ON public.match_players(player_id);
CREATE INDEX IF NOT EXISTS idx_match_players_team ON public.match_players(team_id);

-- 6. Tabela: games ("partidas" — confronto entre 2 times de uma mesma rodada)
CREATE TABLE IF NOT EXISTS public.games (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_a_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_b_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT games_teams_different CHECK (team_a_id <> team_b_id)
);

CREATE INDEX IF NOT EXISTS idx_games_match ON public.games(match_id);

-- 7. Tabela: stat_events (lançamentos individuais de gols e assistências).
-- game_id fica nulo nos lançamentos de rodadas antigas (modo clássico, sem
-- partida específica).
DO $$ BEGIN
  CREATE TYPE stat_event_type_enum AS ENUM ('GOAL', 'ASSIST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.stat_events (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  game_id TEXT REFERENCES public.games(id) ON DELETE CASCADE,
  type stat_event_type_enum NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'Participante',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stat_events_match ON public.stat_events(match_id);
CREATE INDEX IF NOT EXISTS idx_stat_events_player_type ON public.stat_events(player_id, type);
CREATE INDEX IF NOT EXISTS idx_stat_events_game ON public.stat_events(game_id);

-- 8. Tabela: audit_logs (registro de ações administrativas)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  match_id TEXT REFERENCES public.matches(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Tabela: pelada_settings (configurações compartilhadas do grupo - linha única)
CREATE TABLE IF NOT EXISTS public.pelada_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  pelada_name TEXT NOT NULL DEFAULT 'Pelada dos Amigos',
  logo_url TEXT,
  admin_pin TEXT NOT NULL DEFAULT '1234',
  venue_name TEXT,
  instagram_handle TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Tabela: seasons (temporada sem prazo fixo — o Admin finaliza quando
-- quiser; end_date NULL identifica a temporada aberta/atual). Uma rodada
-- pertence à temporada cujo intervalo [start_date, end_date] contém sua data.
CREATE TABLE IF NOT EXISTS public.seasons (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garante no máximo 1 temporada aberta (end_date NULL) por vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_single_open
  ON public.seasons ((end_date IS NULL)) WHERE end_date IS NULL;

-- 11. Tabela: season_stat_adjustments (ajuste manual único de gols/
-- assistências de antes do app existir — época da folha de papel, sem
-- rodada associada. Some ao total de gols/assistências da temporada; por
-- não ter rodada real por trás, a média e a contagem de rodadas daquela
-- temporada são zeradas pra todo mundo no app, ver getRankings/
-- getPlayerSummary. Sem tela de admin — inserido/editado direto por SQL,
-- sob pedido pontual do organizador.)
CREATE TABLE IF NOT EXISTS public.season_stat_adjustments (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  goals_offset INTEGER NOT NULL DEFAULT 0,
  assists_offset INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_season_adjustment_per_player UNIQUE (season_id, player_id)
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
-- Leitura pública via chave anônima. TODA escrita (inclusive lançar gol/
-- assistência) exige o PIN de Admin e passa pelas funções admin_* mais
-- abaixo, que conferem o PIN dentro do próprio banco antes de gravar. O
-- cliente nunca escreve direto nas tabelas.
-- ==============================================================================

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pelada_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_stat_adjustments ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Leitura publica teams" ON public.teams;
CREATE POLICY "Leitura publica teams" ON public.teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura publica games" ON public.games;
CREATE POLICY "Leitura publica games" ON public.games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura publica seasons" ON public.seasons;
CREATE POLICY "Leitura publica seasons" ON public.seasons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura publica season_stat_adjustments" ON public.season_stat_adjustments;
CREATE POLICY "Leitura publica season_stat_adjustments" ON public.season_stat_adjustments FOR SELECT USING (true);

-- stat_events: nenhuma escrita pública. Lançar gol/assistência exige o PIN
-- de Admin e passa por admin_add_stat_event() (só funciona com a pelada EM
-- ANDAMENTO); correções passam por admin_delete_stat_event().
DROP POLICY IF EXISTS "Insercao apenas em pelada em andamento" ON public.stat_events;

-- pelada_settings: esconde a coluna admin_pin de qualquer leitura via API,
-- mesmo com a policy de SELECT acima liberada. Um "select *" do cliente falha
-- se tentar ler admin_pin; por isso o app só faz select das colunas liberadas.
REVOKE ALL ON public.pelada_settings FROM anon, authenticated;
GRANT SELECT (id, pelada_name, logo_url, venue_name, instagram_handle, updated_at) ON public.pelada_settings TO anon, authenticated;

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

-- Renomeia um jogador. Se o novo nome (já normalizado pelo cliente, mesma
-- regra usada em toda a normalização do app) bater com o de outro jogador já
-- existente, em vez de criar uma duplicata o jogador editado é MESCLADO no
-- já existente: suas participações (match_players) e lançamentos
-- (stat_events) passam a apontar para o jogador de destino, e o registro
-- editado é apagado. Se, por acidente, o jogador editado já participava da
-- MESMA pelada que o de destino, essa participação duplicada é descartada
-- (não dá pra reaproveitar as duas). Retorna qual foi o resultado para o
-- cliente atualizar o estado local de acordo.
CREATE OR REPLACE FUNCTION admin_rename_player(
  p_pin TEXT, p_player_id TEXT, p_new_display_name TEXT, p_new_normalized_name TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target_id TEXT;
BEGIN
  PERFORM check_admin_pin(p_pin);

  SELECT id INTO v_target_id FROM public.players
  WHERE normalized_name = p_new_normalized_name AND id <> p_player_id;

  IF v_target_id IS NULL THEN
    UPDATE public.players
    SET display_name = p_new_display_name, normalized_name = p_new_normalized_name
    WHERE id = p_player_id;
    RETURN jsonb_build_object('merged', false, 'targetPlayerId', p_player_id);
  END IF;

  UPDATE public.match_players mp
  SET player_id = v_target_id
  WHERE mp.player_id = p_player_id
    AND NOT EXISTS (
      SELECT 1 FROM public.match_players mp2
      WHERE mp2.match_id = mp.match_id AND mp2.player_id = v_target_id
    );
  -- Sobra alguma linha ainda apontando pro jogador antigo só quando havia
  -- participação duplicada na mesma pelada — descarta.
  DELETE FROM public.match_players WHERE player_id = p_player_id;

  UPDATE public.stat_events SET player_id = v_target_id WHERE player_id = p_player_id;

  DELETE FROM public.players WHERE id = p_player_id;

  RETURN jsonb_build_object('merged', true, 'targetPlayerId', v_target_id);
END;
$$;

CREATE OR REPLACE FUNCTION admin_upsert_match(
  p_pin TEXT, p_id TEXT, p_date DATE, p_time TIME, p_status match_status_enum,
  p_created_by TEXT, p_finalized_by TEXT, p_created_at TIMESTAMPTZ, p_finalized_at TIMESTAMPTZ, p_notes TEXT,
  p_mvp_player_id TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  INSERT INTO public.matches (id, date, time, status, created_by, finalized_by, created_at, finalized_at, notes, mvp_player_id)
  VALUES (p_id, p_date, p_time, p_status, p_created_by, p_finalized_by, COALESCE(p_created_at, NOW()), p_finalized_at, p_notes, p_mvp_player_id)
  ON CONFLICT (id) DO UPDATE SET
    date = EXCLUDED.date,
    time = EXCLUDED.time,
    status = EXCLUDED.status,
    created_by = EXCLUDED.created_by,
    finalized_by = EXCLUDED.finalized_by,
    finalized_at = EXCLUDED.finalized_at,
    notes = EXCLUDED.notes,
    mvp_player_id = EXCLUDED.mvp_player_id;
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
-- Só serve pro modo clássico (sem times) — rodadas com times usam
-- admin_set_team_roster() por time.
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

-- Cria (ou renomeia) um time dentro de uma rodada.
CREATE OR REPLACE FUNCTION admin_create_team(p_pin TEXT, p_id TEXT, p_match_id TEXT, p_name TEXT, p_created_at TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  INSERT INTO public.teams (id, match_id, name, created_at)
  VALUES (p_id, p_match_id, p_name, COALESCE(p_created_at, NOW()))
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
END;
$$;

-- Exclui um time e, junto, a participação dos jogadores que estavam nele
-- (um time sem dono não faz sentido nesse modelo). Partidas que envolviam
-- esse time são excluídas em cascata (FK team_a_id/team_b_id), e os
-- lançamentos dessas partidas também (FK game_id em stat_events).
CREATE OR REPLACE FUNCTION admin_delete_team(p_pin TEXT, p_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  DELETE FROM public.match_players WHERE team_id = p_id;
  DELETE FROM public.teams WHERE id = p_id;
END;
$$;

-- Substitui o elenco de UM time (apaga e reinsere), mesmo padrão de
-- admin_replace_match_players só que restrito a um team_id.
CREATE OR REPLACE FUNCTION admin_set_team_roster(p_pin TEXT, p_team_id TEXT, p_match_id TEXT, p_rows JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r JSONB;
BEGIN
  PERFORM check_admin_pin(p_pin);
  DELETE FROM public.match_players WHERE team_id = p_team_id;
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO public.match_players (id, match_id, player_id, player_name_as_entered, team_id, created_at)
    VALUES (
      r->>'id', p_match_id, r->>'playerId', r->>'playerNameAsEntered', p_team_id,
      COALESCE((r->>'createdAt')::timestamptz, NOW())
    );
  END LOOP;
END;
$$;

-- Semeia a primeira temporada (só usado na semeadura inicial de um projeto
-- Supabase vazio). Trocas de temporada depois disso passam por
-- admin_finalize_season, que fecha a atual e abre a próxima numa transação só.
CREATE OR REPLACE FUNCTION admin_create_season(p_pin TEXT, p_id TEXT, p_label TEXT, p_start_date DATE, p_created_at TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  INSERT INTO public.seasons (id, label, start_date, end_date, created_at)
  VALUES (p_id, p_label, p_start_date, NULL, COALESCE(p_created_at, NOW()))
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, start_date = EXCLUDED.start_date;
END;
$$;

-- Fecha a temporada aberta (end_date = p_end_date) e já cria a próxima,
-- aberta (end_date NULL), em uma única chamada — sem prazo fixo, o Admin
-- decide quando finalizar.
CREATE OR REPLACE FUNCTION admin_finalize_season(p_pin TEXT, p_end_date DATE, p_new_id TEXT, p_new_start_date DATE, p_new_label TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  UPDATE public.seasons SET end_date = p_end_date WHERE end_date IS NULL;
  INSERT INTO public.seasons (id, label, start_date, end_date, created_at)
  VALUES (p_new_id, p_new_label, p_new_start_date, NULL, NOW());
END;
$$;

-- Renomeia uma temporada (atual ou já encerrada) — só o rótulo.
CREATE OR REPLACE FUNCTION admin_rename_season(p_pin TEXT, p_id TEXT, p_label TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  UPDATE public.seasons SET label = p_label WHERE id = p_id;
END;
$$;

-- Cria uma partida (confronto entre 2 times da MESMA rodada).
CREATE OR REPLACE FUNCTION admin_create_game(
  p_pin TEXT, p_id TEXT, p_match_id TEXT, p_team_a_id TEXT, p_team_b_id TEXT, p_created_at TIMESTAMPTZ
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  IF p_team_a_id = p_team_b_id THEN
    RAISE EXCEPTION 'Os dois times da partida precisam ser diferentes' USING ERRCODE = '22000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_a_id AND match_id = p_match_id)
     OR NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_b_id AND match_id = p_match_id) THEN
    RAISE EXCEPTION 'Os times precisam pertencer à mesma rodada' USING ERRCODE = '22000';
  END IF;
  INSERT INTO public.games (id, match_id, team_a_id, team_b_id, created_at)
  VALUES (p_id, p_match_id, p_team_a_id, p_team_b_id, COALESCE(p_created_at, NOW()));
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_game(p_pin TEXT, p_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  DELETE FROM public.games WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_stat_event(p_pin TEXT, p_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM check_admin_pin(p_pin);
  DELETE FROM public.stat_events WHERE id = p_id;
END;
$$;

-- Lança gol/assistência ao vivo. Só funciona com PIN correto E a rodada
-- realmente EM ANDAMENTO (diferente de admin_insert_stat_event, que é só
-- para semear/restaurar rodadas já finalizadas). p_game_id é opcional: nulo
-- no modo clássico (rodada sem times); quando informado, confere que o
-- jogador realmente pertence a um dos 2 times daquela partida.
CREATE OR REPLACE FUNCTION admin_add_stat_event(
  p_pin TEXT, p_id TEXT, p_match_id TEXT, p_player_id TEXT, p_type stat_event_type_enum, p_created_by TEXT,
  p_game_id TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_a TEXT;
  v_team_b TEXT;
  v_player_team TEXT;
BEGIN
  PERFORM check_admin_pin(p_pin);
  IF NOT EXISTS (SELECT 1 FROM public.matches WHERE id = p_match_id AND status = 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'A rodada não está em andamento' USING ERRCODE = '22000';
  END IF;

  IF p_game_id IS NOT NULL THEN
    SELECT team_a_id, team_b_id INTO v_team_a, v_team_b
    FROM public.games WHERE id = p_game_id AND match_id = p_match_id;

    IF v_team_a IS NULL THEN
      RAISE EXCEPTION 'Partida não encontrada nesta rodada' USING ERRCODE = '22000';
    END IF;

    SELECT team_id INTO v_player_team
    FROM public.match_players WHERE match_id = p_match_id AND player_id = p_player_id;

    IF v_player_team IS NULL OR v_player_team NOT IN (v_team_a, v_team_b) THEN
      RAISE EXCEPTION 'Jogador não pertence a nenhum dos times desta partida' USING ERRCODE = '22000';
    END IF;
  END IF;

  INSERT INTO public.stat_events (id, match_id, player_id, type, created_by, created_at, game_id)
  VALUES (p_id, p_match_id, p_player_id, p_type, p_created_by, NOW(), p_game_id);
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
  p_pin TEXT, p_pelada_name TEXT, p_logo_url TEXT, p_venue_name TEXT, p_new_pin TEXT DEFAULT NULL,
  p_instagram_handle TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_pin TEXT;
BEGIN
  SELECT admin_pin INTO v_current_pin FROM public.pelada_settings WHERE id = 'default';

  IF v_current_pin IS NOT NULL AND v_current_pin <> p_pin THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.pelada_settings (id, pelada_name, logo_url, admin_pin, venue_name, instagram_handle, updated_at)
  VALUES (
    'default', p_pelada_name, p_logo_url,
    COALESCE(NULLIF(p_new_pin, ''), COALESCE(v_current_pin, '1234')),
    p_venue_name, NULLIF(p_instagram_handle, ''), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    pelada_name = EXCLUDED.pelada_name,
    logo_url = EXCLUDED.logo_url,
    admin_pin = EXCLUDED.admin_pin,
    venue_name = EXCLUDED.venue_name,
    instagram_handle = EXCLUDED.instagram_handle,
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
  DELETE FROM public.seasons WHERE true;
  DELETE FROM public.season_stat_adjustments WHERE true;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_admin_pin(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_player(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_rename_player(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_match(TEXT, TEXT, DATE, TIME, match_status_enum, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_match(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_replace_match_players(TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_team(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_team(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_set_team_roster(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_game(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_game(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_stat_event(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_add_stat_event(TEXT, TEXT, TEXT, TEXT, stat_event_type_enum, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_insert_stat_event(TEXT, TEXT, TEXT, TEXT, stat_event_type_enum, TEXT, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_insert_audit_log(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_settings(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_wipe_all(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_season(TEXT, TEXT, TEXT, DATE, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_finalize_season(TEXT, DATE, TEXT, DATE, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_rename_season(TEXT, TEXT, TEXT) TO anon, authenticated;

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
  ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.match_players;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stat_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pelada_settings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.seasons;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.season_stat_adjustments;
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
