import React, { useEffect, useRef, useState } from 'react';
import { BottomNav, NavTab } from './components/BottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { HomeView } from './components/HomeView';
import { MatchLiveView } from './components/MatchLiveView';
import { GameLiveView } from './components/GameLiveView';
import { RankingsView } from './components/RankingsView';
import { HistoryView } from './components/HistoryView';
import { AdminView } from './components/AdminView';
import { CreateMatchModal } from './components/CreateMatchModal';
import { PlayerModal } from './components/PlayerModal';
import { usePeladaStore } from './hooks/usePeladaStore';
import { Play, Plus, Calendar, Shield } from 'lucide-react';
import { Match } from './types/pelada';

export default function App() {
  const { activeMatch, isAdmin } = usePeladaStore();
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // When a match is created or chosen to play
  const [matchForLiveView, setMatchForLiveView] = useState<Match | null>(null);
  // Partida aberta dentro da rodada (tela de 2 colunas com Registrar)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  // Aba ativa da tela da Rodada (Times/Partidas/Ranking) — fica aqui, e não
  // dentro do MatchLiveView, porque abrir uma Partida troca pra GameLiveView
  // e desmonta o MatchLiveView; se o estado fosse local ele resetaria pra
  // "Times" toda vez que o usuário voltasse da Partida.
  const [matchSubTab, setMatchSubTab] = useState<'times' | 'partidas' | 'ranking'>('times');

  // Determine which match to display on the "Rodada" tab. Once a match is
  // finalized it's no longer IN_PROGRESS/DRAFT, so activeMatch stops
  // returning it and the tab falls back to "Nenhuma Rodada Ativa" — no
  // stale finalized match lingers there inviting new lançamentos.
  const currentMatchToDisplay = matchForLiveView || activeMatch || null;

  // Integração com o botão físico/gesto de "voltar" do celular. Como esse é
  // um app de página única, trocar de aba (currentTab) ou abrir uma
  // Partida/modal nunca mexe no histórico do navegador — pro Android, isso
  // significa "nenhum histórico", e apertar voltar simplesmente fecha a
  // aba/app em vez de navegar dentro do app. Por isso, toda mudança nesses
  // quatro estados de navegação empurra uma entrada nova no histórico; ao
  // apertar voltar, o navegador consome essa entrada primeiro (isPoppingRef
  // evita empurrar de novo) e só fecha o app de verdade quando não sobrar
  // mais nada pra "desfazer" (ou seja, já na Home, sem nada aberto).
  const isPoppingNavRef = useRef(false);
  const navHistoryInitializedRef = useRef(false);

  useEffect(() => {
    const state = {
      tab: currentTab,
      gameId: selectedGameId,
      playerId: selectedPlayerId,
      createMatchOpen: isCreateMatchOpen,
    };
    if (!navHistoryInitializedRef.current) {
      navHistoryInitializedRef.current = true;
      window.history.replaceState(state, '');
      return;
    }
    if (isPoppingNavRef.current) {
      isPoppingNavRef.current = false;
      return;
    }
    window.history.pushState(state, '');
  }, [currentTab, selectedGameId, selectedPlayerId, isCreateMatchOpen]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const s = (e.state as {
        tab?: NavTab;
        gameId?: string | null;
        playerId?: string | null;
        createMatchOpen?: boolean;
      } | null) || {};
      isPoppingNavRef.current = true;
      setCurrentTab(s.tab || 'home');
      setSelectedGameId(s.gameId || null);
      setSelectedPlayerId(s.playerId || null);
      setIsCreateMatchOpen(s.createMatchOpen || false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleMatchCreatedSuccess = (matchId: string) => {
    setIsCreateMatchOpen(false);
    setSelectedGameId(null);
    setMatchSubTab('times');
    setCurrentTab('match');
  };

  const handleSelectMatchToPlay = (match: Match) => {
    setMatchForLiveView(match);
    setSelectedGameId(null);
    setMatchSubTab('times');
    setCurrentTab('match');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Offline Alert */}
      <OfflineIndicator />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-4 md:p-6">
        {currentTab === 'home' && (
          <HomeView
            onNavigate={(tab) => setCurrentTab(tab)}
            onSelectPlayer={(id) => setSelectedPlayerId(id)}
          />
        )}

        {currentTab === 'match' && (
          <div>
            {currentMatchToDisplay ? (
              selectedGameId ? (
                <GameLiveView
                  gameId={selectedGameId}
                  matchId={currentMatchToDisplay.id}
                  onBack={() => setSelectedGameId(null)}
                  onViewPlayerStats={(id) => setSelectedPlayerId(id)}
                />
              ) : (
                <MatchLiveView
                  match={currentMatchToDisplay}
                  activeSubTab={matchSubTab}
                  onChangeSubTab={setMatchSubTab}
                  onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
                  onViewPlayerStats={(id) => setSelectedPlayerId(id)}
                  onOpenGame={(gameId) => setSelectedGameId(gameId)}
                  onMatchDeleted={() => {
                    setMatchForLiveView(null);
                    setSelectedGameId(null);
                    setMatchSubTab('times');
                    setCurrentTab('home');
                  }}
                />
              )
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-md mx-auto my-12 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                  <Play className="w-8 h-8 fill-emerald-400" />
                </div>
                <h2 className="text-xl font-black text-white mb-2">Nenhuma Rodada Ativa</h2>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Para começar, crie uma rodada e monte os times dentro dela.
                </p>

                {isAdmin ? (
                  <button
                    onClick={() => setIsCreateMatchOpen(true)}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar Nova Rodada</span>
                  </button>
                ) : (
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400">
                    Aguarde o administrador iniciar a rodada do dia para liberar os lançamentos.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentTab === 'rankings' && (
          <RankingsView
            onSelectPlayer={(id) => setSelectedPlayerId(id)}
          />
        )}

        {currentTab === 'history' && (
          <HistoryView
            onSelectMatchToPlay={handleSelectMatchToPlay}
            onViewPlayerStats={(id) => setSelectedPlayerId(id)}
          />
        )}

        {currentTab === 'admin' && (
          <AdminView
            onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
          />
        )}
      </main>

      {/* Bottom Mobile-First Navigation Bar */}
      <BottomNav
        activeTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          if (tab === 'match') {
            // Reset override if active match exists
            if (activeMatch) setMatchForLiveView(null);
            setSelectedGameId(null);
          }
        }}
      />

      {/* Global Modals */}
      <CreateMatchModal
        isOpen={isCreateMatchOpen}
        onClose={() => setIsCreateMatchOpen(false)}
        onSuccess={handleMatchCreatedSuccess}
      />

      <PlayerModal
        playerId={selectedPlayerId}
        onClose={() => setSelectedPlayerId(null)}
      />
    </div>
  );
}
