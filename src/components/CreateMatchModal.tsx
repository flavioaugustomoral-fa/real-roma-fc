import React, { useState, useMemo } from 'react';
import { X, Users, AlertTriangle, CheckCircle2, Play, Calendar, Clock, Sparkles } from 'lucide-react';
import { parsePlayerListInput } from '../utils/normalization';
import { usePeladaStore } from '../hooks/usePeladaStore';

interface CreateMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (matchId: string) => void;
}

export const CreateMatchModal: React.FC<CreateMatchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { store } = usePeladaStore();

  const todayStr = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('19:30');
  const [rawText, setRawText] = useState('');
  const [notes, setNotes] = useState('');
  const [startImmediately, setStartImmediately] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live parse
  const parseResult = useMemo(() => {
    return parsePlayerListInput(rawText);
  }, [rawText]);

  // Check how many are recognized from history vs new
  const recognitionStats = useMemo(() => {
    const existingPlayers = store.getData().players;
    const existingMap = new Set(existingPlayers.map(p => p.normalizedName));

    let recognized = 0;
    let newPlayers = 0;

    parseResult.parsedPlayers.forEach(p => {
      if (existingMap.has(p.normalizedName)) {
        recognized++;
      } else {
        newPlayers++;
      }
    });

    return { recognized, newPlayers };
  }, [parseResult, store]);

  if (!isOpen) return null;

  const handlePasteExample = () => {
    const sample = `João
Pedro
Carlos
Lucas
Rafael
Marcelo
André
Bruno
Felipe
Marquinhos
Rodrigo
Gustavo
Mateus
Thiago`;
    setRawText(sample);
    setSubmitError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (parseResult.parsedPlayers.length === 0) {
      setSubmitError('Cole ou digite os nomes dos jogadores da pelada.');
      return;
    }

    if (parseResult.duplicates.length > 0) {
      setSubmitError(`Atenção: Nomes duplicados na lista: "${parseResult.duplicates.join(', ')}". Remova as repetições antes de iniciar.`);
      return;
    }

    const res = store.createMatch({
      date,
      time,
      rawPlayerList: rawText,
      notes,
      startImmediately,
      createdBy: 'Administrador',
    });

    if (res.error) {
      setSubmitError(res.error);
      return;
    }

    onSuccess(res.match.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Nova Pelada</h2>
              <p className="text-xs text-slate-400">Cole a lista de participantes da partida</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                Data da Pelada
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full text-sm font-medium py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Horário
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-sm font-medium py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Player List Textarea with quick tools */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Lista de Jogadores (1 por linha)
              </label>
              <button
                type="button"
                onClick={handlePasteExample}
                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
              >
                <Sparkles className="w-3 h-3" />
                Exemplo rápido
              </button>
            </div>

            <textarea
              rows={6}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setSubmitError(null);
              }}
              placeholder={`João\nPedro\nCarlos\nLucas\nRafael\nAndré\n...`}
              className="w-full font-mono text-sm leading-relaxed p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Live Analysis / Feedback Pill */}
          <div className="space-y-2">
            {/* Duplicate Warning */}
            {parseResult.duplicates.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Atenção: Duplicidade encontrada na lista!</span>
                  <p className="mt-0.5 text-rose-300">
                    Os seguintes nomes aparecem mais de uma vez: <strong>{parseResult.duplicates.join(', ')}</strong>.
                    Remova para prosseguir.
                  </p>
                </div>
              </div>
            )}

            {/* Success recognition badge */}
            {parseResult.parsedPlayers.length > 0 && parseResult.duplicates.length === 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold">
                    {parseResult.parsedPlayers.length} jogadores encontrados
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex gap-2">
                  <span>{recognitionStats.recognized} no histórico</span>
                  {recognitionStats.newPlayers > 0 && (
                    <span className="text-amber-400 font-medium">+{recognitionStats.newPlayers} novos</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview of numbered participants */}
          {parseResult.parsedPlayers.length > 0 && (
            <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-3 max-h-36 overflow-y-auto">
              <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                Conferência da Lista ({parseResult.parsedPlayers.length})
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-300">
                {parseResult.parsedPlayers.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 truncate">
                    <span className="text-slate-500 font-mono text-[11px] w-5 text-right">{idx + 1}.</span>
                    <span className="truncate font-medium">{item.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {submitError && (
            <p className="text-xs text-rose-400 font-medium bg-rose-950/30 p-2.5 rounded-lg border border-rose-800/50">
              {submitError}
            </p>
          )}

          {/* Start immediately toggle */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={startImmediately}
              onChange={(e) => setStartImmediately(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-700 focus:ring-emerald-500"
            />
            <span className="text-xs font-semibold text-slate-200">
              Iniciar a pelada imediatamente (liberar lançamentos)
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={parseResult.parsedPlayers.length === 0 || parseResult.duplicates.length > 0}
              id="btn-confirm-create-match"
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{startImmediately ? 'Iniciar Pelada' : 'Salvar Rascunho'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
