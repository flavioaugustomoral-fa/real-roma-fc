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

function playerToDb(p: Player) {
  return {
    id: p.id,
    display_name: p.displayName,
    normalized_name: p.normalizedName,
    created_at: p.createdAt,
  };
}
function playerFromDb(row: any): Player {
  return {
    id: row.id,
    displayName: row.display_name,
    normalizedName: row.normalized_name,
    createdAt: row.created_at,
  };
}

function matchToDb(m: Match) {
  return {
    id: m.id,
    date: m.date,
    time: m.time || null,
    status: m.status,
    created_by: m.createdBy,
    finalized_by: m.finalizedBy || null,
    created_at: m.createdAt,
    finalized_at: m.finalizedAt || null,
    notes: m.notes || null,
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

function matchPlayerToDb(mp: MatchPlayer) {
  return {
    id: mp.id,
    match_id: mp.matchId,
    player_id: mp.playerId,
    player_name_as_entered: mp.playerNameAsEntered,
    created_at: mp.createdAt,
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

function statEventToDb(ev: StatEvent) {
  return {
    id: ev.id,
    match_id: ev.matchId,
    player_id: ev.playerId,
    type: ev.type,
    created_by: ev.createdBy,
    created_at: ev.createdAt,
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

function auditLogToDb(a: AuditLog) {
  return {
    id: a.id,
    match_id: a.matchId || null,
    action: a.action,
    details: a.details,
    performed_by: a.performedBy,
    created_at: a.createdAt,
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

function settingsToDb(s: PeladaSettings) {
  return {
    id: SETTINGS_ROW_ID,
    pelada_name: s.peladaName,
    logo_url: s.logoUrl || null,
    admin_pin: s.adminPin,
    venue_name: s.venueName || null,
    updated_at: new Date().toISOString(),
  };
}
function settingsFromDb(row: any): PeladaSettings {
  return {
    peladaName: row.pelada_name,
    logoUrl: row.logo_url,
    adminPin: row.admin_pin,
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
  settings: PeladaSettings | null;
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
      supabase.from('pelada_settings').select('*').eq('id', SETTINGS_ROW_ID).maybeSingle(),
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
// Targeted writes (called by the store right after each local mutation)
// ------------------------------------------------------------------

export async function pushPlayer(p: Player) {
  if (!supabase) return;
  const { error } = await supabase.from('players').upsert(playerToDb(p), { onConflict: 'id' });
  if (error) console.error('Erro ao salvar jogador no Supabase:', error);
}

export async function pushMatch(m: Match) {
  if (!supabase) return;
  const { error } = await supabase.from('matches').upsert(matchToDb(m), { onConflict: 'id' });
  if (error) console.error('Erro ao salvar pelada no Supabase:', error);
}

export async function deleteRemoteMatch(matchId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  if (error) console.error('Erro ao excluir pelada no Supabase:', error);
}

export async function pushMatchPlayers(list: MatchPlayer[]) {
  if (!supabase || list.length === 0) return;
  const { error } = await supabase.from('match_players').upsert(list.map(matchPlayerToDb), { onConflict: 'id' });
  if (error) console.error('Erro ao salvar participantes no Supabase:', error);
}

export async function replaceMatchPlayers(matchId: string, list: MatchPlayer[]) {
  if (!supabase) return;
  const { error: delError } = await supabase.from('match_players').delete().eq('match_id', matchId);
  if (delError) console.error('Erro ao limpar participantes no Supabase:', delError);
  await pushMatchPlayers(list);
}

export async function pushStatEvent(ev: StatEvent) {
  if (!supabase) return;
  const { error } = await supabase.from('stat_events').upsert(statEventToDb(ev), { onConflict: 'id' });
  if (error) console.error('Erro ao salvar lançamento no Supabase:', error);
}

export async function deleteRemoteStatEvent(eventId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('stat_events').delete().eq('id', eventId);
  if (error) console.error('Erro ao excluir lançamento no Supabase:', error);
}

export async function pushAuditLog(log: AuditLog) {
  if (!supabase) return;
  const { error } = await supabase.from('audit_logs').insert(auditLogToDb(log));
  if (error) console.error('Erro ao salvar log no Supabase:', error);
}

export async function pushSettings(s: PeladaSettings) {
  if (!supabase) return;
  const { error } = await supabase.from('pelada_settings').upsert(settingsToDb(s), { onConflict: 'id' });
  if (error) console.error('Erro ao salvar configurações no Supabase:', error);
}

export async function wipeRemoteData() {
  if (!supabase) return;
  await supabase.from('stat_events').delete().neq('id', '__none__');
  await supabase.from('match_players').delete().neq('id', '__none__');
  await supabase.from('audit_logs').delete().neq('id', '__none__');
  await supabase.from('matches').delete().neq('id', '__none__');
  await supabase.from('players').delete().neq('id', '__none__');
}

export async function pushFullSnapshot(data: {
  players: Player[];
  matches: Match[];
  matchPlayers: MatchPlayer[];
  statEvents: StatEvent[];
  auditLogs: AuditLog[];
  settings: PeladaSettings;
}) {
  if (!supabase) return;
  try {
    if (data.players.length > 0) {
      await supabase.from('players').upsert(data.players.map(playerToDb), { onConflict: 'id' });
    }
    if (data.matches.length > 0) {
      await supabase.from('matches').upsert(data.matches.map(matchToDb), { onConflict: 'id' });
    }
    if (data.matchPlayers.length > 0) {
      await supabase.from('match_players').upsert(data.matchPlayers.map(matchPlayerToDb), { onConflict: 'id' });
    }
    if (data.statEvents.length > 0) {
      await supabase.from('stat_events').upsert(data.statEvents.map(statEventToDb), { onConflict: 'id' });
    }
    if (data.auditLogs.length > 0) {
      await supabase.from('audit_logs').upsert(data.auditLogs.map(auditLogToDb), { onConflict: 'id' });
    }
    await pushSettings(data.settings);
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
