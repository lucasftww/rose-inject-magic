# 📋 Product Requirements Document (PRD) — Royal Store

## 1. Product Overview

**Product Name:** Royal Store  
**Type:** Single-Page Application (SPA) — E-commerce  
**Target Market:** Brazilian gamers (PT-BR)  
**Tech Stack:** Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Framer Motion  
**Deployment:** Vercel  
**Local Port:** 8080

Royal Store is an online storefront for purchasing game cheats (hacks/software licenses) and game accounts for titles such as **Valorant**, **CS2**, **League of Legends**, **Fortnite**, and **Minecraft**. The platform offers instant delivery, multiple payment methods, a gamified scratch-card feature, a full admin panel, and a reseller program.

---

## 2. User Roles

| Role | Description |
|---|---|
| **Visitor** | Unauthenticated user. Can browse products, accounts, reviews, FAQ, legal pages. |
| **Customer** | Authenticated user. Can purchase products/accounts, view dashboard, manage orders, play scratch cards. |
| **Reseller** | Customer with reseller privileges. Gets discount percentage on products. |
| **Admin** | Full access to admin panel. Server-verified via Supabase RPC (`has_role`). |

---

## 3. Authentication System

### 3.1 Auth Methods
- **Email + Password** — Sign up with username, email, password
- **Discord OAuth** — Social login via Supabase OAuth
- **Captcha** — Cloudflare Turnstile integration (currently disabled for debugging)

### 3.2 Auth Features
- Login / Register modal with tabbed UI
- Password recovery via email (redirects to `/reset-password`)
- Session persistence via Supabase auth state listener
- Login IP tracking via `track-login` edge function
- Meta Pixel Advanced Matching on sign-in

### 3.3 Auth Context (`useAuth`)
Provides: `user`, `session`, `profile` (username, avatar_url), `isAdmin`, `loading`, `signUp`, `signIn`, `signOut`, `resetPassword`

---

## 4. Pages & Routes

### 4.1 Public Pages

| Route | Page | Description |
|---|---|---|
| `/` | Index (Landing) | Hero section, featured products, Valorant accounts, reviews, how-it-works, FAQ, CTA, footer |
| `/produtos` | Produtos | Product catalog — browse all active cheats/software |
| `/produto/:id` | ProdutoDetalhes | Product detail page with plans and pricing |
| `/contas` | Contas | Game accounts marketplace (LZT integration) |
| `/conta/:id` | ContaDetalhes | Valorant account detail page |
| `/lol/:id` | LolDetalhes | League of Legends account detail |
| `/fortnite/:id` | FortniteDetalhes | Fortnite account detail |
| `/minecraft/:id` | MinecraftDetalhes | Minecraft account detail |
| `/status` | Status | Product/service availability status page |
| `/avaliacoes` | Avaliacoes | Customer reviews page |
| `/termos` | TermosDeUso | Terms of service |
| `/privacidade` | PoliticaPrivacidade | Privacy policy |
| `/reembolso` | PoliticaReembolso | Refund policy |
| `/garantia` | Garantia | Warranty information |
| `/ajuda` | CentralAjuda | Help center |
| `/reset-password` | ResetPassword | Password reset form |
| `*` | NotFound | 404 page |

### 4.2 Authenticated Pages

| Route | Page | Description |
|---|---|---|
| `/dashboard` | Dashboard | User overview, purchases, security, settings (tabbed interface) |
| `/meus-pedidos` | MeusPedidos | Orders list (filtered by products or accounts) |
| `/pedido/:id` | PedidoChat | Order detail with live chat (supports audio messages) |
| `/checkout` | Checkout | Payment flow (PIX / Card / Crypto) |
| `/raspadinha` | Raspadinha | Scratch card game with PIX payment |

### 4.3 Admin Page

| Route | Page | Description |
|---|---|---|
| `/admin` | AdminPanel | Full admin dashboard (protected by `AdminGuard`) |

---

## 5. Core Features

### 5.1 Product Catalog
- Products with name, description, image, sort order, active status, game category
- Product plans with name, price, active flag
- Product status indicators (online/offline/maintenance labels)
- Features text field for product descriptions

