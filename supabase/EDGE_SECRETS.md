# Supabase Edge Functions: secrets e credenciais

## Conferir o que está definido

```sh
npx supabase secrets list
```

**Credenciais na base (sem revelar valores):** com o projeto ligado (`supabase link`), corre:

```sh
npm run verify:supabase-credentials
```

Equivalente a `npx supabase db query --linked -f scripts/sql/admin_credentials_status.sql`. Lista cada `env_key` e se está **configured** (valor não vazio).

O Supabase injeta automaticamente `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (e variantes) nas Edge Functions; não é preciso duplicar no Dashboard, salvo cenários especiais. O `secrets list` mostra apenas **nomes** e **digest** (hash), não o valor — serve para confirmar que um nome existe.

## Roteiro de testes manuais (integrações)

| Integração | Teste mínimo |
|------------|----------------|
| LZT | Loja → contas LZT: lista carrega; admin → LZT sem erro de token. |
| MisticPay / Pix | Checkout de teste até webhook / status pago; logs `pix-payment` sem erro de credencial. |
| Meta CAPI | Compra de teste; Event Manager / logs `pix-payment` e `server-relay` sem `META_ACCESS_TOKEN not configured`. |
| UTMify | Se usas: após pagamento, verifica envio (logs `pix-payment`) ou painel UTMify. |
| Robot | Só se vendes planos Robot: fluxo que chama API Robot; logs sem falha de user/pass. |
| server-relay | Navegação logada no site: eventos browser ao Meta; `Origin` do teu domínio tem de estar em `META_ALLOWED_ORIGIN_HOSTS` ou no default do código. |

## Segurança (token Supabase CLI)

Se alguma vez partilhaste um **Access Token** (`sbp_…`) em chat ou captura de ecrã, revoga-o em [Account → Access Tokens](https://supabase.com/dashboard/account/tokens) e cria outro. Não commites tokens no Git.

## Deploy só de funções alteradas (rápido)

Para publicar apenas **lzt-market**, **pix-payment** e **server-relay** (as que mais mudam com LZT/Meta/Pix):

```sh
# PowerShell: se necessário
# $env:SUPABASE_ACCESS_TOKEN="sbp_..."

