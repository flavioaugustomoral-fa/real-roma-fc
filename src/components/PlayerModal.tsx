import React, { useMemo, useState, useEffect } from 'react';
import { X, Calendar, Activity, Pencil, Check, AlertTriangle, Trophy } from 'lucide-react';
import { usePeladaStore } from '../hooks/usePeladaStore';
import { LaurelWreathIcon } from './icons/LaurelWreathIcon';

interface PlayerModalProps {
  playerId: string | null;
  onClose: () => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({ playerId, onClose }) => {
  const { data, store, isAdmin } = usePeladaStore();

  const seasons = useMemo(() => store.getSeasons(), [store, data]);
  const currentSeason = useMemo(() => store.getCurrentSeason(), [store, data]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');

  const summary = useMemo(() => {
    if (!playerId) return null;
    return store.getPlayerSummary(playerId, selectedSeasonId || undefined);
  }, [store, playerId, selectedSeasonId, data]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [mergeNotice, setMergeNotice] = useState<string | null>(null);

  useEffect(() => {
    setIsEditingName(false);
    setRenameError(null);
    setMergeNotice(null);
    // Cada abertura do perfil parte da temporada atual — o Admin/usuário
    // pode trocar depois pelo seletor. Nome vem direto do jogador (não do
    // summary, que já depende da temporada) pra não sobrescrever uma edição
    // em andamento quando o usuário trocar de temporada.
    setSelectedSeasonId(currentSeason?.id || '');
    const player = store.getPlayerById(playerId || '');
    if (player) setNameInput(player.displayName);
  }, [playerId]);

  if (!playerId || !summary) return null;

  const handleSaveName = async () => {
    setRenameError(null);
    setSaving(true);
    const res = await store.renamePlayer(playerId, nameInput);
    setSaving(false);

    if (!res.success) {
      setRenameError(res.error || 'Não foi possível renomear.');
      return;
    }

    if (res.merged) {
      setMergeNotice(`Dados incorporados ao jogador "${res.targetDisplayName}".`);
      setTimeout(() => onClose(), 1800);
    } else {
      setIsEditingName(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-950/40 shrink-0">
              {summary.player.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              {isEditingName ? (
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  className="w-full text-base font-black text-white bg-slate-950 border border-emerald-600/60 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xl font-black text-white tracking-tight uppercase truncate">
                    {summary.player.displayName}
                  </h2>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setNameInput(summary.player.displayName);
                        setIsEditingName(true);
                        setRenameError(null);
                      }}
                      className="p-1 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition shrink-0"
                      title="Editar nome do jogador"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isEditingName && (
          <div className="mb-4 -mt-1 space-y-2">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Se o nome novo já pertencer a outro jogador cadastrado, os dados deste jogador (gols, assistências e participações) serão incorporados a ele.
            </p>
            {renameError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {renameError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveName}
                disabled={saving || !nameInput.trim()}
                className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {mergeNotice && (
          <div className="mb-4 -mt-1 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
            {mergeNotice}
          </div>
        )}

        {/* Seletor de Temporada — estatísticas abaixo são só dela */}
        {seasons.length > 0 && (
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Estatísticas da
            </span>
            <select
              value={selectedSeasonId || currentSeason?.id || ''}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="text-xs font-semibold py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {seasons.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label}{s.endDate === null ? ' (atual)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

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
              Rodadas
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
            <span className="block text-[10px] text-slate-400 mt-0.5">por rodada disputada</span>
          </div>

          <div className="bg-blue-950/30 p-3 rounded-xl border border-blue-800/50">
            <span className="block text-[11px] font-bold text-blue-300 uppercase tracking-wider">
              Média de Assists
            </span>
            <span className="text-xl font-black text-blue-400">
              {summary.assistsPerMatch.toFixed(2)}
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5">por rodada disputada</span>
          </div>
        </div>

        {/* MVP & Team Champion Honors */}
        <div className="grid grid-cols-2 gap-2.5 mb-5 text-center">
          <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-800/50">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1">
              <LaurelWreathIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>MVP da Rodada</span>
            </span>
            <span className="block text-xl font-black text-amber-400 mt-0.5">
              {summary.mvpCount}
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5">
              {summary.mvpCount === 1 ? 'vez eleito' : 'vezes eleito'}
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span>Time da Rodada</span>
            </span>
            <span className="block text-xl font-black text-emerald-400 mt-0.5">
              {summary.championTeamCount}
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5">
              {summary.championTeamCount === 1 ? 'vez no time campeão' : 'vezes no time campeão'}
            </span>
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
              Nenhuma participação registrada em rodadas finalizadas.
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
