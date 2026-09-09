import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle,
  Users,
  ChevronRight,
  ShieldCheck,
  Edit,
  Trash2,
  X,
  Plus,
  Minus,
  AlertTriangle
} from 'lucide-react';
import { Match, StatEventType } from '../types/pelada';
import { usePeladaStore } from '../hooks/usePeladaStore';

interface HistoryViewProps {
  onSelectMatchToPlay?: (match: Match) => void;
  onViewPlayerStats?: (playerId: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onSelectMatchToPlay,
  onViewPlayerStats,
}) => {
  const { data, matches, store, isAdmin } = usePeladaStore();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sort matches descending by date
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => b.date.localeCompare(a.date));
  }, [matches]);

  const selectedMatch = useMemo(() => {
    if (!selectedMatchId) return null;
    return store.getMatchById(selectedMatchId);
  }, [store, selectedMatchId, data]);

  const selectedMatchStats = useMemo(() => {
    if (!selectedMatchId) return [];
    return store.getMatchPlayers(selectedMatchId);
  }, [store, selectedMatchId, data]);

  const selectedMatchTotals = useMemo(() => {
    let goals = 0;
    let assists = 0;
    selectedMatchStats.forEach(s => {
      goals += s.goals;
      assists += s.assists;
    });
    return { goals, assists, playersCount: selectedMatchStats.length };
  }, [selectedMatchStats]);

  const handleOpenDetails = (match: Match) => {
    setSelectedMatchId(match.id);
    setEditDate(match.date);
    setEditTime(match.time || '19:00');
    setEditNotes(match.notes || '');
    setIsEditingInfo(false);
    setShowDeleteConfirm(false);
  };

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchId || !isAdmin) return;
    store.updateMatchDetails(
      selectedMatchId,
      { date: editDate, time: editTime, notes: editNotes },
      'Administrador'
    );
    setIsEditingInfo(false);
  };

  const handleDeleteMatch = () => {
    if (!selectedMatchId || !isAdmin) return;
    store.deleteMatch(selectedMatchId, 'Administrador');
    setSelectedMatchId(null);
    setShowDeleteConfirm(false);
  };

  const handleAdjustStat = (playerId: string, type: StatEventType, delta: 1 | -1) => {
    if (!selectedMatchId || !isAdmin) return;
    if (delta === 1) {
      store.addStatEvent({
        matchId: selectedMatchId,
        playerId,
        type,
        createdBy: 'Administrador (Correção)',
      });
    } else {
      store.removeLastPlayerEvent({
        matchId: selectedMatchId,
        playerId,
        type,
        performedBy: 'Administrador (Correção)',
      });
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <span>Histórico de Peladas</span>
            </h2>
            <p className="text-xs text-slate-400">
              Todas as partidas registradas, das mais recentes para as mais antigas
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
            {matches.length} {matches.length === 1 ? 'partida' : 'partidas'}
          </span>
        </div>
      </div>

      {/* Matches List */}
      <div className="space-y-2.5">
        {sortedMatches.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/60 rounded-2xl border border-slate-800 p-6">
            <p className="text-sm text-slate-400">Nenhuma pelada registrada ainda.</p>
          </div>
        ) : (
          sortedMatches.map((m) => {
            const isFinalized = m.status === 'FINALIZED';
            const isInProgress = m.status === 'IN_PROGRESS';
            const mStats = store.getMatchPlayers(m.id);
            let totalG = 0;
            let totalA = 0;
            mStats.forEach(s => {
              totalG += s.goals;
              totalA += s.assists;
            });

            return (
              <div
                key={m.id}
                onClick={() => handleOpenDetails(m)}
                id={`match-history-card-${m.id}`}
                className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 active:bg-slate-800/80 rounded-2xl p-4 shadow-md transition text-left cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isInProgress
                          ? 'bg-emerald-400 animate-pulse'
                          : isFinalized
                          ? 'bg-blue-400'
                          : 'bg-amber-400'
                      }`}
                    />
                    <span className="text-sm sm:text-base font-black text-white group-hover:text-emerald-400 transition font-mono">
                      {m.date.split('-').reverse().join('/')}
                    </span>
                    {m.time && (
                      <span className="text-xs text-slate-500 font-mono">({m.time})</span>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      isFinalized
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                        : isInProgress
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {isFinalized ? 'Finalizada (Oficial)' : isInProgress ? 'Em Andamento' : 'Rascunho'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-semibold text-emerald-400">
                      ⚽ {totalG} {totalG === 1 ? 'gol' : 'gols'}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-blue-400">
                      👟 {totalA} {totalA === 1 ? 'assistência' : 'assistências'}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Users className="w-3.5 h-3.5" />
                      {mStats.length} jogadores
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-slate-500 group-hover:text-white transition">
                    <span className="text-[11px] font-semibold">Ver súmula</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Match Details & Admin Correction Modal - Section 10 & 16 */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl my-auto max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white font-mono">
                    {selectedMatch.date.split('-').reverse().join('/')}
                  </h3>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      selectedMatch.status === 'FINALIZED'
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {selectedMatch.status === 'FINALIZED' ? 'Resultado Oficial' : 'Em Aberto'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {selectedMatch.time ? `Horário: ${selectedMatch.time}` : 'Partida realizada'}
                  {selectedMatch.finalizedAt && (
                    <span> • Finalizada em {new Date(selectedMatch.finalizedAt).toLocaleDateString('pt-BR')}</span>
                  )}
                </p>
              </div>

              <button
                onClick={() => setSelectedMatchId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scorecard Summary */}
            <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-950/70 rounded-xl border border-slate-800/80 my-3 text-center shrink-0">
              <div>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase">Gols</span>
                <span className="text-lg font-black text-emerald-400">⚽ {selectedMatchTotals.goals}</span>
              </div>
              <div className="border-x border-slate-800">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase">Assistências</span>
                <span className="text-lg font-black text-blue-400">👟 {selectedMatchTotals.assists}</span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase">Jogadores</span>
                <span className="text-lg font-black text-slate-200">👥 {selectedMatchTotals.playersCount}</span>
              </div>
            </div>

            {/* Admin Controls Ribbon */}
            {isAdmin && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-3 shrink-0">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Modo Correção Administrativa Ativo
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsEditingInfo(!isEditingInfo)}
                    className="px-2 py-1 rounded bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <Edit className="w-3 h-3" />
                    {isEditingInfo ? 'Fechar Edição' : 'Editar Data'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                    className="p-1 rounded bg-rose-950/40 text-rose-400 hover:text-rose-300 hover:bg-rose-900/50 text-xs"
                    title="Excluir Pelada"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Edit Info Form */}
            {isEditingInfo && isAdmin && (
              <form onSubmit={handleSaveInfo} className="p-3 bg-slate-950 rounded-xl border border-slate-800 mb-3 space-y-2 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Data</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Horário</label>
                    <input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingInfo(false)}
                    className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            )}

            {/* Delete Confirmation Banner */}
            {showDeleteConfirm && isAdmin && (
              <div className="p-3 bg-rose-950/60 rounded-xl border border-rose-800 mb-3 space-y-2 shrink-0">
                <p className="text-xs text-rose-200 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  Tem certeza que deseja excluir esta pelada e todos os seus lançamentos?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2.5 py-1 text-xs text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteMatch}
                    className="px-3 py-1 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-500"
                  >
                    Sim, Excluir Pelada
                  </button>
                </div>
              </div>
            )}

            {/* Official Súmula List (Scrollable) */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">
                Participantes & Estatísticas Oficiais:
              </span>

              {selectedMatchStats.map(({ player, goals, assists }) => (
                <div
                  key={player.id}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <button
                    onClick={() => {
                      if (onViewPlayerStats) onViewPlayerStats(player.id);
                    }}
                    className="text-left hover:text-emerald-400 transition"
                  >
                    <span className="font-extrabold text-sm text-white uppercase block">
                      {player.displayName}
                    </span>
                    <span className="text-[10px] text-slate-500">Toque para ver perfil</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Goals display & correction */}
                    <div className="flex items-center gap-1 bg-emerald-950/40 border border-emerald-800/50 px-2 py-1 rounded-lg">
                      <span className="text-xs font-bold text-emerald-400">⚽ {goals}</span>
                      {isAdmin && (
                        <div className="flex items-center ml-1 gap-0.5">
                          <button
                            onClick={() => handleAdjustStat(player.id, 'GOAL', 1)}
                            className="w-4 h-4 rounded bg-emerald-700/60 hover:bg-emerald-600 text-white flex items-center justify-center text-[10px]"
                            title="Adicionar 1 gol"
                          >
                            +
                          </button>
                          {goals > 0 && (
                            <button
                              onClick={() => handleAdjustStat(player.id, 'GOAL', -1)}
                              className="w-4 h-4 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 flex items-center justify-center text-[10px]"
                              title="Remover 1 gol"
                            >
                              -
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Assists display & correction */}
                    <div className="flex items-center gap-1 bg-blue-950/40 border border-blue-800/50 px-2 py-1 rounded-lg">
                      <span className="text-xs font-bold text-blue-400">👟 {assists}</span>
                      {isAdmin && (
                        <div className="flex items-center ml-1 gap-0.5">
                          <button
                            onClick={() => handleAdjustStat(player.id, 'ASSIST', 1)}
                            className="w-4 h-4 rounded bg-blue-700/60 hover:bg-blue-600 text-white flex items-center justify-center text-[10px]"
                            title="Adicionar 1 assistência"
                          >
                            +
                          </button>
                          {assists > 0 && (
                            <button
                              onClick={() => handleAdjustStat(player.id, 'ASSIST', -1)}
                              className="w-4 h-4 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 flex items-center justify-center text-[10px]"
                              title="Remover 1 assistência"
                            >
                              -
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-800 shrink-0 flex gap-2 mt-2">
              {selectedMatch.status === 'IN_PROGRESS' && onSelectMatchToPlay && (
                <button
                  onClick={() => {
                    onSelectMatchToPlay(selectedMatch);
                    setSelectedMatchId(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition"
                >
                  Abrir na Tela da Pelada (Lançar)
                </button>
              )}
              <button
                onClick={() => setSelectedMatchId(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
