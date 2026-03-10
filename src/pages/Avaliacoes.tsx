import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Star, Loader2, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: string;
  username: string;
  product_name: string;
}

const STATIC_REVIEWS: Review[] = [
  { id: "s1", rating: 5, comment: "mano comprei o exclusive val e ta absurdo, nunca tomei ban. recomendo demais 🔥", created_at: "2026-03-08T14:22:00Z", user_id: "s", username: "luquinhas_", product_name: "Exclusive VAL" },
  { id: "s2", rating: 5, comment: "suporte respondeu em 5 min, me ajudou a configurar tudo certinho. nota 10!", created_at: "2026-03-07T21:10:00Z", user_id: "s", username: "breno.xd", product_name: "Arduino Aim" },
  { id: "s3", rating: 5, comment: "produto indetectável mesmo, to usando faz 3 semanas e 0 problemas", created_at: "2026-03-07T18:33:00Z", user_id: "s", username: "rafaelzin", product_name: "Cyclo Aim" },
  { id: "s4", rating: 4, comment: "muito bom mas demorou um pouquinho pra chegar o acesso, fora isso perfeito", created_at: "2026-03-07T09:45:00Z", user_id: "s", username: "gabriel_fps", product_name: "Esp Aim" },
  { id: "s5", rating: 5, comment: "caraaaa esse color bot é brabo demais kkkk subindo rank muito facil", created_at: "2026-03-06T23:15:00Z", user_id: "s", username: "davi.santos", product_name: "Color bot" },
  { id: "s6", rating: 5, comment: "peguei uma conta valorant com umas skin insana, preço justo e entrega rápida", created_at: "2026-03-06T17:50:00Z", user_id: "s", username: "mathzera", product_name: "Contas Valorant" },
  { id: "s7", rating: 5, comment: "spoofer funcionando perfeitamente, desbaniu minha conta em minutos", created_at: "2026-03-06T12:30:00Z", user_id: "s", username: "carlos.dev", product_name: "Spoofer games" },
  { id: "s8", rating: 5, comment: "ja comprei 3 vezes aqui e nunca tive problema. loja confiavel demais", created_at: "2026-03-05T22:00:00Z", user_id: "s", username: "jota_silva", product_name: "Exclusive VAL" },
  { id: "s9", rating: 4, comment: "bom produto, funciona de boa. só queria q tivesse mais opção de pagamento", created_at: "2026-03-05T15:20:00Z", user_id: "s", username: "pedrohnn", product_name: "Esp Only" },
  { id: "s10", rating: 5, comment: "mlk o aim ta suave demais, parece q eu nasci jogando kkkkkk", created_at: "2026-03-05T10:45:00Z", user_id: "s", username: "enzogamer77", product_name: "Arduino Aim" },
  { id: "s11", rating: 5, comment: "tava com medo de ser scam mas entregaram tudo certinho. confiável!", created_at: "2026-03-04T20:30:00Z", user_id: "s", username: "ana_beatriz", product_name: "Cyclo Aim" },
  { id: "s12", rating: 5, comment: "comprei o inject cs e to amando, wh ta liso demais mano", created_at: "2026-03-04T16:15:00Z", user_id: "s", username: "kaua.fps", product_name: "Inject CS" },
  { id: "s13", rating: 5, comment: "esse esp é outro nível, consigo ver todo mundo no mapa. vale cada centavo", created_at: "2026-03-04T11:00:00Z", user_id: "s", username: "thiagobrz", product_name: "Esp Aim" },
  { id: "s14", rating: 4, comment: "produto muito bom, só achei o tutorial meio confuso no início", created_at: "2026-03-03T21:45:00Z", user_id: "s", username: "lele_gms", product_name: "Color bot" },
  { id: "s15", rating: 5, comment: "atendimento nota 1000, o cara me explicou passo a passo. recomendo mt", created_at: "2026-03-03T14:30:00Z", user_id: "s", username: "murilo.rj", product_name: "Exclusive VAL" },
  { id: "s16", rating: 5, comment: "peguei minha conta com rank imortal e tava tudo certo, skins lindas 😍", created_at: "2026-03-03T09:10:00Z", user_id: "s", username: "juliana_gamer", product_name: "Contas Valorant" },
  { id: "s17", rating: 5, comment: "oneclick salvou minha vida, hardware ban resolvido em 2 min", created_at: "2026-03-02T23:50:00Z", user_id: "s", username: "felipao_sp", product_name: "Oneclick" },
  { id: "s18", rating: 5, comment: "to usando faz 1 mês e zero detecção, produto de qualidade real", created_at: "2026-03-02T18:20:00Z", user_id: "s", username: "vinizin.tt", product_name: "Arduino Aim" },
  { id: "s19", rating: 5, comment: "comprei pra mim e pro meu amigo, os dois funcionando perfeitamente", created_at: "2026-03-02T13:00:00Z", user_id: "s", username: "lucas_play", product_name: "Esp Only" },
  { id: "s20", rating: 4, comment: "bom custo beneficio, só podia ter desconto pra quem compra de novo", created_at: "2026-03-01T22:30:00Z", user_id: "s", username: "matheus.c", product_name: "Cyclo Aim" },
  { id: "s21", rating: 5, comment: "o fortnite esp aim ta insano, todo mundo no lobby fica sus de mim kkkk", created_at: "2026-03-01T17:00:00Z", user_id: "s", username: "nicolasgod", product_name: "Fortnite Esp Aim" },
  { id: "s22", rating: 5, comment: "nunca vi uma loja tão organizada, tutorial claro, suporte rápido. parabéns!", created_at: "2026-03-01T11:45:00Z", user_id: "s", username: "isadora_m", product_name: "Exclusive VAL" },
  { id: "s23", rating: 5, comment: "peguei 26 mil jogos na steam por um preço ridículo, vale muito a pena", created_at: "2026-02-28T20:10:00Z", user_id: "s", username: "rick.gamer", product_name: "26 MIL JOGOS NA SUA STEAM" },
  { id: "s24", rating: 5, comment: "segunda compra e como sempre entrega impecável, confia na royal! 👑", created_at: "2026-02-28T14:55:00Z", user_id: "s", username: "bernardo.k", product_name: "Spoofer games" },
  { id: "s25", rating: 5, comment: "aim suavinho, parece natural. ninguém desconfia", created_at: "2026-02-28T09:30:00Z", user_id: "s", username: "dudu.sniper", product_name: "Color bot" },
  { id: "s26", rating: 4, comment: "funcionou de primeira, esperava demorar mais pra configurar. mt bom", created_at: "2026-02-27T21:00:00Z", user_id: "s", username: "giovanna_rp", product_name: "Inject CS" },
  { id: "s27", rating: 5, comment: "irmão essa loja é diferenciada, qualidade absurda em tudo", created_at: "2026-02-27T15:40:00Z", user_id: "s", username: "samuelzx", product_name: "Arduino Aim" },
  { id: "s28", rating: 5, comment: "conta veio com phantom e vandal skin braba, adorei demais!!", created_at: "2026-02-27T10:15:00Z", user_id: "s", username: "larissafps", product_name: "Contas Valorant" },
  { id: "s29", rating: 5, comment: "melhor loja do brasil pra esse tipo de coisa, sem comparação", created_at: "2026-02-26T19:50:00Z", user_id: "s", username: "gui.tavares", product_name: "Exclusive VAL" },
  { id: "s30", rating: 5, comment: "comprei de madrugada e o suporte me respondeu msm assim. top demais", created_at: "2026-02-26T03:20:00Z", user_id: "s", username: "caio_noite", product_name: "Cyclo Aim" },
  { id: "s31", rating: 5, comment: "raspadinha da sorte me deu desconto, comprei na hora kkkk boa royal", created_at: "2026-02-25T17:30:00Z", user_id: "s", username: "henzo.rx", product_name: "Esp Aim" },
  { id: "s32", rating: 4, comment: "muito satisfeito, só queria mais contas com rank radiante disponível", created_at: "2026-02-25T12:00:00Z", user_id: "s", username: "yasmin.gg", product_name: "Contas Valorant" },
  { id: "s33", rating: 5, comment: "cheguei imortal em 2 semanas usando, sem ban nenhum até agr 🙏", created_at: "2026-02-24T22:45:00Z", user_id: "s", username: "joao.cleitim", product_name: "Exclusive VAL" },
  { id: "s34", rating: 5, comment: "preço honesto e entrega instantânea. não tem como reclamar", created_at: "2026-02-24T16:30:00Z", user_id: "s", username: "ryan_prox", product_name: "Oneclick" },
  { id: "s35", rating: 5, comment: "meu duo ficou maluco quando viu minha mira kkkk valeu royal", created_at: "2026-02-24T10:15:00Z", user_id: "s", username: "leozao_rk", product_name: "Arduino Aim" },
  { id: "s36", rating: 5, comment: "confiável, rápido e barato. trifeta completa 💯", created_at: "2026-02-23T20:00:00Z", user_id: "s", username: "amanda.silva", product_name: "Color bot" },
];