### 5.2 Game Accounts (LZT Integration)
- Fetches accounts from LZT Market via Supabase Edge Function (`lzt-market`)
- Displays Valorant rank, skin count, knife indicator, region
- Shows actual Valorant weapon skin previews from API data
- Price markup system with reseller pricing (`useLztMarkup`)
- Supports Valorant, LoL, Fortnite, Minecraft accounts

### 5.3 Shopping Cart (`useCart`)
- Cart persisted in `localStorage` (key: `royal-store-cart`)
- Requires authentication to add items (triggers auth modal)
- Direct checkout model — replaces cart with single item on add
- Supports regular products and LZT accounts
- Items track: productId, productName, productImage, planId, planName, price, quantity, lztItemId, lztGame, skinsCount

### 5.4 Checkout & Payment
- **PIX** — QR Code + copy-paste code, auto-polling for confirmation (3s intervals)
- **Credit Card** — Opens external payment URL via gateway (Visa, Master, Elo)
- **Crypto (USDT)** — TRC20 network, address + QR code
- Coupon support (coupon_id from URL params)
- Server-validated pricing (prevents client-side manipulation)
- Payment status states: ACTIVE → COMPLETED / EXPIRED / FAILED / CANCELLED
- Card payment hidden for LZT account purchases
- Payment settings configurable per method (enabled/disabled from DB)
- Meta Pixel Purchase event tracking on completion

### 5.5 User Dashboard
Tabbed interface with 4 sections:

**Overview tab:**
- Stats cards with mini area charts (total orders, delivered, total spent)
- Last 5 purchases list
- Last 5 invoices (payments) list
- Reseller badge display if applicable

**Purchases tab:**
- Summary strip (total orders, delivered, open)
- Category cards: Products vs Accounts (with thumbnails)
- Recent activity list
- Links to `/meus-pedidos` filtered views

**Security tab:**
- Identity verification (password re-entry required)
- Password change form (min 8 chars, confirmation match)
- Session info display (email, member since, last login)

**Settings tab:**
- Profile info (username, email — read-only)
- Account details (ID, creation date, last login)
- Reseller info (if applicable)
- Logout option

### 5.6 Order System
- Order tickets (`order_tickets` table) track status: open, waiting, waiting_staff, delivered, resolved, closed, banned, finished
- Order chat (`/pedido/:id`) — real-time messaging with support
- Audio message support via `useAudioRecorder` hook
- Metadata distinguishes: regular products, LZT accounts, robot projects

### 5.7 Scratch Card Game (Raspadinha)
- Two modes: **Products** (win catalog items) and **Accounts** (win random game accounts)
- PIX-only payment (R$2.50 for products, R$5.50 for accounts)
- Quantity selector (1–10x)
- Canvas-based scratch interaction (touch + mouse)
- 3x3 grid — 3 matching symbols in a line wins
- Server-side win determination (`scratch-card-play` edge function)
- Play history tracking
- Pending payment recovery system

### 5.8 Reviews System
- Customer reviews page (`/avaliacoes`)
- Reviews section on landing page
- Star rating display
- Static testimonials in auth modal

---

## 6. Admin Panel

Protected by `AdminGuard` component (server-side Supabase RPC verification). Lazy-loaded to prevent non-admin bundle download.

### Admin Tabs (16 modules):

| Tab | Component | Description |
|---|---|---|
| Overview | `OverviewTab` | Dashboard stats and metrics |
| Products | `ProductsTab` | CRUD for products and plans |
| Stock | `StockTab` | Inventory/stock management |
| Games | `GamesTab` | Game categories management |
| Sales | `SalesTab` | Sales analytics and history |
| Tickets | `TicketsTab` | Customer order/support tickets |
| Payments | `PaymentsTab` | Payment records |
| Finance | `FinanceTab` | Financial reports and analytics |
| Coupons | `CouponsTab` | Discount coupon management |
| Users | `UsersTab` | User management and moderation |
| Resellers | `ResellersTab` | Reseller program management |
| Credentials | `CredentialsTab` | Product credentials/keys management |
| LZT | `LztTab` | LZT Market integration settings |
| Robot Project | `RobotProjectTab` | Automated project management |
| Scratch Card | `ScratchCardTab` | Scratch card prizes and configuration |
| Status | `StatusTab` | Product status management |

