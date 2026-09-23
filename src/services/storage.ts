import {
  AuditLog,
  Game,
  Match,
  MatchPlayer,
  PeladaSettings,
  Player,
  PlayerStatSummary,
  RankingItem,
  StatEvent,
  StatEventType,
  Team,
} from '../types/pelada';
import { formatDisplayName, normalizePlayerName, parsePlayerListInput } from '../utils/normalization';
import { DEFAULT_PELADA_LOGO } from '../assets/logo';
import {
  isSupabaseConfigured,
  fetchAllRemoteData,
  pushFullSnapshot,
  pushPlayer,
  renamePlayerRemote,
  pushMatch,
  deleteRemoteMatch,
  pushMatchPlayers,
  replaceMatchPlayers,
  pushStatEvent,
  deleteRemoteStatEvent,
  pushAuditLog,
  pushSettings,
  wipeRemoteData,
  subscribeToRemoteChanges,
  verifyAdminPinRemote,
  pushTeam,
  deleteRemoteTeam,
  setTeamRoster,
  pushGame,
  deleteRemoteGame,
} from './supabase';

const STORAGE_KEY = 'gestao_pelada_data_v1';

// PIN da sessão de Admin atual, guardado só em sessionStorage deste navegador
// (nunca em localStorage, nunca lido de volta do Supabase). É anexado às
// chamadas admin_* pra provar autorização a cada ação — ver src/services/supabase.ts.
const ADMIN_PIN_SESSION_KEY = 'pelada_admin_pin_session';

export function setSessionAdminPin(pin: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(ADMIN_PIN_SESSION_KEY, pin);
  }
}

export function clearSessionAdminPin(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ADMIN_PIN_SESSION_KEY);
  }
}

export interface StorageData {
  players: Player[];
  matches: Match[];
  teams: Team[];
  matchPlayers: MatchPlayer[];
  games: Game[];
  statEvents: StatEvent[];
  auditLogs: AuditLog[];
  settings: PeladaSettings;
}

// Generate IDs
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// Initial realistic seed data for the Pelada
function getInitialSeedData(): StorageData {
  const initialPlayerNames = [
    'João',
    'Pedro',
    'Carlos',
    'Lucas',
    'Rafael',
    'Marcelo',
    'André',
    'Bruno',
    'Felipe',
    'Marquinhos',
    'Rodrigo',
    'Thiago',
    'Gustavo',
    'Mateus',
    'Leandro',
    'Guilherme',
  ];

  const players: Player[] = initialPlayerNames.map((name, index) => ({
    id: `p_${index + 1}`,
    displayName: name,
    normalizedName: normalizePlayerName(name),
    createdAt: new Date('2026-08-01T10:00:00Z').toISOString(),
  }));

  const playerMap = new Map<string, Player>();
  players.forEach(p => playerMap.set(p.normalizedName, p));

  const matches: Match[] = [];
  const matchPlayers: MatchPlayer[] = [];
  const statEvents: StatEvent[] = [];
  const auditLogs: AuditLog[] = [];

  // Seed 4 historic finalized matches
  const matchSeeds = [
    {
      id: 'm_1',
      date: '2026-08-13',
      time: '19:30',
      status: 'FINALIZED' as const,
      players: ['João', 'Pedro', 'Carlos', 'Lucas', 'Rafael', 'Marcelo', 'André', 'Bruno', 'Felipe', 'Marquinhos', 'Rodrigo', 'Thiago'],
      goals: [
        { p: 'João', count: 3 },
        { p: 'Pedro', count: 2 },
        { p: 'Carlos', count: 2 },
        { p: 'Lucas', count: 1 },
        { p: 'Marcelo', count: 1 },
      ],
      assists: [
        { p: 'Pedro', count: 3 },
        { p: 'João', count: 1 },
        { p: 'André', count: 2 },
        { p: 'Carlos', count: 1 },
      ],
    },
    {
      id: 'm_2',
      date: '2026-08-20',
      time: '19:30',
      status: 'FINALIZED' as const,
      players: ['João', 'Pedro', 'Carlos', 'Lucas', 'Rafael', 'Marcelo', 'André', 'Bruno', 'Felipe', 'Marquinhos', 'Gustavo', 'Mateus'],
      goals: [
        { p: 'João', count: 4 },
        { p: 'Pedro', count: 1 },
        { p: 'Rafael', count: 2 },
        { p: 'Bruno', count: 1 },
        { p: 'Marquinhos', count: 1 },
      ],
      assists: [
        { p: 'Carlos', count: 2 },
        { p: 'João', count: 2 },
        { p: 'Pedro', count: 1 },
        { p: 'Lucas', count: 2 },
      ],
    },
    {
      id: 'm_3',
      date: '2026-08-27',
      time: '20:00',
      status: 'FINALIZED' as const,
      players: ['João', 'Pedro', 'Carlos', 'Lucas', 'Rafael', 'Marcelo', 'André', 'Bruno', 'Felipe', 'Marquinhos', 'Leandro', 'Guilherme'],
      goals: [
        { p: 'Pedro', count: 4 },
        { p: 'Carlos', count: 3 },
        { p: 'João', count: 2 },
        { p: 'André', count: 1 },
        { p: 'Felipe', count: 1 },
      ],
      assists: [
        { p: 'Pedro', count: 2 },
        { p: 'Marcelo', count: 3 },
        { p: 'Carlos', count: 1 },
        { p: 'João', count: 1 },
      ],
    },
    {
      id: 'm_4',
      date: '2026-09-03',
      time: '19:00',
      status: 'FINALIZED' as const,
      players: ['João', 'Pedro', 'Carlos', 'Lucas', 'Rafael', 'Marcelo', 'André', 'Bruno', 'Felipe', 'Marquinhos', 'Rodrigo', 'Gustavo'],
      goals: [
        { p: 'João', count: 3 },
        { p: 'Carlos', count: 2 },
        { p: 'Lucas', count: 2 },
        { p: 'Pedro', count: 1 },
        { p: 'Rafael', count: 1 },
      ],
      assists: [
        { p: 'Pedro', count: 3 },
        { p: 'Carlos', count: 2 },
        { p: 'André', count: 1 },
        { p: 'Marcelo', count: 1 },
      ],
    },
  ];

  matchSeeds.forEach(ms => {
    matches.push({
      id: ms.id,
      date: ms.date,
      time: ms.time,
      status: ms.status,
      createdBy: 'Administrador',
      finalizedBy: 'Administrador',
      createdAt: `${ms.date}T${ms.time}:00Z`,
      finalizedAt: `${ms.date}T21:15:00Z`,
      notes: 'Rodada oficial finalizada',
    });

    ms.players.forEach(pName => {
      const pl = playerMap.get(normalizePlayerName(pName));
      if (pl) {
        matchPlayers.push({
          id: generateId('mp'),
          matchId: ms.id,
          playerId: pl.id,
          playerNameAsEntered: pName,
          createdAt: `${ms.date}T${ms.time}:00Z`,
        });
      }
    });

    ms.goals.forEach(g => {
      const pl = playerMap.get(normalizePlayerName(g.p));
      if (pl) {
        for (let i = 0; i < g.count; i++) {
          statEvents.push({
            id: generateId('ev'),
            matchId: ms.id,
            playerId: pl.id,
            type: 'GOAL',
            createdBy: 'Participante',
            createdAt: `${ms.date}T19:${30 + i * 5}:00Z`,
          });
        }
      }
    });

    ms.assists.forEach(a => {
      const pl = playerMap.get(normalizePlayerName(a.p));
      if (pl) {
        for (let i = 0; i < a.count; i++) {
          statEvents.push({
            id: generateId('ev'),
            matchId: ms.id,
            playerId: pl.id,
            type: 'ASSIST',
            createdBy: 'Participante',
            createdAt: `${ms.date}T19:${32 + i * 5}:00Z`,
          });
        }
      }
    });

    auditLogs.push({
      id: generateId('aud'),
      matchId: ms.id,
      action: 'MATCH_FINALIZED',
      details: `Rodada de ${ms.date} finalizada oficialmente pelo Administrador.`,
      performedBy: 'Administrador',
      createdAt: `${ms.date}T21:15:00Z`,
    });
  });

  return {
    players,
    matches,
    teams: [],
    matchPlayers,
    games: [],
    statEvents,
    auditLogs,
    settings: {
      peladaName: 'Pelada do Real Roma F.C.',
      logoUrl: DEFAULT_PELADA_LOGO,
      adminPin: '1234',
      venueName: 'Arena Soccer Club',
    },
  };
}

