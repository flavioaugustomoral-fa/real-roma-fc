import { createClient } from '@supabase/supabase-js';
import {
  AuditLog,
  Match,
  MatchPlayer,
  PeladaSettings,
  Player,
  StatEvent,
} from '../types/pelada';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

const SETTINGS_ROW_ID = 'default';

// ------------------------------------------------------------------
// Mapping helpers: app uses camelCase, Postgres columns use snake_case
// ------------------------------------------------------------------

function playerFromDb(row: any): Player {
  return {
    id: row.id,
    displayName: row.display_name,
    normalizedName: row.normalized_name,
    createdAt: row.created_at,
  };
}

function matchFromDb(row: any): Match {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    status: row.status,
    createdBy: row.created_by,
    finalizedBy: row.finalized_by,
    createdAt: row.created_at,
    finalizedAt: row.finalized_at,
    notes: row.notes,
  };
}

function matchPlayerFromDb(row: any): MatchPlayer {
  return {
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id,
    playerNameAsEntered: row.player_name_as_entered,
    createdAt: row.created_at,
  };
}

function statEventFromDb(row: any): StatEvent {
  return {
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id,
    type: row.type,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function auditLogFromDb(row: any): AuditLog {
  return {
    id: row.id,
    matchId: row.match_id,
    action: row.action,
    details: row.details,
    performedBy: row.performed_by,
    createdAt: row.created_at,
  };
}

// pelada_settings.admin_pin nunca é lido pelo cliente (nem a coluna é
// liberada para leitura via API — ver GRANT no schema). O login de Admin é
// verificado inteiramente dentro do banco, através de verifyAdminPinRemote().
// Por isso este tipo de retorno NÃO tem adminPin — o cache local desse campo
// (usado só como PIN de "bootstrap" na primeira semeadura de um projeto novo)
// nunca deve ser sobrescrito por um valor vindo do servidor.
export type RemoteSettings = Omit<PeladaSettings, 'adminPin'>;

function settingsFromDb(row: any): RemoteSettings {
  return {
    peladaName: row.pelada_name,
    logoUrl: row.logo_url,
    venueName: row.venue_name,
  };
}

// ------------------------------------------------------------------
// Full dataset fetch (used on startup and after realtime notifications)
// ------------------------------------------------------------------

export interface RemoteData {
  players: Player[];
  matches: Match[];
  matchPlayers: MatchPlayer[];
  statEvents: StatEvent[];
  auditLogs: AuditLog[];
  settings: RemoteSettings | null;
}

export async function fetchAllRemoteData(): Promise<RemoteData | null> {
  if (!supabase) return null;
  try {
    const [playersRes, matchesRes, matchPlayersRes, statEventsRes, auditLogsRes, settingsRes] = await Promise.all([
      supabase.from('players').select('*'),
      supabase.from('matches').select('*'),
      supabase.from('match_players').select('*'),
      supabase.from('stat_events').select('*'),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('pelada_settings').select('id, pelada_name, logo_url, venue_name, updated_at').eq('id', SETTINGS_ROW_ID).maybeSingle(),
    ]);

    if (playersRes.error) throw playersRes.error;
    if (matchesRes.error) throw matchesRes.error;
    if (matchPlayersRes.error) throw matchPlayersRes.error;
    if (statEventsRes.error) throw statEventsRes.error;

    return {
      players: (playersRes.data || []).map(playerFromDb),
      matches: (matchesRes.data || []).map(matchFromDb),
      matchPlayers: (matchPlayersRes.data || []).map(matchPlayerFromDb),
      statEvents: (statEventsRes.data || []).map(statEventFromDb),
      auditLogs: (auditLogsRes.data || []).map(auditLogFromDb),
      settings: settingsRes.data ? settingsFromDb(settingsRes.data) : null,
    };
  } catch (error) {
    console.error('Erro ao carregar dados do Supabase:', error);
    return null;
  }
}

// ------------------------------------------------------------------
// Login de Admin: verificado inteiramente dentro do banco (função
// verify_admin_pin). O PIN nunca é lido de volta pelo cliente.
// ------------------------------------------------------------------

export async function verifyAdminPinRemote(pin: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('verify_admin_pin', { p_pin: pin });
  if (error) {
    console.error('Erro ao verificar PIN no Supabase:', error);
    return false;
  }
  return data === true;
}

// ------------------------------------------------------------------
// Escritas de Admin: todas passam por funções SECURITY DEFINER que conferem
// o PIN dentro do próprio banco (o cliente nunca escreve direto nessas
// tabelas). `pin` é o PIN da sessão de Admin atual, guardado só em memória/
// sessionStorage no navegador (ver storage.ts).
// ------------------------------------------------------------------

export async function pushPlayer(p: Player, pin: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('admin_upsert_player', {
    p_pin: pin,
    p_id: p.id,
    p_display_name: p.displayName,
    p_normalized_name: p.normalizedName,
    p_created_at: p.createdAt,
  });
  if (error) console.error('Erro ao salvar jogador no Supabase:', error);
}

export async function pushMatch(m: Match, pin: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('admin_upsert_match', {
    p_pin: pin,
    p_id: m.id,
    p_date: m.date,
    p_time: m.time || null,
    p_status: m.status,
    p_created_by: m.createdBy,
    p_finalized_by: m.finalizedBy || null,
    p_created_at: m.createdAt,
    p_finalized_at: m.finalizedAt || null,
    p_notes: m.notes || null,
  });
  if (error) console.error('Erro ao salvar pelada no Supabase:', error);
}

export async function deleteRemoteMatch(matchId: string, pin: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('admin_delete_match', { p_pin: pin, p_id: matchId });
  if (error) console.error('Erro ao excluir pelada no Supabase:', error);
}

// Grava a lista de participantes de uma pelada nova (não existe nenhuma linha
// ainda, então "substituir" e "inserir pela primeira vez" são a mesma coisa).
export async function pushMatchPlayers(list: MatchPlayer[], pin: string) {
  if (!supabase || list.length === 0) return;
  const matchId = list[0].matchId;
  await replaceMatchPlayers(matchId, list, pin);
}

export async function replaceMatchPlayers(matchId: string, list: MatchPlayer[], pin: string) {
  if (!supabase) return;
  const rows = list.map(mp => ({
    id: mp.id,
    playerId: mp.playerId,
    playerNameAsEntered: mp.playerNameAsEntered,
    createdAt: mp.createdAt,
  }));
  const { error } = await supabase.rpc('admin_replace_match_players', {
    p_pin: pin,
    p_match_id: matchId,
    p_rows: rows,
  });
  if (error) console.error('Erro ao salvar participantes no Supabase:', error);
}

// Lançar gol/assistência continua público (qualquer participante, sem PIN) —
// o banco só aceita enquanto a pelada estiver EM ANDAMENTO (ver RLS).
export async function pushStatEvent(ev: StatEvent) {
  if (!supabase) return;
  const { error } = await supabase.from('stat_events').insert({
    id: ev.id,
    match_id: ev.matchId,
    player_id: ev.playerId,
    type: ev.type,
    created_by: ev.createdBy,
    created_at: ev.createdAt,
  });
  if (error) console.error('Erro ao salvar lançamento no Supabase:', error);
}

export async function deleteRemoteStatEvent(eventId: string, pin: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('admin_delete_stat_event', { p_pin: pin, p_id: eventId });
  if (error) console.error('Erro ao excluir lançamento no Supabase:', error);
}

export async function pushAuditLog(log: AuditLog, pin: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('admin_insert_audit_log', {
    p_pin: pin,
    p_id: log.id,
    p_match_id: log.matchId || null,
    p_action: log.action,
    p_details: log.details,
    p_performed_by: log.performedBy,
    p_created_at: log.createdAt,
  });
  if (error) console.error('Erro ao salvar log no Supabase:', error);
}

// Retorna false quando o PIN informado está errado (o app deve tratar isso
// como falha de autenticação, não como erro de rede).
export async function pushSettings(s: PeladaSettings, pin: string, newPin?: string): Promise<boolean> {
  if (!supabase) return true;
  const { data, error } = await supabase.rpc('admin_upsert_settings', {
    p_pin: pin,
    p_pelada_name: s.peladaName,
    p_logo_url: s.logoUrl || null,
    p_venue_name: s.venueName || null,
    p_new_pin: newPin || null,
  });
  if (error) {
    console.error('Erro ao salvar configurações no Supabase:', error);
    return false;
  }
  return data === true;
}

export async function wipeRemoteData(pin: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('admin_wipe_all', { p_pin: pin });
  if (error) console.error('Erro ao apagar dados no Supabase:', error);
}

// Usado (a) na primeira vez que o app fala com um projeto Supabase vazio, pra
// semear com os dados locais, e (b) por "Restaurar Dados Iniciais" no Admin.
// `includeSettings` fica false no caso (b): um reset de dados não deve mexer
// no nome do grupo/logo/PIN já configurados.
export async function pushFullSnapshot(
  data: {
    players: Player[];
    matches: Match[];
    matchPlayers: MatchPlayer[];
    statEvents: StatEvent[];
    auditLogs: AuditLog[];
    settings: PeladaSettings;
  },
  pin: string,
  includeSettings: boolean = true
) {
  if (!supabase) return;
  try {
    if (includeSettings) {
      await pushSettings(data.settings, pin);
    }
    for (const p of data.players) {
      await pushPlayer(p, pin);
    }
    for (const m of data.matches) {
      await pushMatch(m, pin);
    }
    const byMatch = new Map<string, MatchPlayer[]>();
    for (const mp of data.matchPlayers) {
      const arr = byMatch.get(mp.matchId) || [];
      arr.push(mp);
      byMatch.set(mp.matchId, arr);
    }
    for (const [matchId, rows] of byMatch) {
      await replaceMatchPlayers(matchId, rows, pin);
    }
    for (const ev of data.statEvents) {
      const { error } = await supabase.rpc('admin_insert_stat_event', {
        p_pin: pin,
        p_id: ev.id,
        p_match_id: ev.matchId,
        p_player_id: ev.playerId,
        p_type: ev.type,
        p_created_by: ev.createdBy,
        p_created_at: ev.createdAt,
      });
      if (error) console.error('Erro ao semear lançamento no Supabase:', error);
    }
    for (const log of data.auditLogs) {
      await pushAuditLog(log, pin);
    }
  } catch (error) {
    console.error('Erro ao enviar snapshot inicial para o Supabase:', error);
  }
}

// ------------------------------------------------------------------
// Realtime: notify the store whenever another client changes shared data
// ------------------------------------------------------------------

export function subscribeToRemoteChanges(onChange: () => void): () => void {
  if (!supabase) return () => {};

  const channel = supabase
    .channel('pelada-shared-data')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pelada_settings' }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
