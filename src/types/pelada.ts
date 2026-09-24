export type MatchStatus = 'DRAFT' | 'IN_PROGRESS' | 'FINALIZED' | 'CANCELLED';

export type StatEventType = 'GOAL' | 'ASSIST';

export interface Player {
  id: string;
  displayName: string;
  normalizedName: string;
  createdAt: string;
}

export interface MatchPlayer {
  id: string;
  matchId: string;
  playerId: string;
  playerNameAsEntered: string;
  teamId?: string | null;
  createdAt: string;
}

export interface StatEvent {
  id: string;
  matchId: string;
  playerId: string;
  type: StatEventType;
  createdBy: string;
  gameId?: string | null;
  createdAt: string;
}

// Time avulso montado dentro de uma rodada (só existe nas rodadas "modo
// novo" — rodadas antigas não têm nenhum registro de Team).
export interface Team {
  id: string;
  matchId: string;
  name: string;
  createdAt: string;
}

// Partida: confronto entre 2 times de uma mesma rodada.
export interface Game {
  id: string;
  matchId: string;
  teamAId: string;
  teamBId: string;
  createdAt: string;
}

// Temporada: período sem prazo fixo, aberto até o Admin finalizá-lo. Uma
// rodada pertence à temporada cujo intervalo [startDate, endDate] contém sua
// data — a temporada "atual" é a que tem endDate null.
export interface Season {
  id: string;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD, null = temporada aberta/atual
  createdAt: string;
}

// Ajuste manual, único por jogador+temporada: soma gols/assistências de
// antes do app existir (época da folha de papel) ao total da temporada.
// Sem rodada real associada — por isso, quando uma temporada tem qualquer
// ajuste, a média por rodada e a contagem de rodadas dela deixam de ser
// exibidas (não dá pra confiar nesse número misturado com dado de papel).
export interface SeasonAdjustment {
  id: string;
  seasonId: string;
  playerId: string;
  goalsOffset: number;
  assistsOffset: number;
  createdAt: string;
}

export interface Match {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  status: MatchStatus;
  createdBy: string;
  finalizedBy?: string | null;
  createdAt: string;
  finalizedAt?: string | null;
  notes?: string;
  mvpPlayerId?: string | null;
}

export interface AuditLog {
  id: string;
  matchId?: string | null;
  action: string;
  details: string;
  performedBy: string;
  createdAt: string;
}

export interface PeladaSettings {
  peladaName: string;
  logoUrl: string;
  adminPin: string;
  venueName: string;
  instagramHandle?: string;
}

export interface PlayerStatSummary {
  player: Player;
  goals: number;
  assists: number;
  matchesPlayed: number;
  goalsPerMatch: number;
  assistsPerMatch: number;
  mvpCount: number;
  championTeamCount: number;
  rodadaStatsNullified: boolean;
  history: Array<{
    matchId: string;
    date: string;
    goals: number;
    assists: number;
  }>;
}

export interface RankingItem {
  position: number;
  player: Player;
  count: number;
  matchesPlayed: number;
  average: number;
}