node scripts/deploy-edge-functions.mjs lzt-market pix-payment server-relay
```

O deploy completo de todas as funções continua em `npm run deploy:supabase-functions`.

## Secrets opcionais (fallback por código)

As funções também leem variáveis de ambiente quando o valor não está na tabela `system_credentials` (painel admin) ou como último fallback:

| Uso | Variável (secret) | Onde entra no código |
|-----|-------------------|----------------------|
| LZT Market | `LZT_MARKET_TOKEN` ou `LZT_API_TOKEN` | `lzt-market`, `pix-payment` |
| Meta CAPI | `META_ACCESS_TOKEN`, `META_PIXEL_ID` | `pix-payment`, `server-relay` (preferência: linhas em `system_credentials`) |
| Meta (browser) | `META_ALLOWED_ORIGIN_HOSTS` | `server-relay` — lista **separada por vírgulas** de hostnames permitidos para `Origin`/`Referer` e validação de `event_source_url`. Se vazio, usa default no código (`royalstorebr.com`, `www.…`, `localhost`, `127.0.0.1`). |
| UTMify Orders | `UTMIFY_API_TOKEN` | `pix-payment` — **preferir Admin → Credenciais**; secret da Edge só como fallback |
| MisticPay | `MISTICPAY_CLIENT_ID`, `MISTICPAY_CLIENT_SECRET` | `pix-payment` |
| Robot API | `ROBOT_API_USERNAME`, `ROBOT_API_PASSWORD` | `pix-payment` |
| Discord | `DISCORD_BOT_TOKEN` | `pix-payment` |
| Imagens (admin) | `LOVABLE_API_KEY` | `generate-game-image` |

Definir um secret:

```sh
npx supabase secrets set NOME_DO_SECRET=valor
```

**LZT:** o fluxo recomendado é guardar o token em **Admin → credenciais** (`system_credentials`: `LZT_MARKET_TOKEN` / `LZT_API_TOKEN`). Só uses secret se quiseres redundância ou CI sem DB.

## Como resolver o que “falta” (LZT, Meta, etc.)

**Importante:** ninguém pode “colocar” por ti os JWT/tokens reais — tens de os gerar nas contas LZT, Meta e MisticPay e colar no painel (ou nos secrets).

### Linhas vazias na base (migração)

A migração `20260404140000_seed_system_credentials_placeholders.sql` cria em `system_credentials` as chaves esperadas com `value` vazio (idempotente: `ON CONFLICT DO NOTHING`). Depois de `db push` ou SQL aplicado, no **Admin → Credenciais** vês cada linha e só preenches o valor.

Tens **duas formas** equivalentes para a maioria das chaves: **tabela `system_credentials` no painel** (recomendado para LZT e Meta com o teu Pixel) ou **secrets da Edge** (CLI/Dashboard). O código tenta primeiro a tabela e depois o secret.

### Opção A — Painel da loja (recomendado)

1. Entra como **admin** na app e abre o **Painel Admin**.
2. Abre o separador **Credenciais** (tab `credenciais`).
3. Clica **Nova credencial** e cria uma linha por chave necessária. O campo **Chave (ENV)** tem de ser **exatamente** um destes nomes (maiúsculas):

| Chave (ENV) | Para quê |
|-------------|----------|
| `LZT_MARKET_TOKEN` ou `LZT_API_TOKEN` | API LZT Market (catálogo de contas, compra, proxy de imagens). Basta **uma** das duas com o JWT/token válido. |
| `META_ACCESS_TOKEN` | Meta Conversions API (eventos de compra). Já podes ter isto só como secret; na mesma, podes espelhar aqui. |
| `META_PIXEL_ID` | ID do teu Pixel (para CAPI bater certo com o pixel do site). |
| `UTMIFY_API_TOKEN` | Token da API da UTMify para enviar pedidos pagos para tracking de vendas. |
| `MISTICPAY_CLIENT_ID` / `MISTICPAY_CLIENT_SECRET` | Gateway de pagamento (se não usares só secrets). |
| `ROBOT_API_USERNAME` / `ROBOT_API_PASSWORD` | Integração Robot (se aplicável). |
| `DISCORD_WEBHOOK_URL`, `DISCORD_GUILD_ID`, `DISCORD_CLIENT_ROLE_ID` | Notificações / cargos Discord, conforme o fluxo que uses. |

4. Cola o **valor** real, guarda, e testa de novo um fluxo (ex.: listar contas LZT ou concluir um pagamento de teste).

### Opção B — Secrets da Edge (CLI)

Útil se preferires não guardar no Postgres ou para backups:

```sh
npx supabase secrets set LZT_MARKET_TOKEN="teu_jwt_aqui"
npx supabase secrets set META_PIXEL_ID="teu_pixel_id"
```

Repete para cada variável da tabela acima. **Não commits** valores no Git.

### Opção C — Supabase Dashboard → SQL ou Table Editor

Na consola do projeto: **Table Editor** → `system_credentials` → inserir/editar linhas com `env_key` e `value` iguais ao que a app espera. Requer permissões e RLS adequadas (normalmente só service role ou políticas de admin).

### Como saber se já está OK

- **LZT:** abre a página de contas LZT na loja; se carregar itens sem erro de token, está configurado.
- **Meta CAPI:** após uma compra de teste, vê os logs da função `pix-payment` no Dashboard (avisos se token/pixel faltarem).
- **server-relay (Pixel browser):** pedidos de `Origin`/`Referer` fora de `META_ALLOWED_ORIGIN_HOSTS` são rejeitados; ajusta o secret se mudares domínio de produção ou preview.
- Lista de secrets: `npx supabase secrets list` (só confirma nomes definidos na Edge, não substitui a tabela).

### Checklist: doc ↔ projeto (referência)

No código, **LZT** e **META_PIXEL_ID** costumam vir sobretudo de **`system_credentials`**; por isso **não** é obrigatório ver `LZT_*` ou `META_PIXEL_ID` no `secrets list`. Já **MisticPay**, **Discord**, **Meta token**, **hosts permitidos** e **LOVABLE** aparecem frequentemente como secrets nomeados.

Um projeto “bem montado” costuma ter no mínimo (Edge ou DB): credenciais LZT, MisticPay, Meta (token + pixel), e o que usares de Discord/UTMify/Robot. Cruza com `secrets list` e com **Admin → Credenciais** até não faltar nada para os fluxos que usas em produção.

## Migrações e `db push`

Se o histórico remoto (`schema_migrations`) divergir dos ficheiros em `supabase/migrations/` (versões com timestamps diferentes), o `db push` falha. Para alinhar **só o registo** (sem reexecutar SQL já aplicado):

```sh
npm run supabase:repair-migrations
```

Depois confirma:

```sh
npx supabase db push --dry-run --yes
```

Deve aparecer: `Remote database is up to date.`
