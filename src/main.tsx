import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Registra o service worker e força uma checagem de atualização a cada
// minuto (e sempre que a aba volta a ficar visível). Sem isso, quem deixa
// o app aberto ou só reabre pelo ícone da tela inicial pode nunca notar
// que existe uma versão mais nova publicada — o app fica "preso" numa
// versão antiga até fechar tudo e limpar o cache manualmente.
if (typeof window !== 'undefined') {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const checkForUpdate = () => registration.update().catch(() => {});
      setInterval(checkForUpdate, 60_000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    },
    onNeedRefresh() {
      updateSW(true);
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
