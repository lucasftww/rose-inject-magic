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
| `npm run knip` | Procurar exports/ficheiros não usados (shadcn e `types.ts` gerado ignorados em `knip.json`) |

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

## 📄 Licença

Projeto privado — todos os direitos reservados.