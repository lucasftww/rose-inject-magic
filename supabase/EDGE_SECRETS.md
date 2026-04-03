# Supabase Edge Functions: secrets e credenciais

## Conferir o que está definido

```sh
npx supabase secrets list
```

O Supabase injeta automaticamente `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (e variantes) nas Edge Functions; não é preciso duplicar no Dashboard, salvo cenários especiais.

## Secrets opcionais (fallback por código)

As funções também leem variáveis de ambiente quando o valor não está na tabela `system_credentials` (painel admin) ou como último fallback:

| Uso | Variável (secret) | Onde entra no código |
|-----|-------------------|----------------------|
| LZT Market | `LZT_MARKET_TOKEN` ou `LZT_API_TOKEN` | `lzt-market`, `pix-payment` |
| Meta CAPI | `META_ACCESS_TOKEN`, `META_PIXEL_ID` | `pix-payment`, `server-relay` (preferência: linhas em `system_credentials`) |
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
- Lista de secrets: `npx supabase secrets list` (só confirma nomes definidos na Edge, não substitui a tabela).

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
