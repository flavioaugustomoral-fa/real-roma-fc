import { useEffect, useState } from 'react';
import { peladaStore, StorageData, clearSessionAdminPin } from '../services/storage';

export function usePeladaStore() {
  const [data, setData] = useState<StorageData>(() => peladaStore.getData());
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('pelada_is_admin') === 'true';
  });

  useEffect(() => {
    const unsubscribe = peladaStore.subscribe(() => {
      setData({ ...peladaStore.getData() });
    });
    return unsubscribe;
  }, []);

  const toggleAdmin = (status: boolean) => {
    setIsAdmin(status);
    if (typeof window !== 'undefined') {
      if (status) {
        sessionStorage.setItem('pelada_is_admin', 'true');
      } else {
        sessionStorage.removeItem('pelada_is_admin');
      }
    }
  };

  const loginAdmin = async (pin: string): Promise<boolean> => {
    const ok = await peladaStore.verifyAdminPin(pin);
    if (ok) {
      toggleAdmin(true);
    }
    return ok;
  };

  const logoutAdmin = () => {
    toggleAdmin(false);
    clearSessionAdminPin();
  };

  return {
    data,
    settings: data.settings,
    matches: data.matches,
    players: data.players,
    statEvents: data.statEvents,
    auditLogs: data.auditLogs,
    activeMatch: peladaStore.getActiveMatch(),
    isAdmin,
    loginAdmin,
    logoutAdmin,
    store: peladaStore,
  };
}
