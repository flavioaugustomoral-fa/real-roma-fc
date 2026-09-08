import React from 'react';
import { Home, Trophy, History, Shield, Play } from 'lucide-react';
import { usePeladaStore } from '../hooks/usePeladaStore';

export type NavTab = 'home' | 'match' | 'rankings' | 'history' | 'admin';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const { activeMatch, isAdmin } = usePeladaStore();
  const isMatchLive = activeMatch?.status === 'IN_PROGRESS';

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | boolean;
    badgeColor?: string;
  }> = [
    { id: 'home', label: 'Início', icon: Home },
    {
      id: 'match',
      label: 'Pelada',
      icon: Play,
      badge: isMatchLive ? 'AO VIVO' : undefined,
      badgeColor: 'bg-rose-500 animate-pulse',
    },
    { id: 'rankings', label: 'Rankings', icon: Trophy },
    { id: 'history', label: 'Histórico', icon: History },
    {
      id: 'admin',
      label: 'Admin',
      icon: Shield,
      badge: isAdmin ? 'ON' : undefined,
      badgeColor: 'bg-amber-500',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 max-w-4xl mx-auto pb-safe">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              id={`nav-tab-${item.id}`}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-150 min-w-[58px] ${
                isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`} />
                {item.badge && (
                  <span
                    className={`absolute -top-1.5 -right-3 text-[9px] font-black text-white px-1 py-0.2 rounded-full shadow-sm ${
                      item.badgeColor || 'bg-emerald-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 tracking-tight ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1 w-4 h-1 bg-emerald-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
