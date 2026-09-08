import React, { useState } from 'react';
import { BottomNav, NavTab } from './components/BottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { HomeView } from './components/HomeView';
import { MatchLiveView } from './components/MatchLiveView';
import { RankingsView } from './components/RankingsView';
import { HistoryView } from './components/HistoryView';
import { AdminView } from './components/AdminView';
import { CreateMatchModal } from './components/CreateMatchModal';
import { PlayerModal } from './components/PlayerModal';
import { usePeladaStore } from './hooks/usePeladaStore';
import { Play, Plus, Calendar, Shield } from 'lucide-react';
import { Match } from './types/pelada';

export default function App() {
  const { activeMatch, matches, isAdmin } = usePeladaStore();
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // When a match is created or chosen to play
  const [matchForLiveView, setMatchForLiveView] = useState<Match | null>(null);

  // Determine which match to display on the "Pelada" tab
  const currentMatchToDisplay = matchForLiveView || activeMatch || (matches.length > 0 ? matches[0] : null);

  const handleMatchCreatedSuccess = (matchId: string) => {
    setIsCreateMatchOpen(false);
    setCurrentTab('match');
  };

  const handleSelectMatchToPlay = (match: Match) => {
    setMatchForLiveView(match);
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
            onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
            onSelectPlayer={(id) => setSelectedPlayerId(id)}
          />
        )}

        {currentTab === 'match' && (
          <div>
            {currentMatchToDisplay ? (
              <MatchLiveView
                match={currentMatchToDisplay}
                onOpenCreateMatch={() => setIsCreateMatchOpen(true)}
                onViewPlayerStats={(id) => setSelectedPlayerId(id)}
              />
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-md mx-auto my-12 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                  <Play className="w-8 h-8 fill-emerald-400" />
                </div>
                <h2 className="text-xl font-black text-white mb-2">Nenhuma Pelada Ativa</h2>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Para começar a registrar gols e assistências em tempo real, crie uma nova pelada colando a lista de participantes.
                </p>

                {isAdmin ? (
                  <button
                    onClick={() => setIsCreateMatchOpen(true)}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar Nova Pelada</span>
                  </button>
                ) : (
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400">
                    Aguarde o administrador iniciar a pelada do dia para liberar os lançamentos.
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
