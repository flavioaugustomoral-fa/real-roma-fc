import React, { useState, useMemo } from 'react';
import { X, CalendarPlus, Play, Calendar, Clock } from 'lucide-react';
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
  const [notes, setNotes] = useState('');
  const [startImmediately, setStartImmediately] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const res = store.createMatch({
      date,
      time,
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
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Nova Rodada</h2>
              <p className="text-xs text-slate-400">Depois de criar, monte os times dentro da rodada</p>
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
                Data da Rodada
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observações (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Arena Soccer Club, quadra 2"
              className="w-full text-sm py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

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
              Iniciar a rodada imediatamente (liberar lançamentos)
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
              id="btn-confirm-create-match"
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{startImmediately ? 'Criar e Iniciar Rodada' : 'Salvar Rascunho'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