class PeladaStore {
  private data: StorageData;
  private listeners: Array<() => void> = [];
  private applyingRemote = false;

  constructor() {
    this.data = this.loadData();
    if (typeof window !== 'undefined') {
      this.initRemote();
    }
  }

  // On startup: if Supabase is configured, adopt whatever the group already
  // has stored remotely (so every device converges on the same data), or, if
  // the Supabase project is brand new (never configured at all), seed it from
  // this device. A project that was already configured but had its data
  // wiped on purpose (players/matches empty) must NOT be re-seeded — that's
  // why this checks whether pelada_settings already exists, not whether
  // players/matches happen to be empty.
  // Then subscribe to realtime changes so other people's actions show up here.
  private async initRemote() {
    if (!isSupabaseConfigured()) return;
    try {
      const remote = await fetchAllRemoteData();
      if (!remote) return;

      const alreadyInitialized = remote.settings !== null;
      if (alreadyInitialized) {
        this.applyingRemote = true;
        this.data = {
          players: remote.players,
          matches: remote.matches,
          teams: remote.teams,
          matchPlayers: remote.matchPlayers,
          games: remote.games,
          statEvents: remote.statEvents,
          auditLogs: remote.auditLogs,
          settings: { ...this.data.settings, ...(remote.settings || {}) },
        };
        this.applyingRemote = false;
        this.persist(this.data);
      } else {
        // Projeto Supabase vazio: usa o PIN local (padrão "1234" na primeira
        // instalação) só para essa semeadura inicial única.
        await pushFullSnapshot(this.data, this.data.settings.adminPin);
      }
    } catch (err) {
      console.warn('Falha ao sincronizar com o Supabase, usando dados locais:', err);
    }

    subscribeToRemoteChanges(() => this.refreshFromRemote());
  }

  private async refreshFromRemote() {
    if (this.applyingRemote) return;
    const remote = await fetchAllRemoteData();
    if (!remote) return;
    this.applyingRemote = true;
    this.data = {
      players: remote.players,
      matches: remote.matches,
      teams: remote.teams,
      matchPlayers: remote.matchPlayers,
      games: remote.games,
      statEvents: remote.statEvents,
      auditLogs: remote.auditLogs,
      settings: { ...this.data.settings, ...(remote.settings || {}) },
    };
    this.applyingRemote = false;
    this.persist(this.data);
  }

  private getSessionPin(): string {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(ADMIN_PIN_SESSION_KEY) || '';
  }

