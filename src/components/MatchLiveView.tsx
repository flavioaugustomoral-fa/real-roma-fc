import React, { useState, useMemo } from 'react';
import {
  Trophy,
  CheckCircle,
  Search,
  Clock,
  ShieldCheck,
  Plus,
  Minus,
  Sparkles,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Match } from '../types/pelada';
import { usePeladaStore } from '../hooks/usePeladaStore';

interface MatchLiveViewProps {
  match: Match;
  onOpenCreateMatch?: () => void;
  onViewPlayerStats?: (playerId: string) => void;
  onMatchDeleted?: () => void;
}

export const MatchLiveView: React.FC<MatchLiveViewProps> = ({
  match,
  onOpenCreateMatch,
  onViewPlayerStats,
  onMatchDeleted,
}) => {
  const { data, store, isAdmin } = usePeladaStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [lastActionToast, setLastActionToast] = useState<{
    text: string;
    type: 'goal' | 'assist' | 'info';
  } | null>(null);

  const isFinalized = match.status === 'FINALIZED';
  const isDraft = match.status === 'DRAFT';
  const isInProgress = match.status === 'IN_PROGRESS';

  // Get current players and scores in this match
  const matchPlayersData = useMemo(() => {
    return store.getMatchPlayers(match.id);
  }, [store, match.id, data]);

  // Filtered by search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return matchPlayersData;
    const q = searchQuery.toLowerCase().trim();
    return matchPlayersData.filter(item =>
      item.player.displayName.toLowerCase().includes(q) ||
      item.matchPlayer.playerNameAsEntered.toLowerCase().includes(q)
    );
  }, [matchPlayersData, searchQuery]);

  // Total stats of the current match
  const matchTotals = useMemo(() => {
    let totalGoals = 0;
    let totalAssists = 0;
    matchPlayersData.forEach(item => {
      totalGoals += item.goals;
      totalAssists += item.assists;
    });
    return { totalGoals, totalAssists, totalPlayers: matchPlayersData.length };
  }, [matchPlayersData]);

  // Trigger feedback toast
  const triggerToast = (text: string, type: 'goal' | 'assist' | 'info') => {
    setLastActionToast({ text, type });
    setTimeout(() => {
      setLastActionToast(null);
    }, 2400);
  };

  // Add Stat Event (+1 GOL or +1 ASSIST)
  const handleAddEvent = (playerId: string, playerName: string, type: 'GOAL' | 'ASSIST') => {
    if (isFinalized && !isAdmin) return;

    store.addStatEvent({
      matchId: match.id,
      playerId,
      type,
      createdBy: isAdmin ? 'Administrador' : 'Participante',
    });

    if (type === 'GOAL') {
      triggerToast(`⚽ Gol registrado para ${playerName}!`, 'goal');
    } else {
      triggerToast(`👟 Assistência registrada para ${playerName}!`, 'assist');
    }
  };

  // Admin decrement (-1)
  const handleRemoveLastEvent = (playerId: string, playerName: string, type: 'GOAL' | 'ASSIST') => {
    if (!isAdmin) return;
    const removed = store.removeLastPlayerEvent({
      matchId: match.id,
      playerId,
      type,
      performedBy: 'Administrador',
    });
    if (removed) {
      triggerToast(`Removido 1 ${type === 'GOAL' ? 'gol' : 'assistência'} de ${playerName}`, 'info');
    }
  };

  // Start match
  const handleStartMatch = () => {
    store.startMatch(match.id, 'Administrador');
    triggerToast('Pelada iniciada! Lançamentos liberados.', 'info');
  };

  // Finalize match
  const handleConfirmFinalize = () => {
    const res = store.finalizeMatch(match.id, 'Administrador');
    setShowFinalizeModal(false);
    if (res.success) {
      triggerToast('Pelada finalizada oficialmente! Os rankings foram atualizados.', 'info');
    }
  };

  // Delete match (and all its launches/participants)
  const handleConfirmDelete = () => {
    store.deleteMatch(match.id, 'Administrador');
    setShowDeleteModal(false);
    onMatchDeleted?.();
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Toast notification */}
      {lastActionToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-150">
          <div
            className={`px-4 py-2 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border ${
              lastActionToast.type === 'goal'
                ? 'bg-emerald-600 text-white border-emerald-400'
                : lastActionToast.type === 'assist'
                ? 'bg-blue-600 text-white border-blue-400'
                : 'bg-slate-800 text-slate-100 border-slate-700'
            }`}
          >
            <span>{lastActionToast.text}</span>
          </div>
        </div>
      )}

      {/* Match Status Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isInProgress
                  ? 'bg-emerald-400 animate-pulse'
                  : isFinalized
                  ? 'bg-blue-400'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
              {isInProgress
                ? 'Pelada em Andamento'
                : isFinalized
                ? 'Pelada Finalizada (Oficial)'
                : 'Pelada Agendada (Rascunho)'}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{match.date.split('-').reverse().join('/')}</span>
            {match.time && <span>às {match.time}</span>}
          </div>
        </div>

        {/* Live Scorecard Totals */}
        <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-950/70 rounded-xl border border-slate-800/80 mb-3 text-center">
          <div>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Gols da Partida
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400">
              ⚽ {matchTotals.totalGoals}
            </span>
          </div>
          <div className="border-x border-slate-800">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Assistências
            </span>
            <span className="text-xl sm:text-2xl font-black text-blue-400">
              👟 {matchTotals.totalAssists}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Participantes
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-200">
              👥 {matchTotals.totalPlayers}
            </span>
          </div>
        </div>

        {/* Action button row for Admin */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
          {isAdmin && (
            <div className="flex items-center gap-2">
              {!isFinalized && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  id="btn-delete-match"
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800/60 transition"
                  title="Excluir Pelada"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {isDraft && (
                <button
                  onClick={handleStartMatch}
                  id="btn-start-match"
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition"
                >
                  Iniciar Pelada Agora
                </button>
              )}

              {isInProgress && (
                <button
                  onClick={() => setShowFinalizeModal(true)}
                  id="btn-finalize-match-modal"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/40 transition flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Finalizar Pelada</span>
                </button>
              )}

              {isFinalized && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Oficializada
                </span>
              )}
            </div>
          )}

          {!isAdmin && isFinalized && (
            <span className="text-xs text-slate-400 italic">
              Resultados oficiais confirmados pelo Administrador.
            </span>
          )}
        </div>
      </div>

      {/* Quick Player Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar jogador na partida..."
          className="w-full text-sm pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-white"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Players List with Big Touch-Friendly Buttons */}
      <div className="space-y-3">
        {filteredPlayers.length === 0 ? (
          <div className="text-center py-10 bg-slate-900/60 rounded-2xl border border-slate-800 p-6">
            <p className="text-sm text-slate-400">Nenhum jogador encontrado com "{searchQuery}".</p>
          </div>
        ) : (
          filteredPlayers.map(({ player, goals, assists }) => {
            return (
              <div
                key={player.id}
                id={`player-card-${player.id}`}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md hover:border-slate-700 transition"
              >
                {/* Player Name and Quick Profile link */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <button
                    onClick={() => onViewPlayerStats && onViewPlayerStats(player.id)}
                    className="text-left group"
                    title="Ver perfil e estatísticas do jogador"
                  >
                    <span className="text-base sm:text-lg font-black text-white group-hover:text-emerald-400 tracking-tight transition uppercase">
                      {player.displayName}
                    </span>
                    <span className="block text-[11px] text-slate-500 font-medium">
                      Toque para ver histórico individual
                    </span>
                  </button>

                  {/* Summary badges */}
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      ⚽ {goals} {goals === 1 ? 'gol' : 'gols'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      👟 {assists} {assists === 1 ? 'assist' : 'assists'}
                    </span>
                  </div>
                </div>

                {/* Big Action Buttons - Section 7: "+1 GOL" and "+1 ASSISTÊNCIA" */}
                {(!isFinalized || isAdmin) && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    {/* Goal Button */}
                    <div className="flex items-center gap-1.5">
                      {isAdmin && goals > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLastEvent(player.id, player.displayName, 'GOAL')}
                          className="w-10 h-13 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 flex items-center justify-center border border-slate-700 transition shrink-0 active:scale-95"
                          title="Remover 1 gol (Admin)"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAddEvent(player.id, player.displayName, 'GOAL')}
                        id={`btn-add-goal-${player.id}`}
                        className="flex-1 min-h-[52px] rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.97] transition-all text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 border border-emerald-400/30"
                      >
                        <span className="text-xl">⚽</span>
                        <span className="tracking-wide">+1 GOL</span>
                      </button>
                    </div>

                    {/* Assist Button */}
                    <div className="flex items-center gap-1.5">
                      {isAdmin && assists > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLastEvent(player.id, player.displayName, 'ASSIST')}
                          className="w-10 h-13 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 flex items-center justify-center border border-slate-700 transition shrink-0 active:scale-95"
                          title="Remover 1 assistência (Admin)"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAddEvent(player.id, player.displayName, 'ASSIST')}
                        id={`btn-add-assist-${player.id}`}
                        className="flex-1 min-h-[52px] rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 active:scale-[0.97] transition-all text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-950/60 border border-blue-400/30"
                      >
                        <span className="text-xl">👟</span>
                        <span className="tracking-wide">+1 ASSIST</span>
                      </button>
                    </div>
                  </div>
                )}

                {isFinalized && !isAdmin && (
                  <div className="text-center py-1.5 text-xs text-slate-500 italic bg-slate-950/40 rounded-xl">
                    Partida finalizada — estatísticas consolidadas
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal to Finalize Match */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-center text-white mb-1">
              Finalizar Pelada?
            </h3>
            <p className="text-xs text-center text-slate-400 mb-4 leading-relaxed">
              Ao finalizar, os dados tornam-se oficiais e serão integrados imediatamente aos rankings gerais, mensais e anuais.
            </p>

            {/* Summary preview */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 mb-5 text-xs text-slate-300 space-y-1.5">
              <div className="flex justify-between">
                <span>Data:</span>
                <span className="font-bold text-white">{match.date.split('-').reverse().join('/')}</span>
              </div>
              <div className="flex justify-between">
                <span>Participantes oficiais:</span>
                <span className="font-bold text-white">{matchTotals.totalPlayers}</span>
              </div>
              <div className="flex justify-between">
                <span>Total de gols:</span>
                <span className="font-bold text-emerald-400">⚽ {matchTotals.totalGoals}</span>
              </div>
              <div className="flex justify-between">
                <span>Total de assistências:</span>
                <span className="font-bold text-blue-400">👟 {matchTotals.totalAssists}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-300 transition"
              >
                Continuar Jogo
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalize}
                id="btn-confirm-finalize"
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold text-white shadow-lg shadow-rose-950/40 transition"
              >
                Sim, Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Delete Match */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-center text-white mb-1">
              Excluir Pelada?
            </h3>
            <p className="text-xs text-center text-slate-400 mb-5 leading-relaxed">
              A pelada, a lista de participantes e todos os lançamentos de gols e assistências serão excluídos permanentemente. Essa ação não pode ser desfeita.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                id="btn-confirm-delete-match"
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold text-white shadow-lg shadow-rose-950/40 transition"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
