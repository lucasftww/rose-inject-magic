# 🏪 Royal Store

Loja online de cheats e contas para **Valorant**, **CS2**, **League of Legends**, **Fortnite**, **Minecraft** e mais.

## ⚙️ Tecnologias

| Tecnologia | Função |
|---|---|
| [Vite](https://vitejs.dev/) | Build tool & dev server |
| [React 18](https://react.dev/) | Framework de UI |
| [TypeScript](https://www.typescriptlang.org/) | Tipagem estática |
| [Tailwind CSS](https://tailwindcss.com/) | Estilização utilitária |
| [shadcn/ui](https://ui.shadcn.com/) | Componentes de interface |
| [Supabase](https://supabase.com/) | Backend (auth, banco de dados, storage) |
| [Framer Motion](https://www.framer.com/motion/) | Animações |
| [React Router](https://reactrouter.com/) | Navegação SPA |
| [React Query](https://tanstack.com/query) | Gerenciamento de dados server-side |
| [Recharts](https://recharts.org/) | Gráficos e dashboards |
| [Vitest](https://vitest.dev/) | Testes unitários |

## 🚀 Como rodar localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) **v20+** (recomendado **v24**, alinhado ao CI no GitHub) e npm — com [nvm](https://github.com/nvm-sh/nvm) ou [fnm](https://github.com/Schniz/fnm), usa o ficheiro **`.nvmrc`** na raiz (`nvm use` / `fnm use`).
- Conta no [Supabase](https://supabase.com/) com o projeto configurado

### Instalação

```sh
# 1. Clone o repositório
git clone https://github.com/lucasftww/rose-inject-magic.git
cd rose-inject-magic

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais do Supabase

# 4. Rode o servidor de desenvolvimento
npm run dev
```

O app estará disponível em `http://localhost:8080` (porta definida em `vite.config.ts`).

### Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build de produção |
| `npm run lint` | Análise estática com ESLint |
| `npm run typecheck` | Verificação TypeScript (`tsc --noEmit`) |
| `npm run test` | Rodar testes com Vitest |
| `npm run test:e2e` | Testes end-to-end (Playwright) contra `vite preview` — na primeira vez: `npm run test:e2e:install` |
| `npm run test:e2e:install` | Instala só o browser Chromium usado nos E2E |
| `npm run supabase:repair-migrations` | Alinhar histórico de migrações local/remoto (só metadados; requer `supabase link` + login) |
| `npm run knip` | Procurar exports/ficheiros não usados (shadcn e `types.ts` gerado ignorados em `knip.json`; incluído em `npm run check`) |
| `npm run check` | Pipeline completo: barrels LZT, `typecheck`, `lint`, `knip`, `test`, `build`, **E2E** (igual ao workflow **CI** no GitHub) |
| `npm run check:public` | Igual ao `check`, mas injeta `VITE_SUPABASE_*` públicos (fallback de `client.ts`) — útil sem `.env` local |

### Validação do projeto

O comando único recomendado é:

```sh
npm run check
```

Sem `.env` com URL/chave de produção, usa **`npm run check:public`** (define as mesmas variáveis públicas que o CI e o fallback em `client.ts`).

Inclui: barrels LZT, **`typecheck`**, **`lint`** (com aviso gradual em `any`), **`knip`**, **`test`** (Vitest), **`build`** (Vite produção) e **`test:e2e`** (Playwright). O passo **`build`** em modo produção exige **`VITE_SUPABASE_URL`** e **`VITE_SUPABASE_PUBLISHABLE_KEY`** (`.env`, variáveis de ambiente, ou **`check:public`**); o CI do GitHub injeta os mesmos valores públicos que o fallback de desenvolvimento em `client.ts`.

**CI no GitHub:** em cada push ou pull request para `main`, o workflow [`.github/workflows/ci.yml`](https://github.com/lucasftww/rose-inject-magic/blob/main/.github/workflows/ci.yml) corre `npm run check` (instala Chromium para Playwright antes). Complementa o deploy Supabase (`.github/workflows/supabase-deploy.yml`).

### Smoke manual em produção

Checklist rápido após deploy (Vercel + Supabase), além do CI automático:

1. Abrir a loja em produção: página inicial carrega, título **Royal Store**, sem erro no consola.
2. **Auth:** registo/login (fluxo mínimo).
3. **Loja:** abrir uma categoria de produtos e uma página de detalhe.
4. **Checkout:** adicionar ao carrinho e avançar até ao passo imediatamente antes do pagamento real (ou fluxo de teste que uses).
5. **Admin** (se aplicável): login admin e abrir um separador do painel.
6. **Supabase:** no dashboard, confirmar que as Edge Functions têm deploy recente após alterações em `supabase/functions/`.

### Frontend, Supabase e Meta CAPI (browser)

O ficheiro `src/integrations/supabase/client.ts` exporta **`supabaseUrl`** e **`supabaseAnonKey`**, derivados de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Fora de produção, o mesmo módulo pode aplicar fallbacks de desenvolvimento para não precisares de `.env` só para testar localmente.

Chamadas do browser às Edge Functions (pagamentos, `lzt-market`, etc.) e o envio **Meta CAPI** via função **`server-relay`** (`src/lib/metaPixel.ts`) usam **sempre** esses exports. Assim, URL e chave anónima coincidem com o `createClient` do Supabase e evitas o cenário em que a sessão funciona mas as funções falham por URL/key diferentes.

- **`VITE_SUPABASE_PROJECT_ID` deixou de ser necessário para a CAPI no frontend.** Antes era possível montar a URL do relay só com o ID do projeto; agora a origem vem de `supabaseUrl`, como nas restantes integrações.
- **Em produção**, o build continua a depender de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` definidos no hosting (ex.: Vercel). Sem eles, o cliente lança erro ao arrancar.

Tokens e secrets da Meta no servidor (Edge) mantêm-se documentados em [supabase/EDGE_SECRETS.md](supabase/EDGE_SECRETS.md).

### Supabase (produção)

- Secrets das Edge Functions e credenciais em DB: ver [supabase/EDGE_SECRETS.md](supabase/EDGE_SECRETS.md).
- Migrações: `npx supabase db push` (após histórico alinhado). Se o CLI reclamar de versões, usa `npm run supabase:repair-migrations` e volta a validar com `npx supabase db push --dry-run --yes`.

## 📁 Estrutura do Projeto

```
e2e/                 # Testes Playwright (smoke na SPA)
src/
├── assets/           # Imagens e arquivos estáticos
├── components/
│   ├── admin/        # Componentes do painel admin
│   ├── landing/      # Componentes da landing page
│   └── ui/           # Componentes base (shadcn/ui)
├── hooks/            # Custom hooks (auth, cart, admin, etc.)
├── integrations/
│   └── supabase/     # Cliente e tipos do Supabase
├── lib/              # Utilitários
├── pages/            # Páginas da aplicação
└── test/             # Configuração e testes
```

## 🌐 Deploy

O projeto está configurado para deploy na **Vercel** com:

- Headers de segurança (HSTS, X-Frame-Options, etc.)
- Cache imutável para assets estáticos
- SPA fallback (`rewrites` para `index.html`)

**GitHub Actions — Supabase** (`.github/workflows/supabase-deploy.yml`): em push para `main` que altere `supabase/functions`, `supabase/migrations`, o script de deploy ou o workflow, corre deploy das Edge Functions. É **obrigatório** definir o secret do repositório **`SUPABASE_ACCESS_TOKEN`** (token `sbp_...` em [Account tokens](https://supabase.com/dashboard/account/tokens)); sem ele o job falha de propósito no primeiro passo. Opcional: **`SUPABASE_DB_PASSWORD`** para correr `supabase db push` no CI. Estado dos runs: separador [Actions](https://github.com/lucasftww/rose-inject-magic/actions) no GitHub.

## 📄 Licença

Projeto privado — todos os direitos reservados.