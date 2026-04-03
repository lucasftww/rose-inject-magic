import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NOTHING_ICONS = ["x", "flower", "skull"] as const;
type NothingIcon = (typeof NOTHING_ICONS)[number];

type GridCell = {
  type: "prize" | "nothing";
  prizeId?: string;
  name: string;
  image_url?: string | null;
  nothingIcon: NothingIcon;
  prize_value?: number;
};

/** Matches client `contasPrizes` — IDs are not DB UUIDs; `prize_id` stored as null. */
const CONTAS_PRIZES = [
  { id: "conta-valorant", name: "Conta Valorant", image_url: null as string | null, win_percentage: 40, prize_value: 0 },
  { id: "conta-lol", name: "Conta LoL", image_url: null as string | null, win_percentage: 30, prize_value: 0 },
  { id: "conta-fortnite", name: "Conta Fortnite", image_url: null as string | null, win_percentage: 20, prize_value: 0 },
  { id: "conta-minecraft", name: "Conta Minecraft", image_url: null as string | null, win_percentage: 10, prize_value: 0 },
];

const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function randomUnit(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

function randomNothingCell(): GridCell {
  return {
    type: "nothing",
    name: "Nada",
    nothingIcon: NOTHING_ICONS[Math.floor(randomUnit() * NOTHING_ICONS.length)]!,
  };
}

function pickWinLine(): number[] {
  return WIN_LINES[Math.floor(randomUnit() * WIN_LINES.length)]!;
}

function buildWinningGrid(prize: {
  id: string;
  name: string;
  image_url: string | null;
  prize_value?: number;
}): GridCell[] {
  const line = pickWinLine();
  const grid: GridCell[] = [];
  for (let i = 0; i < 9; i++) {
    grid.push(randomNothingCell());
  }
  for (const idx of line) {
    grid[idx] = {
      type: "prize",
      prizeId: prize.id,
      name: prize.name,
      image_url: prize.image_url,
      prize_value: prize.prize_value ?? 0,
      nothingIcon: NOTHING_ICONS[0],
    };
  }
  return grid;
}

function buildLosingGrid(): GridCell[] {
  return Array.from({ length: 9 }, () => randomNothingCell());
}

function pickPrizeWeighted<T extends { win_percentage: number }>(prizes: T[]): T | null {
  const weights = prizes.map((p) => Math.max(0, Number(p.win_percentage) || 0));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = randomUnit() * total;
  for (let i = 0; i < prizes.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return prizes[i]!;
  }
  return prizes[prizes.length - 1] ?? null;
}

function isProbablyUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

type PrizeRow = {
  id: string;
  name: string;
  image_url: string | null;
  win_percentage: number | null;
  prize_value: number | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim();

  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("scratch-card-play: missing Supabase env");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;
  if (typeof userId !== "string" || !userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { payment_id?: string; mode?: string; quantity?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const paymentId = typeof body.payment_id === "string" ? body.payment_id.trim() : "";
  if (!paymentId) {
    return new Response(JSON.stringify({ error: "payment_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const mode = body.mode === "contas" ? "contas" : "produtos";
  const quantity = Math.max(1, Math.min(10, Math.floor(Number(body.quantity) || 1)));

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: existingPlay } = await admin
    .from("scratch_card_plays")
    .select("won, prize_id, grid_data")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (existingPlay?.grid_data && typeof existingPlay.grid_data === "object") {
    const raw = existingPlay.grid_data as { grid?: GridCell[] };
    if (Array.isArray(raw.grid) && raw.grid.length === 9) {
      let prize: Record<string, unknown> | null = null;
      if (existingPlay.won) {
        if (existingPlay.prize_id) {
          const { data: p } = await admin
            .from("scratch_card_prizes")
            .select("id, name, image_url, prize_value")
            .eq("id", existingPlay.prize_id)
            .maybeSingle();
          if (p) prize = p;
        }
        if (!prize) {
          const winCell = raw.grid.find((c) => c.type === "prize");
          if (winCell) {
            prize = {
              id: winCell.prizeId,
              name: winCell.name,
              image_url: winCell.image_url,
              prize_value: winCell.prize_value ?? 0,
            };
          }
        }
      }
      return new Response(JSON.stringify({ grid: raw.grid, won: !!existingPlay.won, prize }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const { data: payment, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, status, amount, cart_snapshot")
    .eq("id", paymentId)
    .maybeSingle();

  if (payErr || !payment) {
    return new Response(JSON.stringify({ error: "Pagamento não encontrado" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (payment.user_id !== userId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (payment.status !== "COMPLETED") {
    return new Response(JSON.stringify({ error: "Pagamento ainda não confirmado" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cart = payment.cart_snapshot;
  if (!Array.isArray(cart)) {
    return new Response(JSON.stringify({ error: "Carrinho inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raspItem = cart.find((item: { type?: string }) => item?.type === "raspadinha");
  if (!raspItem) {
    return new Response(JSON.stringify({ error: "Este pagamento não é uma raspadinha" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const planId = String((raspItem as { planId?: string }).planId || "");
  const isContasPlan = planId.includes("contas");
  if (mode === "contas" && !isContasPlan) {
    return new Response(JSON.stringify({ error: "Modo incompatível com o pagamento" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (mode === "produtos" && isContasPlan) {
    return new Response(JSON.stringify({ error: "Modo incompatível com o pagamento" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const planName = String((raspItem as { planName?: string }).planName || "");
  const m = planName.match(/(\d+)x/);
  const expectedQty = m ? parseInt(m[1]!, 10) : 1;
  if (quantity !== expectedQty) {
    return new Response(JSON.stringify({ error: "Quantidade não confere com o pagamento" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let prizeRows: PrizeRow[] = [];
  if (mode === "produtos") {
    const { data: rows, error: prErr } = await admin
      .from("scratch_card_prizes")
      .select("id, name, image_url, win_percentage, prize_value")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (prErr || !rows?.length) {
      return new Response(JSON.stringify({ error: "Prêmios indisponíveis no servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    prizeRows = rows as PrizeRow[];
  }

  const totalWeight =
    mode === "contas"
      ? CONTAS_PRIZES.reduce((s, p) => s + Math.max(0, Number(p.win_percentage) || 0), 0)
      : prizeRows.reduce((s, r) => s + Math.max(0, Number(r.win_percentage) || 0), 0);
  const capped = Math.min(100, totalWeight);
  const loseThreshold = Math.max(0, 100 - capped);

  let won = false;
  let grid: GridCell[] = buildLosingGrid();
  let prizeId: string | null = null;
  let responsePrize: Record<string, unknown> | null = null;

  if (randomUnit() * 100 < loseThreshold) {
    won = false;
    grid = buildLosingGrid();
  } else {
    won = true;
    if (mode === "contas") {
      const picked = pickPrizeWeighted(CONTAS_PRIZES);
      if (!picked) {
        won = false;
        grid = buildLosingGrid();
      } else {
        grid = buildWinningGrid(picked);
        prizeId = null;
        responsePrize = {
          id: picked.id,
          name: picked.name,
          image_url: picked.image_url,
          prize_value: picked.prize_value,
        };
      }
    } else {
      const weighted = prizeRows.map((r) => ({
        row: r,
        win_percentage: Number(r.win_percentage) || 0,
      }));
      const picked = pickPrizeWeighted(weighted);
      if (!picked) {
        won = false;
        grid = buildLosingGrid();
      } else {
        const row = picked.row;
        grid = buildWinningGrid({
          id: row.id,
          name: row.name,
          image_url: row.image_url,
          prize_value: row.prize_value ?? 0,
        });
        prizeId = isProbablyUuid(row.id) ? row.id : null;
        responsePrize = {
          id: row.id,
          name: row.name,
          image_url: row.image_url,
          prize_value: row.prize_value ?? 0,
        };
      }
    }
  }

  const { error: insErr } = await admin.from("scratch_card_plays").insert({
    user_id: userId,
    payment_id: paymentId,
    won,
    prize_id: prizeId,
    amount_paid: payment.amount ?? null,
    grid_data: { grid, mode, quantity },
  });

  if (insErr) {
    if (insErr.code === "23505") {
      const { data: replay } = await admin
        .from("scratch_card_plays")
        .select("won, prize_id, grid_data")
        .eq("payment_id", paymentId)
        .maybeSingle();
      if (replay?.grid_data && typeof replay.grid_data === "object") {
        const raw = replay.grid_data as { grid?: GridCell[] };
        if (Array.isArray(raw.grid) && raw.grid.length === 9) {
          let prize: Record<string, unknown> | null = null;
          if (replay.won) {
            if (replay.prize_id) {
              const { data: p } = await admin
                .from("scratch_card_prizes")
                .select("id, name, image_url, prize_value")
                .eq("id", replay.prize_id)
                .maybeSingle();
              if (p) prize = p;
            }
            if (!prize) {
              const winCell = raw.grid.find((c) => c.type === "prize");
              if (winCell) {
                prize = {
                  id: winCell.prizeId,
                  name: winCell.name,
                  image_url: winCell.image_url,
                  prize_value: winCell.prize_value ?? 0,
                };
              }
            }
          }
          return new Response(JSON.stringify({ grid: raw.grid, won: !!replay.won, prize }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }
    console.error("scratch-card-play insert:", insErr.message);
    return new Response(JSON.stringify({ error: "Não foi possível registrar a jogada" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      grid,
      won,
      prize: won ? responsePrize : null,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