---

## 7. Integrations

### 7.1 Supabase
- **Auth:** Email/password, Discord OAuth, sessions
- **Database:** Products, plans, orders, payments, profiles, reviews, scratch cards, coupons, resellers
- **Edge Functions:** `pix-payment` (create/status for PIX/card/crypto), `lzt-market`, `scratch-card-play`, `track-login`
- **RPC:** `has_role` (admin verification)
- **Storage:** Product images, user avatars

### 7.2 Meta Pixel (Facebook)
- Page view tracking
- Purchase event tracking with Advanced Matching
- Click ID tracking (fbclid, gclid, ttclid)
- UTM parameter preservation across navigation
- `_fbc` cookie management
- CAPI-compatible user data caching

### 7.3 UTMify
- UTM capture and preservation via external script

### 7.4 Cloudflare Turnstile
- CAPTCHA integration (currently disabled)

### 7.5 LZT Market
- External marketplace API for game accounts
- Accessed via Supabase Edge Function proxy

---

## 8. UI/UX Components

### 8.1 Landing Page Components
- `Header` — Navigation with auth, cart, user menu
- `FloatingWidgets` — WhatsApp/Discord floating buttons
- `StickyMobileCTA` — Fixed mobile call-to-action bar
- `ReviewsSection` — Customer testimonials carousel
- `FaqSection` — Accordion FAQ
- `HowItWorksSection` — Step-by-step guide
- `CtaSection` — Final call-to-action
- `Footer` — Links, legal, social
- `DiscordBanner` — Discord community banner

### 8.2 Design System
- **UI Library:** shadcn/ui (Radix primitives)
- **Animations:** Framer Motion (fadeUp, staggerContainer, scaleIn, slideInLeft)
- **Styling:** Tailwind CSS with custom theme
- **Typography:** Valorant custom font + Space Grotesk
- **Color Scheme:** Dark theme with cyan/teal accent (`--success` as primary accent)
- **Responsive:** Mobile-first with breakpoints

---

## 9. Database Schema (Supabase Tables)

Based on code references, the following tables exist:

| Table | Purpose |
|---|---|
| `profiles` | User profiles (username, avatar_url) |
| `products` | Product catalog |
| `product_plans` | Pricing plans per product |
| `order_tickets` | Customer orders/support tickets |
| `payments` | Payment records |
| `payment_settings` | Payment method configuration |
| `scratch_card_config` | Scratch card game settings |
| `scratch_card_plays` | Scratch card play history |
| `public_scratch_card_prizes` | Available scratch card prizes |

---

## 10. Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_PROJECT_ID` | Supabase project identifier |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_URL` | Supabase API URL |

---

## 11. Performance Optimizations

- **Code splitting:** Lazy-loaded routes via `React.lazy()` (all secondary routes)
- **Admin isolation:** Admin panel bundle never downloaded for non-admin users
- **Image optimization:** WebP format for social banners, lazy loading on images
- **Query caching:** React Query with staleTime (5min for products, 1hr for skins)
- **Cart persistence:** localStorage to avoid re-fetches
- **Eager loading:** Only Index and NotFound pages loaded eagerly

---

## 12. Security Features

- Server-side admin verification via Supabase RPC
- Server-validated payment amounts (prevents price manipulation)
- Server-side scratch card win determination
- Login IP tracking
- Identity verification required for security settings
- Secure headers configured in `vercel.json` (HSTS, X-Frame-Options)
- Captcha integration ready (Turnstile)

---

## 13. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| **Language** | Portuguese (Brazil) — PT-BR |
| **Browser Support** | Modern browsers (ES modules required) |
| **Node.js** | v18+ |
| **Build Tool** | Vite 5 |
| **Testing** | Vitest (unit tests) |
| **Linting** | ESLint 9 with React hooks plugin |
| **Deploy Platform** | Vercel |
| **SPA Routing** | Client-side via React Router v6 with Vercel rewrites |
