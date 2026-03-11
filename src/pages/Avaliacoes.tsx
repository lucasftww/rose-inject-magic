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
  // 10/03
  { id: "s1", rating: 5, comment: "mano comprei o exclusive val e ta absurdo, nunca tomei ban. recomendo demais", created_at: "2026-03-10T11:42:00Z", user_id: "s", username: "lucas", product_name: "Exclusive VAL" },
  { id: "s2", rating: 5, comment: "suporte respondeu em 5 min, me ajudou a configurar tudo certinho. nota 10", created_at: "2026-03-10T09:18:00Z", user_id: "s", username: "breno", product_name: "Arduino Aim" },
  { id: "s3", rating: 5, comment: "conta lol veio com todas as skins que eu queria, amei demais", created_at: "2026-03-10T07:55:00Z", user_id: "s", username: "rafael", product_name: "Contas LOL" },
  // 09/03
  { id: "s4", rating: 4, comment: "muito bom mas demorou um pouquinho pra chegar o acesso, fora isso perfeito", created_at: "2026-03-09T22:33:00Z", user_id: "s", username: "gabriel", product_name: "Esp Aim" },
  { id: "s5", rating: 5, comment: "caraaaa esse color bot e brabo demais kkkk subindo rank muito facil", created_at: "2026-03-09T20:10:00Z", user_id: "s", username: "davi", product_name: "Color bot" },
  { id: "s6", rating: 5, comment: "peguei uma conta valorant com umas skin insana, preco justo e entrega rapida", created_at: "2026-03-09T17:45:00Z", user_id: "s", username: "matheus", product_name: "Contas Valorant" },
  { id: "s7", rating: 5, comment: "spoofer funcionando perfeitamente, desbaniu minha conta em minutos", created_at: "2026-03-09T15:22:00Z", user_id: "s", username: "carlos", product_name: "Spoofer games" },
  { id: "s8", rating: 5, comment: "conta fortnite veio com vbucks e skins raras, entrega super rapida", created_at: "2026-03-09T12:50:00Z", user_id: "s", username: "jorge", product_name: "Contas Fortnite" },
  { id: "s9", rating: 4, comment: "bom produto, funciona de boa. so queria q tivesse mais opcao de pagamento", created_at: "2026-03-09T10:05:00Z", user_id: "s", username: "pedro", product_name: "Esp Only" },
  { id: "s10", rating: 5, comment: "mlk o aim ta suave demais, parece q eu nasci jogando kkkkkk", created_at: "2026-03-09T08:30:00Z", user_id: "s", username: "enzo", product_name: "Cyclo Aim" },
  // 08/03
  { id: "s11", rating: 5, comment: "driver cleaner limpou tudo certinho, pc zerado sem rastro nenhum", created_at: "2026-03-08T23:15:00Z", user_id: "s", username: "ana", product_name: "Driver Cleaner" },
  { id: "s12", rating: 5, comment: "comprei o inject cs e to amando, wh ta liso demais mano", created_at: "2026-03-08T21:00:00Z", user_id: "s", username: "kaua", product_name: "Inject CS" },
  { id: "s13", rating: 5, comment: "esse esp e outro nivel, consigo ver todo mundo no mapa. vale cada centavo", created_at: "2026-03-08T18:40:00Z", user_id: "s", username: "thiago", product_name: "Esp Aim" },
  { id: "s14", rating: 4, comment: "produto muito bom, so achei o tutorial meio confuso no inicio", created_at: "2026-03-08T16:25:00Z", user_id: "s", username: "leonardo", product_name: "Fortnite Esp Aim" },
  { id: "s15", rating: 5, comment: "atendimento nota 1000, o cara me explicou passo a passo. recomendo mt", created_at: "2026-03-08T14:10:00Z", user_id: "s", username: "murilo", product_name: "Exclusive VAL" },
  { id: "s16", rating: 5, comment: "peguei minha conta com rank imortal e tava tudo certo, skins lindas", created_at: "2026-03-08T11:35:00Z", user_id: "s", username: "juliana", product_name: "Contas Valorant" },
  { id: "s17", rating: 5, comment: "oneclick salvou minha vida, hardware ban resolvido em 2 min", created_at: "2026-03-08T09:00:00Z", user_id: "s", username: "felipe", product_name: "Oneclick" },
  { id: "s18", rating: 5, comment: "conta lol com rank esmeralda e varios champions, veio tudo certo", created_at: "2026-03-08T07:20:00Z", user_id: "s", username: "vinicius", product_name: "Contas LOL" },
  // 07/03
  { id: "s19", rating: 5, comment: "comprei pra mim e pro meu amigo, os dois funcionando perfeitamente", created_at: "2026-03-07T22:50:00Z", user_id: "s", username: "henrique", product_name: "Esp Only" },
  { id: "s20", rating: 4, comment: "bom custo beneficio, so podia ter desconto pra quem compra de novo", created_at: "2026-03-07T20:30:00Z", user_id: "s", username: "ryan", product_name: "Arduino Aim" },
  { id: "s21", rating: 5, comment: "o fortnite esp aim ta insano, todo mundo no lobby fica sus de mim kkkk", created_at: "2026-03-07T18:15:00Z", user_id: "s", username: "nicolas", product_name: "Fortnite Esp Aim" },
  { id: "s22", rating: 5, comment: "nunca vi uma loja tao organizada, tutorial claro, suporte rapido. parabens", created_at: "2026-03-07T15:45:00Z", user_id: "s", username: "isadora", product_name: "Driver Cleaner" },
  { id: "s23", rating: 5, comment: "conta fortnite com og skins e pickaxe raro, veio ate com vbucks sobrando", created_at: "2026-03-07T13:20:00Z", user_id: "s", username: "ricardo", product_name: "Contas Fortnite" },
  { id: "s24", rating: 5, comment: "segunda compra e como sempre entrega impecavel, confia na royal", created_at: "2026-03-07T10:55:00Z", user_id: "s", username: "bernardo", product_name: "Spoofer games" },
  { id: "s25", rating: 5, comment: "aim suavinho, parece natural. ninguem desconfia", created_at: "2026-03-07T08:40:00Z", user_id: "s", username: "eduardo", product_name: "Color bot" },
  { id: "s26", rating: 4, comment: "funcionou de primeira, esperava demorar mais pra configurar. mt bom", created_at: "2026-03-07T07:10:00Z", user_id: "s", username: "giovanna", product_name: "Inject CS" },
  // 06/03
  { id: "s27", rating: 5, comment: "irmao essa loja e diferenciada, qualidade absurda em tudo", created_at: "2026-03-06T23:30:00Z", user_id: "s", username: "samuel", product_name: "Cyclo Aim" },
  { id: "s28", rating: 5, comment: "conta veio com phantom e vandal skin braba, adorei demais", created_at: "2026-03-06T21:15:00Z", user_id: "s", username: "larissa", product_name: "Contas Valorant" },
  { id: "s29", rating: 5, comment: "melhor loja do brasil pra esse tipo de coisa, sem comparacao", created_at: "2026-03-06T19:00:00Z", user_id: "s", username: "guilherme", product_name: "Exclusive VAL" },
  { id: "s30", rating: 5, comment: "comprei de madrugada e o suporte me respondeu msm assim. top demais", created_at: "2026-03-06T16:40:00Z", user_id: "s", username: "caio", product_name: "Contas LOL" },
  { id: "s31", rating: 5, comment: "raspadinha da sorte me deu desconto, comprei na hora kkkk boa royal", created_at: "2026-03-06T14:20:00Z", user_id: "s", username: "henzo", product_name: "Esp Aim" },
  { id: "s32", rating: 4, comment: "muito satisfeito, so queria mais contas com rank radiante disponivel", created_at: "2026-03-06T11:55:00Z", user_id: "s", username: "yasmin", product_name: "Contas Valorant" },
  { id: "s33", rating: 5, comment: "cheguei imortal em 2 semanas usando, sem ban nenhum ate agr", created_at: "2026-03-06T09:30:00Z", user_id: "s", username: "joao", product_name: "Arduino Aim" },
  { id: "s34", rating: 5, comment: "preco honesto e entrega instantanea. nao tem como reclamar", created_at: "2026-03-06T07:50:00Z", user_id: "s", username: "victor", product_name: "Oneclick" },
  // 05/03
  { id: "s35", rating: 5, comment: "meu duo ficou maluco quando viu minha mira kkkk valeu royal", created_at: "2026-03-05T22:45:00Z", user_id: "s", username: "leo", product_name: "Color bot" },
  { id: "s36", rating: 5, comment: "confiavel, rapido e barato. trifeta completa", created_at: "2026-03-05T20:30:00Z", user_id: "s", username: "amanda", product_name: "Driver Cleaner" },
  { id: "s37", rating: 5, comment: "mano que negocio bom, comprei o cyclo e ja subi 3 ranks em uma semana", created_at: "2026-03-05T18:10:00Z", user_id: "s", username: "igor", product_name: "Cyclo Aim" },
  { id: "s38", rating: 5, comment: "loja seria demais, paguei e em 2 min ja tava com tudo configurado", created_at: "2026-03-05T15:50:00Z", user_id: "s", username: "marcelo", product_name: "Fortnite Esp Aim" },
  { id: "s39", rating: 4, comment: "produto top, so acho q podia ter um video tutorial mais detalhado", created_at: "2026-03-05T13:25:00Z", user_id: "s", username: "otavio", product_name: "Esp Aim" },
  { id: "s40", rating: 5, comment: "cara o aim assist desse negocio e surreal, minha kda subiu absurdo", created_at: "2026-03-05T11:00:00Z", user_id: "s", username: "renan", product_name: "Exclusive VAL" },
  { id: "s41", rating: 5, comment: "conta lol veio com rank diamante e 150 champions, to mt feliz", created_at: "2026-03-05T09:15:00Z", user_id: "s", username: "beatriz", product_name: "Contas LOL" },
  { id: "s42", rating: 5, comment: "comprei conta diamante e veio certinho, ate com vp sobrando", created_at: "2026-03-05T07:40:00Z", user_id: "s", username: "miguel", product_name: "Contas Valorant" },
  // 04/03
  { id: "s43", rating: 5, comment: "inject cs2 roda liso, sem trava nenhuma. vale o investimento", created_at: "2026-03-04T23:10:00Z", user_id: "s", username: "caua", product_name: "Inject CS" },
  { id: "s44", rating: 5, comment: "melhor compra que ja fiz na vida kkkk to destruindo nas ranked", created_at: "2026-03-04T21:00:00Z", user_id: "s", username: "rodrigo", product_name: "Esp Only" },
  { id: "s45", rating: 4, comment: "demorou umas horas pra ativar mas depois funcionou perfeitamente", created_at: "2026-03-04T18:45:00Z", user_id: "s", username: "fernanda", product_name: "Contas Fortnite" },
  { id: "s46", rating: 5, comment: "spoofer resolveu meu problema de hwid na hora, muito obrigado royal", created_at: "2026-03-04T16:20:00Z", user_id: "s", username: "arthur", product_name: "Spoofer games" },
  { id: "s47", rating: 5, comment: "peguei o esp only e ja consigo prever todo mundo, jogo ficou facil demais", created_at: "2026-03-04T14:00:00Z", user_id: "s", username: "bruno", product_name: "Exclusive VAL" },
  { id: "s48", rating: 5, comment: "minha namorada comprou pra mim de presente kkkk ela achou a loja confiavel", created_at: "2026-03-04T11:35:00Z", user_id: "s", username: "diego", product_name: "Arduino Aim" },
  { id: "s49", rating: 5, comment: "cara nunca tomei ban usando, ja faz quase 2 meses. produto solido", created_at: "2026-03-04T09:10:00Z", user_id: "s", username: "gustavo", product_name: "Color bot" },
  { id: "s50", rating: 5, comment: "conta veio com knife e umas skin mt braba, amei demais", created_at: "2026-03-04T07:30:00Z", user_id: "s", username: "rafaela", product_name: "Contas Valorant" },
  // 03/03
  { id: "s51", rating: 5, comment: "to indicando pra todo mundo do meu grupo, todos compraram e gostaram", created_at: "2026-03-03T22:55:00Z", user_id: "s", username: "daniel", product_name: "Cyclo Aim" },
  { id: "s52", rating: 4, comment: "achei o preco um pouco alto mas a qualidade compensa demais", created_at: "2026-03-03T20:40:00Z", user_id: "s", username: "luan", product_name: "Fortnite Esp Aim" },
  { id: "s53", rating: 5, comment: "melhor inject de cs q ja usei e olha q ja testei varios. esse aqui e outro nivel", created_at: "2026-03-03T18:15:00Z", user_id: "s", username: "nathan", product_name: "Inject CS" },
  { id: "s54", rating: 5, comment: "comprei no pix e chegou instantaneo, nem acreditei na velocidade", created_at: "2026-03-03T15:50:00Z", user_id: "s", username: "bianca", product_name: "Oneclick" },
  { id: "s55", rating: 5, comment: "driver cleaner resolveu tudo, meu pc ficou limpo e sem rastro", created_at: "2026-03-03T13:30:00Z", user_id: "s", username: "wendel", product_name: "Driver Cleaner" },
  { id: "s56", rating: 5, comment: "a royal e a unica loja q eu confio pra comprar essas coisas, nunca falha", created_at: "2026-03-03T11:10:00Z", user_id: "s", username: "kaique", product_name: "Esp Aim" },
  { id: "s57", rating: 5, comment: "conta lol com todas as skins lendarias q eu queria, mt bom demais", created_at: "2026-03-03T09:00:00Z", user_id: "s", username: "mariana", product_name: "Contas LOL" },
  { id: "s58", rating: 4, comment: "bom demais, so queria q tivesse suporte 24h mas fora isso nota 10", created_at: "2026-03-03T07:25:00Z", user_id: "s", username: "tiago", product_name: "Esp Only" },
  // 02/03
  { id: "s59", rating: 5, comment: "mano o fortnite aim e absurdo, to ganhando todas as build fight", created_at: "2026-03-02T23:40:00Z", user_id: "s", username: "yuri", product_name: "Fortnite Esp Aim" },
  { id: "s60", rating: 5, comment: "terceira vez comprando aqui, sempre entrega rapido e funciona certinho", created_at: "2026-03-02T21:20:00Z", user_id: "s", username: "clara", product_name: "Contas Fortnite" },
  { id: "s61", rating: 5, comment: "conta veio com rank ascendente e varias skin rara, mt bom", created_at: "2026-03-02T19:00:00Z", user_id: "s", username: "heitor", product_name: "Contas Valorant" },
  { id: "s62", rating: 5, comment: "suporte me ajudou a instalar tudo pelo discord, atendimento show", created_at: "2026-03-02T16:35:00Z", user_id: "s", username: "leticia", product_name: "Arduino Aim" },
  { id: "s63", rating: 5, comment: "eu e meus amigos compramos junto e ta todo mundo usando sem problema", created_at: "2026-03-02T14:10:00Z", user_id: "s", username: "patrick", product_name: "Color bot" },
  { id: "s64", rating: 4, comment: "funcionou bem, so precisei reiniciar o pc uma vez pra pegar", created_at: "2026-03-02T11:50:00Z", user_id: "s", username: "sophia", product_name: "Inject CS" },
  { id: "s65", rating: 5, comment: "mlk esse spoofer e milagroso, desbaniu ate conta q eu achava q tava perdida", created_at: "2026-03-02T09:25:00Z", user_id: "s", username: "andre", product_name: "Spoofer games" },
  { id: "s66", rating: 5, comment: "aim smooth demais, ngm reporta pq parece natural. to amando", created_at: "2026-03-02T07:55:00Z", user_id: "s", username: "marcos", product_name: "Exclusive VAL" },
  { id: "s67", rating: 5, comment: "comprei a conta e ja entrei jogando comp, tudo certo e funcionando", created_at: "2026-03-02T06:30:00Z", user_id: "s", username: "isabella", product_name: "Contas LOL" },
  { id: "s68", rating: 5, comment: "vale cada real que gastei, produto de qualidade e suporte humano", created_at: "2026-03-02T04:15:00Z", user_id: "s", username: "lorenzo", product_name: "Cyclo Aim" },
  { id: "s69", rating: 5, comment: "irmao paguei barato e o negocio funciona melhor q coisa de 200 conto", created_at: "2026-03-02T02:50:00Z", user_id: "s", username: "danilo", product_name: "Driver Cleaner" },
  { id: "s70", rating: 4, comment: "bom produto, tive q pedir ajuda pro suporte mas resolveram rapido", created_at: "2026-03-02T01:10:00Z", user_id: "s", username: "patricia", product_name: "Fortnite Esp Aim" },
  // extras espalhados entre 02-10
  { id: "s71", rating: 5, comment: "ja indiquei pra uns 10 amigos, todos compraram e aprovaram", created_at: "2026-03-09T19:00:00Z", user_id: "s", username: "helena", product_name: "Contas Fortnite" },
  { id: "s72", rating: 5, comment: "oneclick resolveu meu ban em segundos, produto sensacional", created_at: "2026-03-08T20:10:00Z", user_id: "s", username: "bryan", product_name: "Oneclick" },
  { id: "s73", rating: 5, comment: "o color bot e discreto demais, ninguem suspeita e funciona que e uma beleza", created_at: "2026-03-07T19:30:00Z", user_id: "s", username: "raul", product_name: "Color bot" },
  { id: "s74", rating: 5, comment: "mano comprei o esp aim e meu kda foi de 0.8 pra 2.5 em uma semana kkkk", created_at: "2026-03-06T20:45:00Z", user_id: "s", username: "camila", product_name: "Esp Aim" },
  { id: "s75", rating: 5, comment: "loja confiavel demais, paguei e recebi na hora. sem enrolacao", created_at: "2026-03-05T21:55:00Z", user_id: "s", username: "valentina", product_name: "Contas LOL" },
  { id: "s76", rating: 5, comment: "inject cs ta atualizado sempre, os cara sao rapido nas update", created_at: "2026-03-04T20:15:00Z", user_id: "s", username: "heloisa", product_name: "Inject CS" },
  { id: "s77", rating: 4, comment: "gostei bastante, so achei a interface um pouco complicada no comeco", created_at: "2026-03-03T19:40:00Z", user_id: "s", username: "lara", product_name: "Spoofer games" },
  { id: "s78", rating: 5, comment: "conta com rank imortal 3 e varias skin premium, veio tudo certo", created_at: "2026-03-06T13:10:00Z", user_id: "s", username: "ravi", product_name: "Contas Valorant" },
  { id: "s79", rating: 5, comment: "royal nunca decepciona, ja e minha quinta compra e sempre perfeito", created_at: "2026-03-05T16:30:00Z", user_id: "s", username: "theo", product_name: "Exclusive VAL" },
  { id: "s80", rating: 5, comment: "spoofer resolveu o ban do meu note e do meu pc de mesa, os dois", created_at: "2026-03-04T15:05:00Z", user_id: "s", username: "cecilia", product_name: "Driver Cleaner" },
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
            <span className="text-success">AVALIACOES</span> DOS CLIENTES
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Veja o que nossos clientes estão dizendo sobre nossos produtos
          </p>

          {/* Stats */}
          {reviews.length > 0 && (
            <div className="mt-6 inline-flex items-center gap-4 rounded-xl border border-border bg-card px-6 py-3">
              <div className="flex items-center gap-1.5">
                <Star className="h-5 w-5 fill-warning text-warning" />
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
                          s <= review.rating ? "fill-warning text-warning" : "text-muted-foreground/30"
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
