@AGENTS.md

# Gestão de Pelada (Real Roma F.C.)

## O que é
PWA em português (BR) para gerir a pelada do Real Roma F.C.: rodadas, times, partidas, gols/assistências, rankings, temporadas, histórico e perfil de jogadores. Qualquer pessoa acompanha ao vivo; só o administrador (protegido por PIN) lança dados.

- Produção: https://gestao-pelada-app.vercel.app (Vercel, projeto `gestao-pelada-app`)
- Repositório: `github.com-flavioaugustomoral-fa:flavioaugustomoral-fa/real-roma-fc`

> Observação: o `AGENTS.md` importado acima fala de Next.js, mas este projeto é **Vite + React**. Ignore essa parte.

## Stack
Vite 6 + React 19 + TypeScript + Tailwind 4 + lucide-react + vite-plugin-pwa. Backend: Supabase (Postgres + Realtime + funções RPC). Deploy: Vercel.

## Como rodar
```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # tsc --noEmit
npm run build    # gera dist/
```
Precisa de um arquivo `.env` na raiz (não vai ao GitHub) com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (modelo em `.env.example`). Sem essas variáveis o app roda em modo local (sem Supabase) e o PIN padrão é 1234. Há também um `.env.local` antigo (`NEXT_PUBLIC_*`) que não é usado.

## Estrutura
- `src/App.tsx` — navegação por abas + integração com histórico do navegador (botão voltar do celular).
- `src/components/` — telas: Home, MatchLiveView (rodada), GameLiveView (partida), Rankings, History, Admin, modais.
- `src/services/storage.ts` — `PeladaStore`: estado local-first, atualiza a tela na hora e envia ao Supabase em segundo plano.
- `src/services/supabase.ts` — leitura, envio (RPCs) e realtime.
- `src/types/pelada.ts` — tipos.
- `supabase_schema.sql` — esquema de referência. **NUNCA rodar inteiro no Supabase: ele apaga os dados reais.**

## Decisões técnicas
- Toda escrita passa por funções Postgres `admin_*` (SECURITY DEFINER) que validam o PIN (`check_admin_pin`). Leituras são públicas (RLS).
- Mudanças de banco: escrever SQL **incremental**, entregar no chat, e só fazer deploy depois que o usuário confirmar que rodou. Antes de mudar a lista de parâmetros de uma função, fazer `DROP FUNCTION`.
- Tabelas novas usam leitura "tolerante" (aviso no console e lista vazia) caso a migração ainda não tenha sido rodada.
- Modelo: Rodada (`matches`) → Times (`teams`) → Partidas (`games`) → lançamentos (`stat_events` com `game_id`). Rodadas antigas sem times funcionam no "modo clássico".
- Temporadas por intervalo de datas (`seasons`; temporada aberta = sem data final), com ajustes únicos de estatísticas da era do papel (`season_stat_adjustments`).
- Substituições por partida (`game_substitutions`): valem só para aquela partida; o substituto vem de times que não jogam ela; escolhidas apenas na criação da partida.
- Classificação dos times: vitórias, empates, menos derrotas, saldo de gols, gols pró, nome.
- Ícones: bola ⚽ para gols; chuteira (PNG em `src/assets/icons/`) para assistências.
- Atualização entre aparelhos é automática via Supabase Realtime.

## Regras de trabalho do usuário
- Sempre responder em **português do Brasil**.
- Fluxo: implementar → o usuário testa → **só fazer `git push`/deploy depois do "pode subir"** (e, se houver SQL, depois de "Rodei o SQL, funcionou").
- Commits terminam com a linha `Co-Authored-By` indicada pelo ambiente.
- Nunca pedir nem digitar senhas/PIN; o PIN real do admin é desconhecido do Claude.
- Em caso de dúvida/ambiguidade, perguntar antes.
- Mostrar visual novo (ícones etc.) no chat antes de implementar quando for mudança de estética.

## Deploy
```bash
git push
npx vercel --prod --yes
```

## Estado atual (16/10/2026)
Tudo enviado ao GitHub e publicado na Vercel (último commit: substituição de jogador por partida). Não há pendências de código.

Última funcionalidade ainda **sem teste completo na interface**: criar partida com substituição e conferir na tela da partida o rótulo "Substituindo X". Vale testar com uma partida de teste.

## Próximas tarefas possíveis
- Permitir editar/desfazer substituição depois de criada a partida.
- Permitir substituto vindo de qualquer jogador da rodada, não só de times fora da partida.

## Caminho do projeto
- Computador antigo: `C:\Users\Flávio\Downloads\real-roma-fc`
- Notebook novo: `Documentos\real-roma-fc` (**atualizar aqui após a transferência**)
