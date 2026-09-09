import React, { useMemo } from 'react';
import {
  Play,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { usePeladaStore } from '../hooks/usePeladaStore';
import { NavTab } from './BottomNav';
import { getEffectiveLogoUrl, DEFAULT_PELADA_LOGO } from '../assets/logo';

interface HomeViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenCreateMatch: () => void;
  onSelectPlayer: (playerId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  onOpenCreateMatch,
  onSelectPlayer,
}) => {
  const { data, settings, activeMatch, store, isAdmin } = usePeladaStore();

  const now = new Date();
  const currentYear = now.getFullYear();

  // Top 5 Scorers of current year (Annual)
  const topScorersYear = useMemo(() => {
    const res = store.getRankings({
      type: 'GOAL',
      scope: 'YEAR',
      year: currentYear,
    });
    return res.items.slice(0, 5);
  }, [store, currentYear, data]);

  // Top 5 Assists of current year (Annual)
  const topAssistsYear = useMemo(() => {
    const res = store.getRankings({
      type: 'ASSIST',
      scope: 'YEAR',
      year: currentYear,
    });
    return res.items.slice(0, 5);
  }, [store, currentYear, data]);

  const isLive = activeMatch?.status === 'IN_PROGRESS';

  const getRankBadgeClass = (index: number) => {
    if (index === 0) return 'bg-amber-400/20 text-amber-300 border border-amber-400/40';
    if (index === 1) return 'bg-slate-300/20 text-slate-200 border border-slate-300/30';
    if (index === 2) return 'bg-amber-700/20 text-amber-400 border border-amber-700/30';
    return 'bg-slate-800 text-slate-400';
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Brand Hero Card - Section 22: Logo present on Home */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 border border-slate-800 p-5 sm:p-6 shadow-2xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <img
            src={getEffectiveLogoUrl(settings.logoUrl)}
            alt="Logo Pelada"
            referrerPolicy="no-referrer"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-contain drop-shadow-xl shrink-0"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== DEFAULT_PELADA_LOGO) {
                target.src = DEFAULT_PELADA_LOGO;
              }
            }}
          />
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-1">
              Futebol & Estatísticas
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {settings.peladaName || 'Pelada do Real Roma F.C.'}
            </h2>

            <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              {isAdmin && (
                <button
                  onClick={onOpenCreateMatch}
                  id="btn-home-quick-new-match"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Criar Nova Pelada</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Match Alert Callout (If active) */}
      {isLive && activeMatch && (
        <div
          onClick={() => onNavigate('match')}
          className="cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-4 text-white shadow-xl shadow-emerald-950/60 transition hover:brightness-105 active:scale-[0.99] flex items-center justify-between gap-3 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Play className="w-6 h-6 fill-white text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/30 px-2 py-0.5 rounded-full">
                  Pelada Ao Vivo Agora
                </span>
                <span className="text-xs font-mono opacity-90">{activeMatch.time || ''}</span>
              </div>
              <h3 className="text-base font-black tracking-tight mt-0.5">
                Toque aqui para registrar +1 GOL ou ASSISTÊNCIA!
              </h3>
            </div>
          </div>
          <ChevronRight className="w-6 h-6 shrink-0" />
        </div>
      )}

      {/* Annual Highlights (Top 5 Goals & Top 5 Assists) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Scorer Leaders */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚽</span>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                Artilharia do Ano ({currentYear})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('rankings')}
              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
            >
              Ver todos →
            </button>
          </div>

          {topScorersYear.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              Nenhum gol registrado no ano de {currentYear}.
            </p>
          ) : (
            <div className="space-y-2">
              {topScorersYear.map((item, i) => (
                <button
                  key={item.player.id}
                  onClick={() => onSelectPlayer(item.player.id)}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 transition text-left group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${getRankBadgeClass(i)}`}
                    >
                      {i + 1}º
                    </span>
                    <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition truncate uppercase">
                      {item.player.displayName}
                    </span>
                  </div>
                  <span className="text-sm font-black text-emerald-400 shrink-0">
                    {item.count} {item.count === 1 ? 'gol' : 'gols'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assist Leaders */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">👟</span>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                Garçons do Ano ({currentYear})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('rankings')}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300"
            >
              Ver todos →
            </button>
          </div>

          {topAssistsYear.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              Nenhuma assistência registrada no ano de {currentYear}.
            </p>
          ) : (
            <div className="space-y-2">
              {topAssistsYear.map((item, i) => (
                <button
                  key={item.player.id}
                  onClick={() => onSelectPlayer(item.player.id)}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 transition text-left group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${getRankBadgeClass(i)}`}
                    >
                      {i + 1}º
                    </span>
                    <span className="text-sm font-bold text-white group-hover:text-blue-400 transition truncate uppercase">
                      {item.player.displayName}
                    </span>
                  </div>
                  <span className="text-sm font-black text-blue-400 shrink-0">
                    {item.count} {item.count === 1 ? 'assist' : 'assists'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
