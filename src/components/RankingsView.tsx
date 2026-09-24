import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Calendar,
  ChevronDown,
  ChevronUp,
  User,
  Flame,
  Target,
  Search,
} from 'lucide-react';
import { StatEventType } from '../types/pelada';
import { usePeladaStore } from '../hooks/usePeladaStore';

interface RankingsViewProps {
  onSelectPlayer: (playerId: string) => void;
}

export const RankingsView: React.FC<RankingsViewProps> = ({ onSelectPlayer }) => {
  const { data, matches, store } = usePeladaStore();

  // Active ranking type: 'GOAL' or 'ASSIST'
  const [rankingType, setRankingType] = useState<StatEventType>('GOAL');

  // Scope: 'SEASON' (temporada) | 'MONTH' (mensal) | 'MATCH' (rodada)
  const [scope, setScope] = useState<'SEASON' | 'MONTH' | 'MATCH'>('SEASON');

  // Month & Year selection (current month/year as default)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');

  // Show full list beyond Top 10 toggle
  const [showFullList, setShowFullList] = useState(false);

  // Busca por nome do jogador
  const [searchQuery, setSearchQuery] = useState('');

  const availableYears = useMemo(() => store.getAvailableYears(), [store, data]);

  // Temporadas, mais recente primeiro — candidatas do seletor "Temporada".
  const seasons = useMemo(() => store.getSeasons(), [store, data]);
  const currentSeason = useMemo(() => store.getCurrentSeason(), [store, data]);

  // Rodadas finalizadas, mais recente primeiro — candidatas do seletor "Rodada".
  const finalizedMatches = useMemo(
    () => matches.filter(m => m.status === 'FINALIZED').sort((a, b) => b.date.localeCompare(a.date)),
    [matches]
  );

  const getRankBadgeClass = (index: number) => {
    if (index === 0) return 'bg-amber-400/20 text-amber-300 border border-amber-400/40';
    if (index === 1) return 'bg-slate-300/30 text-slate-100 border border-slate-300/40';
    if (index === 2) return 'bg-amber-700/20 text-amber-400 border border-amber-700/30';
    return 'bg-slate-800 text-slate-400';
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Fetch computed ranking strictly from finalized matches
  const rankingData = useMemo(() => {
    return store.getRankings({
      type: rankingType,
      scope,
      month: selectedMonth,
      year: selectedYear,
      matchId: selectedMatchId || undefined,
      seasonId: selectedSeasonId || undefined,
    });
  }, [store, rankingType, scope, selectedMonth, selectedYear, selectedMatchId, selectedSeasonId, data]);

  // Filtra pelo nome digitado — quando há busca, ignora o corte de Top 10 e
  // mostra todos os jogadores que baterem, não só os melhores colocados.
  const filteredRankingItems = useMemo(() => {
    if (!searchQuery.trim()) return rankingData.items;
    const q = searchQuery.toLowerCase().trim();
    return rankingData.items.filter(item => item.player.displayName.toLowerCase().includes(q));
  }, [rankingData.items, searchQuery]);

  // Section 27: Top 10 by default
  const displayedItems = useMemo(() => {
    if (searchQuery.trim()) return filteredRankingItems;
    if (showFullList) return rankingData.items;
    return rankingData.items.slice(0, 10);
  }, [rankingData.items, filteredRankingItems, showFullList, searchQuery]);

  const hasMoreThan10 = !searchQuery.trim() && rankingData.items.length > 10;

  return (
    <div className="space-y-4 pb-20">
      {/* Rankings Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Rankings Oficiais</span>
          </h2>
        </div>

        {/* Independent Ranking Tabs: Gols vs Assistências (Section 11 & 12) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 mb-3">
          <button
            onClick={() => setRankingType('GOAL')}
            id="tab-ranking-gols"
            className={`py-2.5 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              rankingType === 'GOAL'
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-base">⚽</span>
            <span className="tracking-wide uppercase">Ranking de Gols</span>
          </button>

          <button
            onClick={() => setRankingType('ASSIST')}
            id="tab-ranking-assistencias"
            className={`py-2.5 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              rankingType === 'ASSIST'
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-950/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-base">👟</span>
            <span className="tracking-wide uppercase">Ranking de Assistências</span>
          </button>
        </div>

        {/* Scope Selector: Temporada, Mensal, Rodada */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => {
                setScope('SEASON');
                if (!selectedSeasonId && currentSeason) {
                  setSelectedSeasonId(currentSeason.id);
                }
              }}
              id="scope-season"
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                scope === 'SEASON'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Temporada
            </button>
            <button
              onClick={() => setScope('MONTH')}
              id="scope-month"
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                scope === 'MONTH'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => {
                setScope('MATCH');
                if (!selectedMatchId && finalizedMatches.length > 0) {
                  setSelectedMatchId(finalizedMatches[0].id);
                }
              }}
              id="scope-match"
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                scope === 'MATCH'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Rodada
            </button>
          </div>

          {/* Sub-selectors for Month / Year / Rodada */}
          {scope === 'MONTH' && (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="text-xs font-semibold py-1.5 px-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {monthNames.map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-xs font-semibold py-1.5 px-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === 'SEASON' && (
            <div className="flex items-center gap-1.5">
              {seasons.length === 0 ? (
                <span className="text-xs text-slate-500 italic">Nenhuma temporada iniciada ainda.</span>
              ) : (
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
              )}
            </div>
          )}

          {scope === 'MATCH' && (
            <div className="flex items-center gap-1.5">
              {finalizedMatches.length === 0 ? (
                <span className="text-xs text-slate-500 italic">Nenhuma rodada finalizada ainda.</span>
              ) : (
                <select
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  className="text-xs font-semibold py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {finalizedMatches.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.date.split('-').reverse().join('/')}{m.time ? ` (${m.time})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Busca por nome do jogador */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar jogador pelo nome..."
          id="input-search-ranking-player"
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

      {/* Ranking Title & Filter Label */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-xs sm:text-sm font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>
              {rankingType === 'GOAL' ? '⚽ Artilharia' : '👟 Garçons (Assistências)'} — {rankingData.scopeLabel}
            </span>
          </h3>
          <span className="text-[11px] text-slate-500">
            {searchQuery.trim()
              ? `${displayedItems.length} de ${rankingData.totalCount} jogadores encontrados`
              : rankingData.totalCount > 10
              ? `Exibindo ${displayedItems.length} de ${rankingData.totalCount} jogadores`
              : `${rankingData.totalCount} jogadores classificados`}
          </span>
        </div>

        {/* Tie-breaker rule indicator as per Section 27 */}
        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
          Desempate: Menos rodadas (maior média)
        </span>
      </div>

      {/* Ranking List Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {displayedItems.length === 0 ? (
          <div className="text-center py-12 p-6">
            <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">
              {searchQuery.trim()
                ? `Nenhum jogador encontrado com "${searchQuery}".`
                : 'Nenhuma estatística registrada no período selecionado.'}
            </p>
            {!searchQuery.trim() && (
              <p className="text-xs text-slate-500 mt-1">
                Finalize uma rodada para que seus resultados apareçam aqui.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {displayedItems.map((item) => {
              const isFirst = item.position === 1;

              return (
                <button
                  key={item.player.id}
                  onClick={() => onSelectPlayer(item.player.id)}
                  id={`ranking-row-${item.player.id}`}
                  className="w-full px-3.5 sm:px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-800/60 active:bg-slate-800 transition group"
                >
                  {/* Left: Position & Player */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Position Badge — mesmo estilo da tela inicial */}
                    <span
                      className={`w-8 h-8 rounded-xl text-sm font-black flex items-center justify-center shrink-0 ${getRankBadgeClass(item.position - 1)}`}
                    >
                      {item.position}º
                    </span>

                    {/* Player Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm sm:text-base text-white group-hover:text-emerald-400 transition truncate">
                          {item.player.displayName}
                        </span>
                        {isFirst && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 shrink-0">
                            Líder
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{item.matchesPlayed} {item.matchesPlayed === 1 ? 'rodada' : 'rodadas'}</span>
                        <span className="text-slate-600">•</span>
                        <span>Média {item.average.toFixed(2)} / rodada</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: Score Count */}
                  <div className="text-right shrink-0">
                    <span
                      className={`text-lg sm:text-xl font-black ${
                        rankingType === 'GOAL' ? 'text-emerald-400' : 'text-blue-400'
                      }`}
                    >
                      {item.count}
                    </span>
                    <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      {rankingType === 'GOAL'
                        ? item.count === 1 ? 'gol' : 'gols'
                        : item.count === 1 ? 'assist' : 'assists'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Section 27: Top 10 Limit with Toggle to View All */}
        {hasMoreThan10 && (
          <div className="p-3 bg-slate-950/60 border-t border-slate-800 text-center">
            <button
              onClick={() => setShowFullList(!showFullList)}
              id="btn-toggle-full-ranking"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition py-1.5 px-3 rounded-lg hover:bg-emerald-950/30"
            >
              <span>
                {showFullList
                  ? 'Exibir apenas os 10 primeiros'
                  : `Ver todos os ${rankingData.totalCount} jogadores classificados`}
              </span>
              {showFullList ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-[11px] text-slate-500">
          💡 Toque no nome de qualquer jogador para ver suas médias e histórico detalhado partida a partida.
        </p>
      </div>
    </div>
  );
};
