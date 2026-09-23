import React, { useState, useMemo } from 'react';
import { ArrowLeft, Minus, Trash2, X } from 'lucide-react';
import { usePeladaStore } from '../hooks/usePeladaStore';

interface GameLiveViewProps {
  gameId: string;
  matchId: string;
  onBack: () => void;
  onViewPlayerStats?: (playerId: string) => void;
}

export const GameLiveView: React.FC<GameLiveViewProps> = ({
  gameId,
  matchId,
  onBack,
  onViewPlayerStats,
}) => {
  const { data, store, isAdmin } = usePeladaStore();
  const [registerFor, setRegisterFor] = useState<{ playerId: string; playerName: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const game = useMemo(() => store.getGameById(gameId), [store, gameId, data]);
  const rows = useMemo(() => store.getGamePlayers(gameId), [store, gameId, data]);
  const match = useMemo(() => store.getMatchById(matchId), [store, matchId, data]);

  const teamAGoals = rows.teamAPlayers.reduce((sum, p) => sum + p.goals, 0);
  const teamBGoals = rows.teamBPlayers.reduce((sum, p) => sum + p.goals, 0);
  const canRegister = isAdmin && match?.status === 'IN_PROGRESS';

  const triggerToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  };

  if (!game) {
    return (
      <div className="text-center py-12 bg-slate-900/60 rounded-2xl border border-slate-800 p-6">
        <p className="text-sm text-slate-400 mb-4">Esta partida não existe mais.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200 transition"
        >
          Voltar para a Rodada
        </button>
      </div>
    );
  }

  const handleRegister = (type: 'GOAL' | 'ASSIST') => {
    if (!registerFor) return;
    store.addGameStatEvent({
      gameId,
      matchId,
      playerId: registerFor.playerId,
      type,
      createdBy: 'Administrador',
    });
    triggerToast(type === 'GOAL' ? `⚽ Gol registrado para ${registerFor.playerName}!` : `👟 Assistência registrada para ${registerFor.playerName}!`);
    setRegisterFor(null);
  };

  const handleRemoveLast = (playerId: string, playerName: string, type: 'GOAL' | 'ASSIST') => {
    const removed = store.removeLastPlayerEvent({
      matchId,
      playerId,
      type,
      gameId,
      performedBy: 'Administrador',
    });
    if (removed) {
      triggerToast(`Removido 1 ${type === 'GOAL' ? 'gol' : 'assistência'} de ${playerName}`);
    }
  };

  const handleDeleteGame = () => {
    store.deleteGame(gameId, 'Administrador');
    setShowDeleteModal(false);
    onBack();
  };

  const renderTeamColumn = (
    teamName: string,
    players: Array<{ player: { id: string; displayName: string }; goals: number; assists: number }>
  ) => (
    <div className="space-y-2 flex-1 min-w-0">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 text-center truncate px-1">
        {teamName}
      </h3>
      {players.length === 0 ? (
        <p className="text-[11px] text-slate-500 italic text-center py-4">Sem jogadores</p>
      ) : (
        players.map(({ player, goals, assists }) => (
          <div
            key={player.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-sm"
          >
            <button
              onClick={() => onViewPlayerStats?.(player.id)}
              className="text-left w-full mb-1.5"
              title="Ver perfil e estatísticas do jogador"
            >
              <span className="text-xs sm:text-sm font-black text-white hover:text-emerald-400 tracking-tight transition uppercase block truncate">
                {player.displayName}
              </span>
            </button>

            <div className="flex items-center gap-1.5 text-[11px] mb-1.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ⚽ {goals}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg font-black bg-blue-500/15 text-blue-400 border border-blue-500/30">
                👟 {assists}
              </span>
            </div>

            {canRegister && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRegisterFor({ playerId: player.id, playerName: player.displayName })}
                  id={`btn-register-${player.id}`}
                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold text-white transition"
                >
                  Registrar
                </button>
                {(goals > 0 || assists > 0) && (
                  <div className="flex items-center gap-0.5">
                    {goals > 0 && (
                      <button
                        onClick={() => handleRemoveLast(player.id, player.displayName, 'GOAL')}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 border border-slate-700 transition"
                        title="Remover 1 gol"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-20">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-150">
          <div className="px-4 py-2 rounded-xl shadow-xl text-xs font-bold bg-emerald-600 text-white border border-emerald-400">
            {toast}
          </div>
        </div>
      )}

      {/* Header / Scoreboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para a Rodada
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800/60 transition"
              title="Excluir Partida"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <span className="text-sm sm:text-base font-black text-white text-right flex-1 truncate">
            {rows.teamA?.name || '—'}
          </span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono shrink-0">
            {teamAGoals} x {teamBGoals}
          </span>
          <span className="text-sm sm:text-base font-black text-white flex-1 truncate">
            {rows.teamB?.name || '—'}
          </span>
        </div>

        {!canRegister && (
          <p className="text-center text-[11px] text-slate-500 italic mt-3">
            {isAdmin ? 'Só é possível registrar lançamentos com a rodada em andamento.' : 'Acompanhando ao vivo — lançamentos feitos pelo Administrador.'}
          </p>
        )}
      </div>

      {/* 2 colunas */}
      <div className="flex gap-3">
        {renderTeamColumn(rows.teamA?.name || 'Time A', rows.teamAPlayers)}
        {renderTeamColumn(rows.teamB?.name || 'Time B', rows.teamBPlayers)}
      </div>

      {/* Registrar: escolher Gol ou Assistência */}
      {registerFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xs rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Registrar para {registerFor.playerName}</h3>
              <button onClick={() => setRegisterFor(null)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleRegister('GOAL')}
                id="btn-register-goal"
                className="py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.97] transition-all text-white font-extrabold text-sm flex flex-col items-center gap-1.5 shadow-lg shadow-emerald-950/60"
              >
                <span className="text-2xl">⚽</span>
                <span>Gol</span>
              </button>
              <button
                onClick={() => handleRegister('ASSIST')}
                id="btn-register-assist"
                className="py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 active:scale-[0.97] transition-all text-white font-extrabold text-sm flex flex-col items-center gap-1.5 shadow-lg shadow-blue-950/60"
              >
                <span className="text-2xl">👟</span>
                <span>Assistência</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão da partida */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-center text-white mb-1">Excluir Partida?</h3>
            <p className="text-xs text-center text-slate-400 mb-5 leading-relaxed">
              A partida e todos os seus lançamentos de gols e assistências serão excluídos permanentemente.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteGame}
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