  private loadData(): StorageData {
    if (typeof window === 'undefined') return getInitialSeedData();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.players) && Array.isArray(parsed.matches)) {
          let updated = false;
          // If stored logoUrl was old default svg or old path, migrate to DEFAULT_PELADA_LOGO
          if (!parsed.settings?.logoUrl || parsed.settings.logoUrl === '/logo-crest.svg' || parsed.settings.logoUrl === '/logo.png') {
            parsed.settings = { ...(parsed.settings || {}), logoUrl: DEFAULT_PELADA_LOGO };
            updated = true;
          }
          // Migrate default pelada name if it's the old default
          if (!parsed.settings?.peladaName || parsed.settings.peladaName === 'Pelada dos Amigos') {
            parsed.settings = { ...(parsed.settings || {}), peladaName: 'Pelada do Real Roma F.C.' };
            updated = true;
          }
          // Dados salvos antes dos Times/Partidas existirem não têm esses
          // arrays — preenche vazio (essas rodadas continuam no modo clássico).
          if (!Array.isArray(parsed.teams)) {
            parsed.teams = [];
            updated = true;
          }
          if (!Array.isArray(parsed.games)) {
            parsed.games = [];
            updated = true;
          }
          if (updated) {
            this.persist(parsed);
          }
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to load pelada storage, using seeds:', err);
    }
    const seed = getInitialSeedData();
    this.persist(seed);
    return seed;
  }

  private persist(data: StorageData) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        console.error('Failed to save to localStorage:', err);
      }
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  public getData(): StorageData {
    return this.data;
  }

  public getSettings(): PeladaSettings {
    return this.data.settings;
  }

  public updateSettings(settingsUpdate: Partial<PeladaSettings>): void {
    const newPin = settingsUpdate.adminPin;
    const pinForAuth = this.getSessionPin();
    // Não guarda o novo PIN localmente: quem manda no PIN é o banco.
    const { adminPin: _ignored, ...rest } = settingsUpdate;
    this.data.settings = { ...this.data.settings, ...rest };
    this.persist(this.data);
    pushSettings(this.data.settings, pinForAuth, newPin).then(ok => {
      if (ok && newPin) {
        setSessionAdminPin(newPin);
      } else if (!ok) {
        console.error('Não foi possível salvar as configurações: PIN de admin desatualizado.');
      }
    });
  }

  // Verifica o PIN direto no banco (a coluna admin_pin nunca é lida pelo
  // cliente). Em modo local puro (Supabase não configurado), compara com o
  // valor padrão salvo localmente.
  public async verifyAdminPin(pin: string): Promise<boolean> {
    const ok = isSupabaseConfigured()
      ? await verifyAdminPinRemote(pin)
      : this.data.settings.adminPin === pin;
    if (ok) {
      setSessionAdminPin(pin);
    }
    return ok;
  }

  // Find player by internal ID
  public getPlayerById(playerId: string): Player | undefined {
    return this.data.players.find(p => p.id === playerId);
  }

  // Find or create player automatically with normalized identification.
  // Does NOT push the new player remotely itself — the caller is responsible
  // for that (and must await it before linking the player to a match), since
  // match_players.player_id is a foreign key: if the insert races ahead of
  // the player upsert landing on the server, the whole match_players write
  // is rejected and the pelada ends up with zero participants.
  private findOrCreatePlayer(rawName: string): { player: Player; isNew: boolean } {
    const normalized = normalizePlayerName(rawName);
    const existing = this.data.players.find(p => p.normalizedName === normalized);
    if (existing) {
      return { player: existing, isNew: false };
    }
    const newPlayer: Player = {
      id: generateId('p'),
      displayName: formatDisplayName(rawName),
      normalizedName: normalized,
      createdAt: new Date().toISOString(),
    };
    this.data.players.push(newPlayer);
    return { player: newPlayer, isNew: true };
  }

  // Renomeia um jogador (correção de nome digitado errado, ex: "Vini Jr" ->
  // "Vinicius Jr"). Se o novo nome já pertencer a outro jogador cadastrado,
  // em vez de virar uma duplicata o jogador editado é mesclado no já
  // existente: participações e lançamentos de gol/assistência são somados
  // ao jogador de destino, e o registro editado deixa de existir.
  public async renamePlayer(
    playerId: string,
    newDisplayNameRaw: string,
    performedBy = 'Administrador'
  ): Promise<{ success: boolean; merged: boolean; targetDisplayName?: string; error?: string }> {
    const player = this.getPlayerById(playerId);
    if (!player) {
      return { success: false, merged: false, error: 'Jogador não encontrado.' };
    }

    const newDisplayName = formatDisplayName(newDisplayNameRaw);
    const newNormalizedName = normalizePlayerName(newDisplayNameRaw);
    if (!newNormalizedName) {
      return { success: false, merged: false, error: 'Informe um nome válido.' };
    }
    if (newNormalizedName === player.normalizedName) {
      return { success: false, merged: false, error: 'Esse já é o nome atual do jogador.' };
    }

    const pin = this.getSessionPin();
    let merged: boolean;
    let targetPlayerId: string;

    if (isSupabaseConfigured()) {
      const result = await renamePlayerRemote(playerId, newDisplayName, newNormalizedName, pin);
      if (!result) {
        return { success: false, merged: false, error: 'Não foi possível renomear. Confira se o PIN de Admin ainda é válido.' };
      }
      merged = result.merged;
      targetPlayerId = result.targetPlayerId;
    } else {
      const existingTarget = this.data.players.find(p => p.normalizedName === newNormalizedName && p.id !== playerId);
      merged = !!existingTarget;
      targetPlayerId = existingTarget?.id || playerId;
    }

    const oldDisplayName = player.displayName;

    if (!merged) {
      player.displayName = newDisplayName;
      player.normalizedName = newNormalizedName;
    } else {
      // Reatribui as participações desse jogador para o de destino, exceto
      // quando ele já participava da MESMA pelada — nesse caso a duplicata é
      // descartada (não dá pra reaproveitar as duas participações).
      const matchIdsForTarget = new Set(
        this.data.matchPlayers.filter(mp => mp.playerId === targetPlayerId).map(mp => mp.matchId)
      );
      this.data.matchPlayers = this.data.matchPlayers
        .filter(mp => mp.playerId !== playerId || !matchIdsForTarget.has(mp.matchId))
        .map(mp => (mp.playerId === playerId ? { ...mp, playerId: targetPlayerId } : mp));

      this.data.statEvents = this.data.statEvents.map(ev =>
        ev.playerId === playerId ? { ...ev, playerId: targetPlayerId } : ev
      );

      this.data.players = this.data.players.filter(p => p.id !== playerId);
    }

    const targetDisplayName = merged ? (this.getPlayerById(targetPlayerId)?.displayName || newDisplayName) : newDisplayName;

    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId: null,
      action: merged ? 'PLAYER_MERGED' : 'PLAYER_RENAMED',
      details: merged
        ? `Jogador "${oldDisplayName}" renomeado para "${newDisplayName}" — dados incorporados ao jogador já existente "${targetDisplayName}".`
        : `Jogador "${oldDisplayName}" renomeado para "${newDisplayName}".`,
      performedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    pushAuditLog(auditEntry, pin);

    return { success: true, merged, targetDisplayName };
  }

  // Create a new match (rodada). rawPlayerList é opcional agora: o fluxo
  // novo cria a rodada vazia e monta os times depois (createTeam). Se vier
  // preenchido (modo clássico), continua linkando a lista direto na rodada,
  // sem times — mantém compatibilidade com o fluxo antigo.
  public createMatch(params: {
    date: string;
    time?: string;
    rawPlayerList?: string;
    notes?: string;
    createdBy?: string;
    startImmediately?: boolean;
  }): { match: Match; count: number; error?: string } {
    const rawPlayerList = params.rawPlayerList || '';
    const parsed = parsePlayerListInput(rawPlayerList);

    if (rawPlayerList.trim() && parsed.duplicates.length > 0) {
      return {
        match: null as unknown as Match,
        count: 0,
        error: `Nomes duplicados detectados na lista: ${parsed.duplicates.join(', ')}. Remova as duplicidades antes de iniciar.`,
      };
    }

    const matchId = generateId('m');
    const newMatch: Match = {
      id: matchId,
      date: params.date,
      time: params.time || '19:00',
      status: params.startImmediately ? 'IN_PROGRESS' : 'DRAFT',
      createdBy: params.createdBy || 'Administrador',
      createdAt: new Date().toISOString(),
      finalizedAt: null,
      notes: params.notes || '',
    };

    this.data.matches.unshift(newMatch);

    // Link each player (só roda de fato quando rawPlayerList foi passado)
    const newMatchPlayers: MatchPlayer[] = [];
    const newPlayers: Player[] = [];
    parsed.parsedPlayers.forEach(item => {
      const { player, isNew } = this.findOrCreatePlayer(item.originalName);
      if (isNew) newPlayers.push(player);
      const mp: MatchPlayer = {
        id: generateId('mp'),
        matchId,
        playerId: player.id,
        playerNameAsEntered: item.originalName,
        createdAt: new Date().toISOString(),
      };
      this.data.matchPlayers.push(mp);
      newMatchPlayers.push(mp);
    });

    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId,
      action: 'MATCH_CREATED',
      details: parsed.parsedPlayers.length > 0
        ? `Rodada criada com ${parsed.parsedPlayers.length} jogadores para a data ${params.date}.`
        : `Rodada criada para a data ${params.date}.`,
      performedBy: params.createdBy || 'Administrador',
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    // Novos jogadores E a pelada precisam existir no banco antes de linkar os
    // participantes (match_players tem FK pra ambos) — por isso aguarda os
    // dois antes de mandar os participantes.
    Promise.all([pushMatch(newMatch, pin), ...newPlayers.map(p => pushPlayer(p, pin))])
      .then(() => (newMatchPlayers.length > 0 ? pushMatchPlayers(newMatchPlayers, pin) : Promise.resolve()))
      .then(() => pushAuditLog(auditEntry, pin));
    return { match: newMatch, count: parsed.parsedPlayers.length };
  }

  public startMatch(matchId: string, performedBy = 'Administrador'): void {
    const match = this.data.matches.find(m => m.id === matchId);
    if (!match) return;
    match.status = 'IN_PROGRESS';

    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId,
      action: 'MATCH_STARTED',
      details: 'Rodada iniciada. Lançamentos liberados para os participantes.',
      performedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    pushMatch(match, pin);
    pushAuditLog(auditEntry, pin);
  }

  public getActiveMatch(): Match | undefined {
    return this.data.matches.find(m => m.status === 'IN_PROGRESS') ||
      this.data.matches.find(m => m.status === 'DRAFT');
  }

  public getMatchById(matchId: string): Match | undefined {
    return this.data.matches.find(m => m.id === matchId);
  }

  public getMatchPlayers(matchId: string): Array<{
    matchPlayer: MatchPlayer;
    player: Player;
    goals: number;
    assists: number;
  }> {
    const mPlayers = this.data.matchPlayers.filter(mp => mp.matchId === matchId);
    const mEvents = this.data.statEvents.filter(ev => ev.matchId === matchId);

    return mPlayers.map(mp => {
      const player = this.getPlayerById(mp.playerId) || {
        id: mp.playerId,
        displayName: mp.playerNameAsEntered,
        normalizedName: normalizePlayerName(mp.playerNameAsEntered),
        createdAt: mp.createdAt,
      };

      const goals = mEvents.filter(ev => ev.playerId === mp.playerId && ev.type === 'GOAL').length;
      const assists = mEvents.filter(ev => ev.playerId === mp.playerId && ev.type === 'ASSIST').length;

      return {
        matchPlayer: mp,
        player,
        goals,
        assists,
      };
    }).sort((a, b) => {
      // Sort alphabetically by player display name for easy scanning during game
      return a.player.displayName.localeCompare(b.player.displayName);
    });
  }

  // -------------------------------------------------------------
  // TIMES (modo novo da rodada — times avulsos, montados na hora)
  // -------------------------------------------------------------

  public getTeamsForMatch(matchId: string): Team[] {
    return this.data.teams.filter(t => t.matchId === matchId);
  }

  public getTeamPlayerCount(teamId: string): number {
    return this.data.matchPlayers.filter(mp => mp.teamId === teamId).length;
  }

  // Cria um time dentro de uma rodada e já monta o elenco (colar lista,
  // mesma lógica de sempre). Máximo de 6 jogadores por time.
  public createTeam(
    matchId: string,
    nameRaw: string,
    rawPlayerList: string,
    performedBy = 'Administrador'
  ): { success: boolean; team?: Team; error?: string } {
    const name = nameRaw.trim();
    if (!name) {
      return { success: false, error: 'Informe um nome para o time.' };
    }

    const parsed = parsePlayerListInput(rawPlayerList);
    if (parsed.parsedPlayers.length === 0) {
      return { success: false, error: 'Cole ou digite os nomes dos jogadores do time.' };
    }
    if (parsed.duplicates.length > 0) {
      return { success: false, error: `Nomes duplicados na lista: ${parsed.duplicates.join(', ')}.` };
    }
    if (parsed.parsedPlayers.length > 6) {
      return { success: false, error: 'Um time pode ter no máximo 6 jogadores.' };
    }

    const teamId = generateId('team');
    const newTeam: Team = { id: teamId, matchId, name, createdAt: new Date().toISOString() };
    this.data.teams.push(newTeam);

    const newMatchPlayers: MatchPlayer[] = [];
    const newPlayers: Player[] = [];
    parsed.parsedPlayers.forEach(item => {
      const { player, isNew } = this.findOrCreatePlayer(item.originalName);
      if (isNew) newPlayers.push(player);
      const mp: MatchPlayer = {
        id: generateId('mp'),
        matchId,
        playerId: player.id,
        playerNameAsEntered: item.originalName,
        teamId,
        createdAt: new Date().toISOString(),
      };
      this.data.matchPlayers.push(mp);
      newMatchPlayers.push(mp);
    });

    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId,
      action: 'TEAM_CREATED',
      details: `Time "${name}" criado com ${parsed.parsedPlayers.length} jogadores.`,
      performedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    // Mesma ordem do createMatch: time e novos jogadores precisam existir no
    // banco antes do elenco (FK), por isso aguarda os dois primeiro.
    Promise.all([pushTeam(newTeam, pin), ...newPlayers.map(p => pushPlayer(p, pin))])
      .then(() => setTeamRoster(teamId, matchId, newMatchPlayers, pin))
      .then(() => pushAuditLog(auditEntry, pin));

    return { success: true, team: newTeam };
  }

  // Exclui um time. Jogadores perdem a participação naquele time, e
  // partidas que envolviam esse time (e os lançamentos delas) somem junto.
  public deleteTeam(teamId: string, performedBy = 'Administrador'): void {
    const team = this.data.teams.find(t => t.id === teamId);
    const teamName = team?.name || teamId;

    const affectedGameIds = new Set(
      this.data.games.filter(g => g.teamAId === teamId || g.teamBId === teamId).map(g => g.id)
    );
    this.data.games = this.data.games.filter(g => !affectedGameIds.has(g.id));
    this.data.statEvents = this.data.statEvents.filter(ev => !ev.gameId || !affectedGameIds.has(ev.gameId));
    this.data.matchPlayers = this.data.matchPlayers.filter(mp => mp.teamId !== teamId);
    this.data.teams = this.data.teams.filter(t => t.id !== teamId);

    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId: team?.matchId || null,
      action: 'TEAM_DELETED',
      details: `Time "${teamName}" excluído.`,
      performedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    deleteRemoteTeam(teamId, pin);
    pushAuditLog(auditEntry, pin);
  }

  // -------------------------------------------------------------
  // PARTIDAS (confronto entre 2 times de uma mesma rodada)
  // -------------------------------------------------------------

  public getGameById(gameId: string): Game | undefined {
    return this.data.games.find(g => g.id === gameId);
  }

  public getGamesForMatch(matchId: string): Array<{
    game: Game;
    teamA: Team | undefined;
    teamB: Team | undefined;
    teamAGoals: number;
    teamBGoals: number;
  }> {
    return this.data.games
      .filter(g => g.matchId === matchId)
      .map(game => {
        const teamA = this.data.teams.find(t => t.id === game.teamAId);
        const teamB = this.data.teams.find(t => t.id === game.teamBId);
        const goalEvents = this.data.statEvents.filter(ev => ev.gameId === game.id && ev.type === 'GOAL');

        let teamAGoals = 0;
        let teamBGoals = 0;
        goalEvents.forEach(ev => {
          const mp = this.data.matchPlayers.find(m => m.matchId === matchId && m.playerId === ev.playerId);
          if (mp?.teamId === game.teamAId) teamAGoals++;
          else if (mp?.teamId === game.teamBId) teamBGoals++;
        });

        return { game, teamA, teamB, teamAGoals, teamBGoals };
      })
      .sort((a, b) => b.game.createdAt.localeCompare(a.game.createdAt));
  }

  // Cria uma partida (dois times da mesma rodada). Sem ciclo próprio de
  // iniciar/finalizar: já aceita lançamentos assim que criada, contanto que
  // a rodada esteja EM ANDAMENTO (regra conferida no banco).
  public createGame(
    matchId: string,
    teamAId: string,
    teamBId: string,
    performedBy = 'Administrador'
  ): { success: boolean; game?: Game; error?: string } {
    if (teamAId === teamBId) {
      return { success: false, error: 'Escolha dois times diferentes.' };
    }
    const teamA = this.data.teams.find(t => t.id === teamAId && t.matchId === matchId);
    const teamB = this.data.teams.find(t => t.id === teamBId && t.matchId === matchId);
    if (!teamA || !teamB) {
      return { success: false, error: 'Times inválidos para esta rodada.' };
    }

    const newGame: Game = {
      id: generateId('game'),
      matchId,
      teamAId,
      teamBId,
      createdAt: new Date().toISOString(),
    };
    this.data.games.push(newGame);

    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId,
      action: 'GAME_CREATED',
      details: `Partida criada: "${teamA.name}" x "${teamB.name}".`,
      performedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    pushGame(newGame, pin).then(() => pushAuditLog(auditEntry, pin));

    return { success: true, game: newGame };
  }

  public deleteGame(gameId: string, performedBy = 'Administrador'): void {
    const game = this.data.games.find(g => g.id === gameId);
    this.data.statEvents = this.data.statEvents.filter(ev => ev.gameId !== gameId);
    this.data.games = this.data.games.filter(g => g.id !== gameId);

    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId: game?.matchId || null,
      action: 'GAME_DELETED',
      details: `Partida excluída junto com seus lançamentos.`,
      performedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    deleteRemoteGame(gameId, pin);
    pushAuditLog(auditEntry, pin);
  }

  // Jogadores dos 2 times de uma partida, com gols/assistências NESSA
  // partida especificamente (não da rodada inteira).
  public getGamePlayers(gameId: string): {
    teamA: Team | undefined;
    teamB: Team | undefined;
    teamAPlayers: Array<{ player: Player; goals: number; assists: number }>;
    teamBPlayers: Array<{ player: Player; goals: number; assists: number }>;
  } {
    const game = this.getGameById(gameId);
    if (!game) return { teamA: undefined, teamB: undefined, teamAPlayers: [], teamBPlayers: [] };

    const teamA = this.data.teams.find(t => t.id === game.teamAId);
    const teamB = this.data.teams.find(t => t.id === game.teamBId);
    const events = this.data.statEvents.filter(ev => ev.gameId === gameId);

    const buildRows = (teamId: string) => {
      const roster = this.data.matchPlayers.filter(mp => mp.teamId === teamId);
      return roster
        .map(mp => {
          const player = this.getPlayerById(mp.playerId) || {
            id: mp.playerId,
            displayName: mp.playerNameAsEntered,
            normalizedName: normalizePlayerName(mp.playerNameAsEntered),
            createdAt: mp.createdAt,
          };
          const goals = events.filter(ev => ev.playerId === mp.playerId && ev.type === 'GOAL').length;
          const assists = events.filter(ev => ev.playerId === mp.playerId && ev.type === 'ASSIST').length;
          return { player, goals, assists };
        })
        .sort((a, b) => a.player.displayName.localeCompare(b.player.displayName));
    };

    return {
      teamA,
      teamB,
      teamAPlayers: buildRows(game.teamAId),
      teamBPlayers: buildRows(game.teamBId),
    };
  }

  // Lança gol/assistência dentro de uma partida específica.
  public addGameStatEvent(params: {
    gameId: string;
    matchId: string;
    playerId: string;
    type: StatEventType;
    createdBy?: string;
  }): StatEvent {
    const newEvent: StatEvent = {
      id: generateId('ev'),
      matchId: params.matchId,
      playerId: params.playerId,
      type: params.type,
      createdBy: params.createdBy || 'Administrador',
      gameId: params.gameId,
      createdAt: new Date().toISOString(),
    };

    this.data.statEvents.push(newEvent);
    this.persist(this.data);
    pushStatEvent(newEvent, this.getSessionPin());
    return newEvent;
  }

  // Record a stat event (+1 GOL or +1 ASSIST)
  public addStatEvent(params: {
    matchId: string;
    playerId: string;
    type: StatEventType;
    createdBy?: string;
  }): StatEvent {
    const newEvent: StatEvent = {
      id: generateId('ev'),
      matchId: params.matchId,
      playerId: params.playerId,
      type: params.type,
      createdBy: params.createdBy || 'Administrador',
      createdAt: new Date().toISOString(),
    };

    this.data.statEvents.push(newEvent);
    this.persist(this.data);
    pushStatEvent(newEvent, this.getSessionPin());
    return newEvent;
  }

  // Remove the most recent event of given type for a player in a match (Admin correction)
  public removeLastPlayerEvent(params: {
    matchId: string;
    playerId: string;
    type: StatEventType;
    gameId?: string;
    performedBy?: string;
  }): boolean {
    const index = [...this.data.statEvents]
      .reverse()
      .findIndex(ev =>
        ev.matchId === params.matchId &&
        ev.playerId === params.playerId &&
        ev.type === params.type &&
        (params.gameId === undefined || ev.gameId === params.gameId)
      );

    if (index === -1) return false;

    const actualIndex = this.data.statEvents.length - 1 - index;
    const removed = this.data.statEvents.splice(actualIndex, 1)[0];

    const player = this.getPlayerById(params.playerId);
    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId: params.matchId,
      action: `${params.type}_REMOVED`,
      details: `Removido 1 ${params.type === 'GOAL' ? 'gol' : 'assistência'} de ${player?.displayName || 'Jogador'}.`,
      performedBy: params.performedBy || 'Administrador',
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    deleteRemoteStatEvent(removed.id, pin);
    pushAuditLog(auditEntry, pin);
    return true;
  }

  // Remove a specific stat event by ID
  public removeStatEventById(eventId: string, performedBy = 'Administrador'): boolean {
    const idx = this.data.statEvents.findIndex(e => e.id === eventId);
    if (idx === -1) return false;
    const ev = this.data.statEvents[idx];
    const player = this.getPlayerById(ev.playerId);

    this.data.statEvents.splice(idx, 1);
    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId: ev.matchId,
      action: `${ev.type}_REMOVED_DIRECT`,
      details: `Lançamento individual (${ev.type}) de ${player?.displayName} removido.`,
      performedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    deleteRemoteStatEvent(eventId, pin);
    pushAuditLog(auditEntry, pin);
    return true;
  }

  // Finalize match (Official results)
  public finalizeMatch(matchId: string, performedBy = 'Administrador'): { success: boolean; message?: string } {
    const match = this.data.matches.find(m => m.id === matchId);
    if (!match) return { success: false, message: 'Rodada não encontrada.' };

    match.status = 'FINALIZED';
    match.finalizedBy = performedBy;
    match.finalizedAt = new Date().toISOString();

    const events = this.data.statEvents.filter(e => e.matchId === matchId);
    const goalsCount = events.filter(e => e.type === 'GOAL').length;
    const assistsCount = events.filter(e => e.type === 'ASSIST').length;

    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId,
      action: 'MATCH_FINALIZED',
      details: `Rodada finalizada oficialmente. Total de ${goalsCount} gols e ${assistsCount} assistências integrados aos rankings.`,
      performedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    pushMatch(match, pin);
    pushAuditLog(auditEntry, pin);
    return { success: true };
  }

  // Admin correction of match details
  public updateMatchDetails(
    matchId: string,
    updates: { date?: string; time?: string; notes?: string; status?: Match['status'] },
    performedBy = 'Administrador'
  ): void {
    const match = this.data.matches.find(m => m.id === matchId);
    if (!match) return;

    if (updates.date) match.date = updates.date;
    if (updates.time) match.time = updates.time;
    if (updates.notes !== undefined) match.notes = updates.notes;
    if (updates.status) match.status = updates.status;

    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId,
      action: 'MATCH_DETAILS_UPDATED',
      details: `Detalhes da rodada atualizados (${updates.date || match.date}).`,
      performedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    pushMatch(match, pin);
    pushAuditLog(auditEntry, pin);
  }

  // Admin participant list update for match
  public updateMatchPlayers(matchId: string, rawPlayerList: string, performedBy = 'Administrador'): { success: boolean; error?: string } {
    const parsed = parsePlayerListInput(rawPlayerList);
    if (parsed.parsedPlayers.length === 0) {
      return { success: false, error: 'A lista de participantes não pode ficar vazia.' };
    }
    if (parsed.duplicates.length > 0) {
      return {
        success: false,
        error: `Nomes duplicados na lista: ${parsed.duplicates.join(', ')}. Corrija antes de salvar.`,
      };
    }

    // Keep events if players still in list, or retain players
    // Remove old matchPlayers for this match
    this.data.matchPlayers = this.data.matchPlayers.filter(mp => mp.matchId !== matchId);

    const newMatchPlayers: MatchPlayer[] = [];
    const newPlayers: Player[] = [];
    parsed.parsedPlayers.forEach(item => {
      const { player, isNew } = this.findOrCreatePlayer(item.originalName);
      if (isNew) newPlayers.push(player);
      const mp: MatchPlayer = {
        id: generateId('mp'),
        matchId,
        playerId: player.id,
        playerNameAsEntered: item.originalName,
        createdAt: new Date().toISOString(),
      };
      this.data.matchPlayers.push(mp);
      newMatchPlayers.push(mp);
    });

    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId,
      action: 'MATCH_PLAYERS_UPDATED',
      details: `Lista de participantes atualizada com ${parsed.parsedPlayers.length} jogadores.`,
      performedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    Promise.all(newPlayers.map(p => pushPlayer(p, pin)))
      .then(() => replaceMatchPlayers(matchId, newMatchPlayers, pin))
      .then(() => pushAuditLog(auditEntry, pin));
    return { success: true };
  }

  // Delete match (Admin only)
  public deleteMatch(matchId: string, performedBy = 'Administrador'): boolean {
    this.data.matches = this.data.matches.filter(m => m.id !== matchId);
    this.data.matchPlayers = this.data.matchPlayers.filter(mp => mp.matchId !== matchId);
    this.data.statEvents = this.data.statEvents.filter(ev => ev.matchId !== matchId);

    const auditEntry: AuditLog = {
      id: generateId('aud'),
      matchId: null,
      action: 'MATCH_DELETED',
      details: `Rodada ${matchId} e seus eventos excluídos pelo Administrador.`,
      performedBy,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(auditEntry);

    this.persist(this.data);
    const pin = this.getSessionPin();
    // match_players and stat_events cascade on delete in Postgres
    deleteRemoteMatch(matchId, pin);
    pushAuditLog(auditEntry, pin);
    return true;
  }

  // -------------------------------------------------------------
  // RANKINGS & STATS (STRICTLY FINALIZED MATCHES ONLY)
  // -------------------------------------------------------------

  public getRankings(params: {
    type: StatEventType;
    scope: 'ALL' | 'MONTH' | 'YEAR';
    month?: number; // 1-12
    year?: number;
  }): { items: RankingItem[]; totalCount: number; scopeLabel: string } {
    // 1. Filter ONLY FINALIZED matches
    let finalizedMatches = this.data.matches.filter(m => m.status === 'FINALIZED');

    let scopeLabel = 'Geral (Todo o Histórico)';

    if (params.scope === 'YEAR' && params.year) {
      finalizedMatches = finalizedMatches.filter(m => {
        const d = new Date(m.date);
        return d.getFullYear() === params.year;
      });
      scopeLabel = `Ano de ${params.year}`;
    } else if (params.scope === 'MONTH' && params.month && params.year) {
      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      finalizedMatches = finalizedMatches.filter(m => {
        // match date is YYYY-MM-DD
        const parts = m.date.split('-');
        const y = parseInt(parts[0], 10);
        const mth = parseInt(parts[1], 10);
        return y === params.year && mth === params.month;
      });
      scopeLabel = `${monthNames[params.month - 1]}/${params.year}`;
    }

    const matchIds = new Set(finalizedMatches.map(m => m.id));

    // Count participations for each player within the selected finalized matches
    const participationsMap = new Map<string, number>();
    this.data.matchPlayers.forEach(mp => {
      if (matchIds.has(mp.matchId)) {
        participationsMap.set(mp.playerId, (participationsMap.get(mp.playerId) || 0) + 1);
      }
    });

    // Count events of requested type (GOAL or ASSIST)
    const countsMap = new Map<string, number>();
    this.data.statEvents.forEach(ev => {
      if (matchIds.has(ev.matchId) && ev.type === params.type) {
        countsMap.set(ev.playerId, (countsMap.get(ev.playerId) || 0) + 1);
      }
    });

    // Only include players who have at least 1 goal or 1 assist in the ranking
    // Or include all players who played? Section 27 says: "Todos os jogadores que possuírem estatísticas deverão ser considerados normalmente para fins de classificação e ordenação."
    const rankingItems: RankingItem[] = [];

    countsMap.forEach((count, playerId) => {
      if (count > 0) {
        const player = this.getPlayerById(playerId);
        if (player) {
          const matchesPlayed = participationsMap.get(playerId) || 1;
          rankingItems.push({
            position: 1,
            player,
            count,
            matchesPlayed,
            average: Number((count / matchesPlayed).toFixed(2)),
          });
        }
      }
    });

    // Sort criteria:
    // 1. Count descending (more goals/assists)
    // 2. Tie breaker: fewer matches played (higher average efficiency)
    // 3. Alphabetical by display name
    rankingItems.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      if (a.matchesPlayed !== b.matchesPlayed) {
        return a.matchesPlayed - b.matchesPlayed;
      }
      return a.player.displayName.localeCompare(b.player.displayName);
    });

    // Assign positions (handling standard 1º, 2º... format)
    rankingItems.forEach((item, index) => {
      item.position = index + 1;
    });

    return {
      items: rankingItems,
      totalCount: rankingItems.length,
      scopeLabel,
    };
  }

  // Individual Player Summary across all finalized matches
  public getPlayerSummary(playerId: string): PlayerStatSummary | null {
    const player = this.getPlayerById(playerId);
    if (!player) return null;

    const finalizedMatches = this.data.matches.filter(m => m.status === 'FINALIZED');
    const finalizedMatchMap = new Map(finalizedMatches.map(m => [m.id, m]));

    // Matches where player participated officially
    const participatedMatchIds = new Set<string>();
    this.data.matchPlayers.forEach(mp => {
      if (mp.playerId === playerId && finalizedMatchMap.has(mp.matchId)) {
        participatedMatchIds.add(mp.matchId);
      }
    });

    const matchesPlayed = participatedMatchIds.size;

    // Events in finalized matches
    let goals = 0;
    let assists = 0;
    const matchEventMap = new Map<string, { goals: number; assists: number }>();

    participatedMatchIds.forEach(mId => {
      matchEventMap.set(mId, { goals: 0, assists: 0 });
    });

    this.data.statEvents.forEach(ev => {
      if (ev.playerId === playerId && finalizedMatchMap.has(ev.matchId)) {
        if (ev.type === 'GOAL') goals++;
        if (ev.type === 'ASSIST') assists++;

        const entry = matchEventMap.get(ev.matchId) || { goals: 0, assists: 0 };
        if (ev.type === 'GOAL') entry.goals++;
        if (ev.type === 'ASSIST') entry.assists++;
        matchEventMap.set(ev.matchId, entry);
      }
    });

    const history: Array<{
      matchId: string;
      date: string;
      goals: number;
      assists: number;
    }> = [];

    matchEventMap.forEach((val, mId) => {
      const match = finalizedMatchMap.get(mId);
      if (match) {
        history.push({
          matchId: mId,
          date: match.date,
          goals: val.goals,
          assists: val.assists,
        });
      }
    });

    // Sort history by date descending
    history.sort((a, b) => b.date.localeCompare(a.date));

    return {
      player,
      goals,
      assists,
      matchesPlayed,
      goalsPerMatch: matchesPlayed > 0 ? Number((goals / matchesPlayed).toFixed(2)) : 0,
      assistsPerMatch: matchesPlayed > 0 ? Number((assists / matchesPlayed).toFixed(2)) : 0,
      history,
    };
  }

  // Get all available years in history
  public getAvailableYears(): number[] {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);

    this.data.matches.forEach(m => {
      if (m.date) {
        const y = parseInt(m.date.split('-')[0], 10);
        if (!isNaN(y)) years.add(y);
      }
    });

    return Array.from(years).sort((a, b) => b - a);
  }

  // Reset demo data (mantém nome do grupo/logo/PIN já configurados)
  public resetToDefaultSeed(): void {
    const fresh = getInitialSeedData();
    fresh.settings = this.data.settings;
    this.data = fresh;
    this.persist(fresh);
    const pin = this.getSessionPin();
    wipeRemoteData(pin).then(() => pushFullSnapshot(fresh, pin, false));
  }

  // Apaga jogadores/peladas/lançamentos/logs de verdade, sem recriar dados de
  // exemplo (mantém nome do grupo/logo/PIN). Uso: começar a temporada real.
  public wipeAllData(): void {
    const empty: StorageData = {
      players: [],
      matches: [],
      teams: [],
      matchPlayers: [],
      games: [],
      statEvents: [],
      auditLogs: [],
      settings: this.data.settings,
    };
    this.data = empty;
    this.persist(empty);
    wipeRemoteData(this.getSessionPin());
  }
}

export const peladaStore = new PeladaStore();
