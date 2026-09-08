import React, { useState } from 'react';
import { Shield, ShieldAlert, KeyRound, LogOut, Check } from 'lucide-react';
import { usePeladaStore } from '../hooks/usePeladaStore';
import { PWAInstallButton } from './PWAInstallButton';
import { getEffectiveLogoUrl, DEFAULT_PELADA_LOGO } from '../assets/logo';

interface HeaderProps {
  onOpenNewMatch?: () => void;
  onNavigateToAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewMatch, onNavigateToAdmin }) => {
  const { settings, isAdmin, loginAdmin, logoutAdmin } = usePeladaStore();
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAdmin(pinInput.trim())) {
      setShowPinModal(false);
      setPinInput('');
      setPinError(false);
      if (onNavigateToAdmin) onNavigateToAdmin();
    } else {
      setPinError(true);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-4 py-2.5">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* Pelada Brand & Logo */}
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={getEffectiveLogoUrl(settings.logoUrl)}
            alt="Logo Pelada"
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-xl object-contain drop-shadow"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== DEFAULT_PELADA_LOGO) {
                target.src = DEFAULT_PELADA_LOGO;
              }
            }}
          />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight truncate flex items-center gap-1.5">
              <span>{settings.peladaName || 'Pelada do Real Roma F.C.'}</span>
            </h1>
            <p className="text-[11px] text-emerald-400 font-medium truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              {settings.venueName || 'Gestão Oficial'}
            </p>
          </div>
        </div>

        {/* Right side controls: PWA button & Admin toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <PWAInstallButton compact />

          {isAdmin ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Admin Ativo</span>
              </span>
              <button
                onClick={logoutAdmin}
                id="btn-logout-admin"
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                title="Sair do modo administrador"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setShowPinModal(true);
                setPinError(false);
              }}
              id="btn-login-admin-modal"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
              title="Acessar como Administrador"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              <span>Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin PIN Login Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-center text-white mb-1">Acesso do Administrador</h3>
            <p className="text-xs text-center text-slate-400 mb-5">
              Digite o PIN de administrador para criar peladas, finalizar e fazer correções oficiais.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
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
                  placeholder="PIN de 4 dígitos (padrão: 1234)"
                  autoFocus
                  className="w-full text-center text-xl tracking-[0.3em] font-mono py-3 px-4 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                />
                {pinError && (
                  <p className="text-xs text-rose-400 text-center mt-2 font-medium">
                    PIN incorreto. Tente "1234" ou consulte as configurações.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white shadow-md shadow-emerald-950/40 transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
