import Header from "@/components/Header";
import { ArrowLeft, HelpCircle, ShoppingCart, CreditCard, Key, MessageCircle, ExternalLink } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    category: "Compras",
    icon: ShoppingCart,
    items: [
      { q: "Como faço uma compra?", a: "Navegue pelos produtos, escolha o plano desejado, adicione ao carrinho e finalize o pagamento via PIX. Após confirmação, o produto é entregue automaticamente." },
      { q: "Quanto tempo leva para receber?", a: "Produtos digitais são entregues instantaneamente após a confirmação do pagamento. O PIX é confirmado em poucos segundos." },
      { q: "Posso comprar mais de um produto?", a: "Sim! Adicione quantos produtos quiser ao carrinho e finalize tudo em uma única compra." },
    ],
  },
  {
    category: "Pagamentos",
    icon: CreditCard,
    items: [
      { q: "Quais formas de pagamento aceitas?", a: "Atualmente aceitamos PIX como método de pagamento principal. É rápido, seguro e sem taxas adicionais." },
      { q: "O pagamento é seguro?", a: "Sim! Utilizamos gateways de pagamento certificados e criptografia em todas as transações." },
      { q: "E se o pagamento não for confirmado?", a: "Se o pagamento não for confirmado em 30 minutos, o pedido expira automaticamente. Nenhum valor é cobrado." },
    ],
  },
  {
    category: "Produtos",
    icon: Key,
    items: [
      { q: "Onde encontro meus produtos?", a: "Acesse 'Meus Pedidos' no menu do seu perfil para ver todos os produtos adquiridos e seus detalhes de acesso." },
      { q: "Os softwares são seguros?", a: "Todos os nossos softwares passam por verificação. Monitoramos constantemente o status de detecção e informamos na página do produto." },
      { q: "As contas são verificadas?", a: "Sim, todas as contas passam por verificação de inventário e dados antes de serem listadas na loja." },
    ],
  },
  {
    category: "Suporte",
    icon: MessageCircle,
    items: [
      { q: "Como entro em contato com o suporte?", a: "Você pode abrir um ticket pelo seu painel em 'Meus Pedidos' ou entrar em contato pelo nosso Discord." },
      { q: "Qual o horário de atendimento?", a: "Nosso suporte funciona 24/7 pelo Discord. Tickets são respondidos em até 24 horas." },
      { q: "Como reportar um problema?", a: "Abra um ticket com o ID do pedido e uma descrição detalhada do problema, incluindo prints se possível." },
    ],
  },
];

const CentralAjuda = () => {
  const navigate = useNavigate();
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-success transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Central de Ajuda</h1>
        <p className="text-muted-foreground text-sm mb-10">Encontre respostas para as perguntas mais frequentes.</p>

        <div className="space-y-8">
          {faqs.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.category}>
                <h2 className="flex items-center gap-2 text-base font-bold text-foreground mb-4">
                  <Icon className="h-5 w-5 text-success" />
                  {section.category}
                </h2>
                <div className="space-y-2">
                  {section.items.map((item, i) => {
                    const key = `${section.category}-${i}`;
                    const isOpen = openItems[key];
                    return (
                      <div key={key} className="rounded-lg border border-border bg-card overflow-hidden">
                        <button
                          onClick={() => toggle(key)}
                          className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-medium text-foreground hover:text-success transition-colors"
                        >
                          {item.q}
                          <HelpCircle className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-45 text-success" : "text-muted-foreground"}`} />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <p className="px-5 pb-4 text-sm text-muted-foreground">{item.a}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-xl border border-success/20 bg-success/5 p-6 text-center">
          <h3 className="text-foreground font-semibold mb-2">Não encontrou sua resposta?</h3>
          <p className="text-sm text-muted-foreground mb-4">Entre em contato com nosso suporte pelo Discord.</p>
          <a
            href="https://discord.gg/FeJ5JAZFmU"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground hover:shadow-[0_0_20px_hsl(130,99%,41%,0.4)] transition-all"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir Discord
          </a>
        </div>
      </main>
    </div>
  );
};

export default CentralAjuda;
