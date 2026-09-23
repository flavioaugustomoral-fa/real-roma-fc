import React, { useMemo, useState } from 'react';
import {
  Shield,
  Plus,
  Check,
  Palette,
  Upload,
  CalendarClock,
  Pencil,
  X,
} from 'lucide-react';
import { usePeladaStore } from '../hooks/usePeladaStore';
import { getEffectiveLogoUrl, DEFAULT_PELADA_LOGO } from '../assets/logo';

interface AdminViewProps {
  onOpenCreateMatch: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onOpenCreateMatch }) => {
  const { data, store, settings, isAdmin, loginAdmin, logoutAdmin } = usePeladaStore();

  const currentSeason = useMemo(() => store.getCurrentSeason(), [store, data]);
  const seasonMatchCount = useMemo(() => {
    if (!currentSeason) return 0;
    return data.matches.filter(m =>
      m.status === 'FINALIZED' &&
      m.date >= currentSeason.startDate &&
      (currentSeason.endDate === null || m.date <= currentSeason.endDate)
    ).length;
  }, [data.matches, currentSeason]);

  const [showFinalizeSeason, setShowFinalizeSeason] = useState(false);
  const [nextSeasonLabel, setNextSeasonLabel] = useState('');

  const handleFinalizeSeason = () => {
    store.finalizeSeason(nextSeasonLabel);
    setNextSeasonLabel('');
    setShowFinalizeSeason(false);
  };

  const [renamingSeason, setRenamingSeason] = useState(false);
  const [seasonNameDraft, setSeasonNameDraft] = useState('');

  const handleRenameSeason = () => {
    if (!currentSeason) return;
    const res = store.renameSeason(currentSeason.id, seasonNameDraft);
    if (res.success) {
      setRenamingSeason(false);
    }
  };

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Settings form states
  const [peladaName, setPeladaName] = useState(settings.peladaName);
  const [venueName, setVenueName] = useState(settings.venueName);
  const [instagramHandle, setInstagramHandle] = useState(settings.instagramHandle || '');
  const [newPin, setNewPin] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Logo file upload / url
  const [customLogoUrl, setCustomLogoUrl] = useState(settings.logoUrl);

  const [checkingPin, setCheckingPin] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingPin(true);
    const ok = await loginAdmin(pinInput.trim());
    setCheckingPin(false);
    if (ok) {
      setPinError(false);
      setPinInput('');
    } else {
      setPinError(true);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateSettings({
      peladaName: peladaName.trim() || 'Pelada do Real Roma F.C.',
      venueName: venueName.trim() || 'Arena Oficial',
      logoUrl: customLogoUrl.trim() ? getEffectiveLogoUrl(customLogoUrl.trim()) : DEFAULT_PELADA_LOGO,
      instagramHandle: instagramHandle.trim().replace(/^@+/, ''),
      ...(newPin.trim() ? { adminPin: newPin.trim() } : {}),
    });
    setNewPin('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCustomLogoUrl(result);
      store.updateSettings({ logoUrl: result });
    };
    reader.readAsDataURL(file);
  };

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-10 px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-black text-white mb-2">Área Administrativa</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Área restrita para o administrador criar rodadas, oficializar resultados, corrigir súmulas e gerenciar a identidade da pelada.
          </p>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="Digite o PIN (padrão: 1234)"
                className="w-full text-center text-xl tracking-[0.3em] font-mono py-3 px-4 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
              {pinError && (
                <p className="text-xs text-rose-400 text-center mt-2 font-medium">
                  PIN incorreto. Tente "1234" ou consulte o organizador.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={checkingPin}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 font-bold text-white shadow-lg shadow-emerald-950/40 transition"
            >
              {checkingPin ? 'Verificando...' : 'Acessar Painel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Admin Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Painel do Administrador</h2>
              <span className="text-xs text-amber-400 font-semibold">Acesso Total Liberado</span>
            </div>
          </div>

          <button
            onClick={logoutAdmin}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            Sair do Admin
          </button>
        </div>
      </div>

      {/* Create Match Quick Card */}
      <button
        onClick={onOpenCreateMatch}
        id="btn-admin-new-match"
        className="w-full bg-slate-900 hover:bg-slate-850 active:scale-[0.99] border border-emerald-500/40 rounded-2xl p-4 text-left shadow-lg transition flex items-center gap-3.5 group"
      >
        <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-950/50 group-hover:scale-105 transition">
          <Plus className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-white group-hover:text-emerald-400 transition">
            Criar Nova Rodada
          </h3>
          <p className="text-xs text-slate-400">
            Depois monte os times e as partidas dentro dela
          </p>
        </div>
      </button>

      {/* Identity & Customization Form - Section 22 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <Palette className="w-4 h-4 text-emerald-400" />
          <span>Identidade Visual & Configurações da Pelada</span>
        </h3>

        <form onSubmit={handleSaveSettings} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Nome da Pelada / Grupo
              </label>
              <input
                type="text"
                value={peladaName}
                onChange={(e) => setPeladaName(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Local / Arena
              </label>
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Instagram do Time (opcional)
            </label>
            <div className="flex items-center rounded-xl bg-slate-950 border border-slate-700 focus-within:border-emerald-500 overflow-hidden">
              <span className="pl-2.5 pr-1 text-xs sm:text-sm text-slate-500 font-bold select-none">@</span>
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value.replace(/^@+/, ''))}
                placeholder="realromafc"
                className="w-full text-xs sm:text-sm py-2.5 pr-2.5 bg-transparent text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Logo preview and upload */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Logo da Pelada (Section 22)
            </label>
            <div className="flex items-center gap-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800">
              <img
                src={getEffectiveLogoUrl(customLogoUrl || settings.logoUrl)}
                alt="Logo Pelada"
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-xl object-contain shrink-0 drop-shadow"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== DEFAULT_PELADA_LOGO) {
                    target.src = DEFAULT_PELADA_LOGO;
                  }
                }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-white block truncate">
                  Escudo Oficial Atual
                </span>
                <p className="text-[11px] text-slate-500 truncate">
                  O logo é exibido no cabeçalho, início, tela da rodada e rankings.
                </p>
              </div>
              <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 shrink-0 transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Trocar Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* PIN change */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Alterar PIN de Administrador (opcional)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Digite um novo PIN numérico..."
              className="w-full text-xs sm:text-sm p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            {saveSuccess ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" />
                Configurações salvas com sucesso!
              </span>
            ) : <span />}

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow transition"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>

      {/* Temporada Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-emerald-400" />
          <span>Temporada</span>
        </h3>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {renamingSeason && currentSeason ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={seasonNameDraft}
                  onChange={(e) => setSeasonNameDraft(e.target.value)}
                  autoFocus
                  className="flex-1 min-w-0 text-sm font-bold py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleRenameSeason}
                  className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 transition"
                  title="Salvar"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRenamingSeason(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 transition"
                  title="Cancelar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-bold text-white truncate">
                  {currentSeason?.label || 'Nenhuma temporada aberta'}
                </span>
                {currentSeason && (
                  <button
                    onClick={() => {
                      setSeasonNameDraft(currentSeason.label);
                      setRenamingSeason(true);
                    }}
                    className="p-1 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-950/40 transition shrink-0"
                    title="Renomear temporada"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {currentSeason && !renamingSeason && (
              <p className="text-[11px] text-slate-500">
                Iniciada em {currentSeason.startDate.split('-').reverse().join('/')} · {seasonMatchCount} {seasonMatchCount === 1 ? 'rodada finalizada' : 'rodadas finalizadas'}
              </p>
            )}
          </div>
          {!showFinalizeSeason && !renamingSeason && currentSeason && (
            <button
              onClick={() => setShowFinalizeSeason(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 shrink-0 transition"
            >
              Finalizar Temporada
            </button>
          )}
        </div>

        {showFinalizeSeason && currentSeason && (
          <div className="mt-3.5 pt-3.5 border-t border-slate-800 space-y-2.5">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Isso encerra "{currentSeason.label}" hoje e abre uma nova temporada a partir de amanhã. Não há prazo fixo — finalize quando fizer sentido pro grupo.
            </p>
            <input
              type="text"
              value={nextSeasonLabel}
              onChange={(e) => setNextSeasonLabel(e.target.value)}
              placeholder={`Nome da nova temporada (padrão: Temporada ${store.getSeasons().length + 1})`}
              className="w-full text-xs sm:text-sm p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => {
                  setShowFinalizeSeason(false);
                  setNextSeasonLabel('');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalizeSeason}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow transition"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
