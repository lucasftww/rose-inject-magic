import Header from "@/components/Header";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PoliticaReembolso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-success transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-8">Política de Reembolso</h1>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Condições Gerais</h2>
            <p>Devido à natureza digital dos nossos produtos, reembolsos são analisados caso a caso. Entendemos que situações inesperadas podem ocorrer e estamos comprometidos em encontrar a melhor solução.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Softwares e Licenças</h2>
            <p>Reembolsos para softwares são aceitos dentro de 24 horas após a compra, desde que o produto não tenha sido ativado ou utilizado. Após a ativação, o reembolso não é garantido, mas pode ser avaliado em caso de defeito comprovado.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Contas de Jogos</h2>
            <p>Contas de jogos são produtos únicos. Reembolsos são aceitos apenas se a conta entregue não corresponder à descrição anunciada. O cliente deve reportar discrepâncias em até 12 horas após a entrega.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Como Solicitar Reembolso</h2>
            <p>Para solicitar um reembolso, abra um ticket pelo painel do cliente ou entre em contato via Discord. Forneça seu ID do pedido e uma descrição detalhada do motivo. Nossa equipe analisará em até 48 horas úteis.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Processo de Reembolso</h2>
            <p>Reembolsos aprovados são processados pelo mesmo método de pagamento utilizado na compra. O prazo para estorno pode variar de acordo com a instituição financeira, geralmente entre 5 a 15 dias úteis.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Situações Não Reembolsáveis</h2>
            <div className="space-y-3">
              <p>Não são elegíveis a reembolso: produtos utilizados ou ativados, compras realizadas há mais de 7 dias (exceto defeitos), ou situações onde o cliente violou nossos Termos de Uso.</p>
              <p>
                <strong className="text-foreground">Exceção para Contas Full Acesso (FA):</strong> Caso a sua conta Full Acesso apresente problemas irreversíveis dentro do prazo de 7 dias após a compra, ofereceremos a substituição por uma conta de valor equivalente ou intermediário. Essa medida visa garantir uma solução justa, assegurando a sua satisfação e o equilíbrio da operação para ambas as partes.
              </p>
            </div>
          </section>
        </div>

        <p className="mt-12 text-xs text-muted-foreground">Última atualização: Março de 2026</p>
      </main>
    </div>
  );
};

export default PoliticaReembolso;
