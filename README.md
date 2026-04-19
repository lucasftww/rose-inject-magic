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

- [Node.js](https://nodejs.org/) v18+ e npm
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
| `npm run supabase:repair-migrations` | Alinhar histórico de migrações local/remoto (só metadados; requer `supabase link` + login) |
| `npm run knip` | Procurar exports/ficheiros não usados (shadcn e `types.ts` gerado ignorados em `knip.json`; incluído em `npm run check`) |

### Validação do projeto

Antes de um PR ou deploy, confirma que os passos terminam sem erros (ou corre `npm run check`, que inclui tudo):

```sh
npm run typecheck && npm run lint && npm run knip && npm run test && npm run build
```

- **`typecheck`** — TypeScript (`tsc --noEmit`)
- **`lint`** — ESLint
- **`knip`** — dependências e exports órfãos (ver `knip.json`)
- **`test`** — Vitest
- **`build`** — bundle de produção com Vite

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