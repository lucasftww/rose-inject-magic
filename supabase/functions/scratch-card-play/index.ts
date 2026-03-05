import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Prize {
  id: string;
  name: string;
  image_url: string | null;
  win_percentage: number;
  prize_value: number;
}

interface GridCell {
  type: "prize" | "nothing";
  prizeId?: string;
  name: string;
  image_url?: string | null;
  nothingIcon: "x" | "flower" | "skull";
}

const NOTHING_ICONS = ["x", "flower", "skull"] as const;
const HIDDEN_WIN_CHANCE_PRODUTOS = 1.0;   // ~1%
const HIDDEN_WIN_CHANCE_CONTAS = 0.667;   // ~0.667%
const CONTAS_PRICE = 5.50;

const contasPrizes: Prize[] = [
  { id: "conta-valorant", name: "Conta Valorant", image_url: null, win_percentage: 40, prize_value: 0 },
  { id: "conta-lol", name: "Conta LoL", image_url: null, win_percentage: 30, prize_value: 0 },
  { id: "conta-fortnite", name: "Conta Fortnite", image_url: null, win_percentage: 20, prize_value: 0 },
  { id: "conta-minecraft", name: "Conta Minecraft", image_url: null, win_percentage: 10, prize_value: 0 },
];

function secureRandom(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / (0xFFFFFFFF + 1);
}

function makeNothingCell(): GridCell {
  return {
    type: "nothing",
    name: "Nada",
    nothingIcon: NOTHING_ICONS[Math.floor(secureRandom() * NOTHING_ICONS.length)],
  };
}

function makePrizeCell(prize: Prize): GridCell {
  return {
    type: "prize",
    prizeId: prize.id,
    name: prize.name,
    image_url: prize.image_url,
    nothingIcon: "x",
  };
}

function cellId(cell: GridCell): string {
  return cell.type === "prize" ? cell.prizeId! : `nothing-${cell.nothingIcon}`;
}

function rollWin(prizesPool: Prize[], mode: string): Prize | null {
  const winChance = mode === "contas" ? HIDDEN_WIN_CHANCE_CONTAS : HIDDEN_WIN_CHANCE_PRODUTOS;
  const roll = secureRandom() * 100;
  if (roll >= winChance) return null;
  if (prizesPool.length === 0) return null;

  const totalWeight = prizesPool.reduce((s, p) => s + p.win_percentage, 0);
  if (totalWeight === 0) return prizesPool[Math.floor(secureRandom() * prizesPool.length)];

  let cursor = secureRandom() * totalWeight;
  for (const p of prizesPool) {
    cursor -= p.win_percentage;
    if (cursor <= 0) return p;
  }
  return prizesPool[prizesPool.length - 1];
}

function generateGrid(wonPrize: Prize | null, prizesPool: Prize[]): GridCell[] {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  if (wonPrize) {
    const newGrid: GridCell[] = Array(9).fill(null);
    const pattern = winPatterns[Math.floor(secureRandom() * winPatterns.length)];
    for (const idx of pattern) {
      newGrid[idx] = makePrizeCell(wonPrize);
    }
    const otherPrizes = prizesPool.filter((p) => p.id !== wonPrize.id);
    for (let i = 0; i < 9; i++) {
      if (newGrid[i]) continue;
      if (otherPrizes.length > 0 && secureRandom() > 0.5) {
        newGrid[i] = makePrizeCell(otherPrizes[Math.floor(secureRandom() * otherPrizes.length)]);
      } else {
        newGrid[i] = makeNothingCell();
      }
    }
    return newGrid;
  } else {
    let attempts = 0;
    while (attempts < 100) {
      attempts++;
      const newGrid: GridCell[] = [];
      for (let i = 0; i < 9; i++) {
        const r = secureRandom();
        if (prizesPool.length > 0 && r > 0.4) {
          newGrid.push(makePrizeCell(prizesPool[Math.floor(secureRandom() * prizesPool.length)]));
        } else {
          newGrid.push(makeNothingCell());
        }
      }
      const hasWin = winPatterns.some(([a, b, c]) => {
        const idA = cellId(newGrid[a]);
        const idB = cellId(newGrid[b]);
        const idC = cellId(newGrid[c]);
        return idA === idB && idB === idC;
      });
      if (!hasWin) return newGrid;
    }
    return Array(9).fill(null).map(() => makeNothingCell());
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payment_id, mode, quantity } = await req.json();

    // Validate inputs
    if (!payment_id || !mode || !quantity) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["produtos", "contas"].includes(mode)) {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qty = Math.min(Math.max(1, Math.floor(Number(quantity))), 10);

    // Verify payment exists, belongs to user, and is COMPLETED
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("status, user_id")
      .eq("id", payment_id)
      .eq("user_id", user.id)
      .single();

    if (!payment || payment.status !== "COMPLETED") {
      return new Response(JSON.stringify({ error: "Payment not found or not completed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if plays already exist for this payment to prevent replay
    const { data: existingPlays } = await supabaseAdmin
      .from("scratch_card_plays")
      .select("id")
      .eq("payment_id", payment_id)
      .limit(1);

    if (existingPlays && existingPlays.length > 0) {
      return new Response(JSON.stringify({ error: "This payment was already used" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get prizes and config
    let prizesPool: Prize[];
    let unitPrice: number;

    if (mode === "produtos") {
      const [{ data: prizesData }, { data: configData }] = await Promise.all([
        supabaseAdmin.from("scratch_card_prizes").select("id, name, image_url, win_percentage, prize_value").eq("active", true),
        supabaseAdmin.from("scratch_card_config").select("price").limit(1).single(),
      ]);
      prizesPool = (prizesData || []) as Prize[];
      unitPrice = configData?.price ?? 2.50;
    } else {
      prizesPool = contasPrizes;
      unitPrice = CONTAS_PRICE;
    }

    // SERVER-SIDE: Roll for win with cryptographically secure RNG
    let wonPrize: Prize | null = null;
    for (let i = 0; i < qty; i++) {
      wonPrize = rollWin(prizesPool, mode);
      if (wonPrize) break;
    }

    // SERVER-SIDE: Generate grid
    const grid = generateGrid(wonPrize, prizesPool);

    // SERVER-SIDE: Record plays
    const plays = Array.from({ length: qty }, (_, idx) => ({
      user_id: user.id,
      payment_id: payment_id,
      prize_id: idx === 0 && wonPrize ? wonPrize.id : null,
      won: idx === 0 && !!wonPrize,
      amount_paid: unitPrice,
      grid_data: idx === 0 ? grid.map((c) => ({ type: c.type, name: c.name, prizeId: c.prizeId })) : [],
    }));

    const { error: insertError } = await supabaseAdmin.from("scratch_card_plays").insert(plays);
    if (insertError) {
      console.error("Failed to insert plays:", insertError);
      return new Response(JSON.stringify({ error: "Failed to record plays" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        grid,
        won: !!wonPrize,
        prize: wonPrize ? { id: wonPrize.id, name: wonPrize.name, image_url: wonPrize.image_url, prize_value: wonPrize.prize_value } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("scratch-card-play error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
