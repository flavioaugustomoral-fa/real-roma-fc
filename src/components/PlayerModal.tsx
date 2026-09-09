import React, { useMemo } from 'react';
import { X, User, Calendar, Award, Target, Activity } from 'lucide-react';
import { usePeladaStore } from '../hooks/usePeladaStore';

interface PlayerModalProps {
  playerId: string | null;
  onClose: () => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({ playerId, onClose }) => {
  const { data, store } = usePeladaStore();

  const summary = useMemo(() => {
    if (!playerId) return null;
    return store.getPlayerSummary(playerId);
  }, [store, playerId, data]);

  if (!playerId || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-950/40">
              {summary.player.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase">
                {summary.player.displayName}
              </h2>
              <span className="text-xs text-slate-400">
                Identificador único: <code className="text-slate-500 font-mono">{summary.player.id}</code>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Overall Stats Card - Section 15 */}
        <div className="grid grid-cols-3 gap-2.5 mb-3 text-center">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Gols
            </span>
            <span className="text-2xl font-black text-emerald-400">
              ⚽ {summary.goals}
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Assists
            </span>
            <span className="text-2xl font-black text-blue-400">
              👟 {summary.assists}
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Peladas
            </span>
            <span className="text-2xl font-black text-slate-200">
              {summary.matchesPlayed}
            </span>
          </div>
        </div>

        {/* Calculated Averages Cards - Section 6 & 15 */}
        <div className="grid grid-cols-2 gap-2.5 mb-5 text-center">
          <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/50">
            <span className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
              Média de Gols
            </span>
            <span className="text-xl font-black text-emerald-400">
              {summary.goalsPerMatch.toFixed(2)}
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5">por pelada disputada</span>
          </div>

          <div className="bg-blue-950/30 p-3 rounded-xl border border-blue-800/50">
            <span className="block text-[11px] font-bold text-blue-300 uppercase tracking-wider">
              Média de Assists
            </span>
            <span className="text-xl font-black text-blue-400">
              {summary.assistsPerMatch.toFixed(2)}
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5">por pelada disputada</span>
          </div>
        </div>

        {/* Match Participation History Table */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Histórico de Participações ({summary.history.length})</span>
          </h3>

          {summary.history.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              Nenhuma participação registrada em peladas finalizadas.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800/80 divide-y divide-slate-800/60 bg-slate-950/50">
              {summary.history.map((h, i) => (
                <div
                  key={i}
                  className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-900/50 transition"
                >
                  <div className="flex items-center gap-2 text-slate-300 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{h.date.split('-').reverse().join('/')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-400">
                      ⚽ {h.goals} {h.goals === 1 ? 'gol' : 'gols'}
                    </span>
                    <span className="font-bold text-blue-400">
                      👟 {h.assists} {h.assists === 1 ? 'assist' : 'assists'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200 transition"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
