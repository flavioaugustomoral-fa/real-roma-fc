import { useEffect, useState } from 'react';
import { peladaStore, StorageData } from '../services/storage';

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

  const loginAdmin = (pin: string): boolean => {
    if (peladaStore.verifyAdminPin(pin)) {
      toggleAdmin(true);
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    toggleAdmin(false);
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
