import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  Plus,
  RefreshCw,
  FileCode,
  Check,
  AlertCircle,
  History,
  Palette,
  Upload,
  Copy,
  CheckCheck
} from 'lucide-react';
import { usePeladaStore } from '../hooks/usePeladaStore';
import { getEffectiveLogoUrl, DEFAULT_PELADA_LOGO } from '../assets/logo';

interface AdminViewProps {
  onOpenCreateMatch: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onOpenCreateMatch }) => {
  const { store, settings, auditLogs, isAdmin, loginAdmin, logoutAdmin } = usePeladaStore();

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Settings form states
  const [peladaName, setPeladaName] = useState(settings.peladaName);
  const [venueName, setVenueName] = useState(settings.venueName);
  const [newPin, setNewPin] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Logo file upload / url
  const [customLogoUrl, setCustomLogoUrl] = useState(settings.logoUrl);

  // Supabase SQL Viewer
  const [showSqlViewer, setShowSqlViewer] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAdmin(pinInput.trim())) {
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

  const handleCopySql = () => {
    fetch('/supabase_schema.sql')
      .then(res => res.text())
      .then(text => {
        navigator.clipboard.writeText(text);
        setSqlCopied(true);
        setTimeout(() => setSqlCopied(false), 2500);
      })
      .catch(() => {
        setSqlCopied(false);
      });
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
            Área restrita para o administrador criar peladas, oficializar resultados, corrigir súmulas e gerenciar a identidade da pelada.
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
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-lg shadow-emerald-950/40 transition"
            >
              Acessar Painel
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

      {/* Primary Actions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Create Match Quick Card */}
        <button
          onClick={onOpenCreateMatch}
          id="btn-admin-new-match"
          className="bg-slate-900 hover:bg-slate-850 active:scale-[0.99] border border-emerald-500/40 rounded-2xl p-4 text-left shadow-lg transition flex items-center gap-3.5 group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-950/50 group-hover:scale-105 transition">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white group-hover:text-emerald-400 transition">
              Criar Nova Pelada
            </h3>
            <p className="text-xs text-slate-400">
              Cole a lista de participantes e inicie a partida
            </p>
          </div>
        </button>

        {/* Supabase Schema Export Card */}
        <button
          onClick={() => setShowSqlViewer(true)}
          id="btn-admin-supabase-schema"
          className="bg-slate-900 hover:bg-slate-850 active:scale-[0.99] border border-slate-800 rounded-2xl p-4 text-left shadow-md transition flex items-center gap-3.5 group"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white group-hover:text-emerald-400 transition">
              Script Supabase / SQL
            </h3>
            <p className="text-xs text-slate-400">
              Ver e exportar DDL oficial com RLS para PostgreSQL
            </p>
          </div>
        </button>
      </div>

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
                  O logo é exibido no cabeçalho, início, tela da pelada e rankings.
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

      {/* Audit Logs Section - Section 17 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          <span>Auditoria Administrativa (Audit Logs)</span>
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Histórico de finalizações, correções e alterações do sistema
        </p>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">Nenhum registro de auditoria.</p>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="text-xs p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-emerald-400 font-mono text-[11px] block">
                    {log.action}
                  </span>
                  <p className="text-slate-300 text-xs mt-0.5">{log.details}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {new Date(log.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-[10px] text-slate-400">{log.performedBy}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset Demo Data Card */}
      <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-slate-300 block">Restaurar Dados Iniciais</span>
          <p className="text-[11px] text-slate-500">
            Restaura o histórico de exemplo (peladas de agosto/setembro com João, Pedro e Carlos).
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm('Deseja restaurar as peladas e rankings padrão de exemplo?')) {
              store.resetToDefaultSeed();
            }
          }}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1 shrink-0 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Restaurar</span>
        </button>
      </div>

      {/* Supabase SQL Modal */}
      {showSqlViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0 mb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Schema Supabase & RLS (PostgreSQL)</h3>
              </div>
              <button
                onClick={() => setShowSqlViewer(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-3 leading-relaxed shrink-0">
              Copie este script SQL para criar no Supabase todas as tabelas (<code>players</code>, <code>matches</code>, <code>match_players</code>, <code>stat_events</code>, <code>audit_logs</code>), índices, views e as regras de segurança Row Level Security (RLS).
            </p>

            <pre className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-xl text-[11px] font-mono text-emerald-300/90 border border-slate-800 select-all">
              {`-- Copiado diretamente do arquivo /supabase_schema.sql
-- Para ver o arquivo completo, acesse o diretório raiz do projeto.`}
            </pre>

            <div className="flex justify-between items-center pt-3 mt-2 border-t border-slate-800 shrink-0">
              <button
                onClick={handleCopySql}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 transition"
              >
                {sqlCopied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{sqlCopied ? 'Copiado para a Área de Transferência!' : 'Copiar SQL Completo'}</span>
              </button>
              <button
                onClick={() => setShowSqlViewer(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
