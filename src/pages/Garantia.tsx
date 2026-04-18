import Header from "@/components/Header";
import { ArrowLeft, Shield, Clock, MessageCircle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Garantia = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-success transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-8">Garantia</h1>

        <div className="grid gap-4 sm:grid-cols-2 mb-10">
          {[
            { icon: Shield, title: "Produtos Verificados", desc: "Todos os produtos passam por verificação antes da entrega." },
            { icon: Clock, title: "Suporte Rápido", desc: "Atendimento em até 24 horas para qualquer problema." },
            { icon: MessageCircle, title: "Canal Direto", desc: "Suporte via tickets no painel e Discord." },
            { icon: CheckCircle, title: "Satisfação Garantida", desc: "Se houver problema, resolvemos ou reembolsamos." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="h-6 w-6 text-success mb-3" />
              <h3 className="font-semibold text-foreground text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Cobertura da Garantia</h2>
            <p>Nossa garantia cobre defeitos nos produtos entregues, discrepâncias entre o anunciado e o recebido, e problemas técnicos que impeçam o uso do produto. A garantia é válida conforme o período especificado em cada produto.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Softwares</h2>
            <p>Softwares possuem garantia durante todo o período da licença adquirida. Se o software apresentar falhas durante o período contratado, forneceremos suporte técnico, substituição ou crédito na plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Contas de Jogos</h2>
            <p>Contas possuem garantia de 12 horas após a entrega para verificação do inventário e detalhes. Caso a conta não corresponda à descrição, realizaremos a troca ou reembolso integral.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Como Acionar a Garantia</h2>
            <p>Abra um ticket pelo seu painel em "Meus Pedidos" ou entre em contato pelo nosso Discord. Tenha em mãos o ID do pedido e prints/evidências do problema.</p>
          </section>
        </div>

        <p className="mt-12 text-xs text-muted-foreground">Última atualização: Março de 2026</p>
      </main>
    </div>
  );
};

export default Garantia;