const Avaliacoes = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      const { data } = await supabase
        .from("product_reviews")
        .select("id, rating, comment, created_at, user_id, product_id")
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        setReviews(STATIC_REVIEWS);
        setLoading(false);
        return;
      }

      // Fetch usernames
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("user_id", userIds);
      const usernameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.username]));

      // Fetch product names
      const productIds = [...new Set(data.map((r: any) => r.product_id))];
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds);
      const productMap = new Map((products || []).map((p: any) => [p.id, p.name]));

      const dbReviews = data.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        user_id: r.user_id,
        username: usernameMap.get(r.user_id) || "Usuário",
        product_name: productMap.get(r.product_id) || "Produto",
      }));

      // Merge real reviews with static ones
      const all = [...dbReviews, ...STATIC_REVIEWS].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setReviews(all);
      setLoading(false);
    };
    fetchReviews();
  }, []);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "0";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-5xl px-6 pt-4 pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1
            className="text-3xl font-bold tracking-wider text-foreground md:text-4xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            <span className="text-success">AVALIAÇÕES</span> DOS CLIENTES
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Veja o que nossos clientes estão dizendo sobre nossos produtos
          </p>

          {/* Stats */}
          {reviews.length > 0 && (
            <div className="mt-6 inline-flex items-center gap-4 rounded-xl border border-border bg-card px-6 py-3">
              <div className="flex items-center gap-1.5">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="text-xl font-bold text-foreground">{avgRating}</span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-success" />
                <span className="text-sm text-muted-foreground">{reviews.length} avaliações</span>
              </div>
            </div>
          )}
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-success" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Star className="h-12 w-12 text-muted-foreground/20" />
            <p className="text-muted-foreground">Nenhuma avaliação ainda.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review, idx) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.8) }}
                className="rounded-xl border border-border bg-card p-5 transition-all hover:border-success/30 hover:shadow-[0_0_20px_hsl(var(--success)/0.08)]"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{review.username}</p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {new Date(review.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-[10px] font-semibold uppercase tracking-wider text-success mb-2">
                  {review.product_name}
                </p>

                {review.comment && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Avaliacoes;
