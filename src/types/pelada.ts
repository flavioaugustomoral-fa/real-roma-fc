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
  createdAt: string;
}

export interface StatEvent {
  id: string;
  matchId: string;
  playerId: string;
  type: StatEventType;
  createdBy: string;
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
