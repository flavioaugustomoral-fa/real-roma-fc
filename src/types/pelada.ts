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
}

export interface PlayerStatSummary {
  player: Player;
  goals: number;
  assists: number;
  matchesPlayed: number;
  goalsPerMatch: number;
  assistsPerMatch: number;
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
