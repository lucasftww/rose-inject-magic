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

        <h1 className="text-3xl font-bold text-foreground mb-8">Política de Reembolso e Garantia</h1>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Natureza do Produto Digital e Arrependimento</h2>
            <p>Devido à natureza dos nossos produtos, que são bens digitais de consumo imediato e irreversível (keys, credenciais de contas e licenças de software), o direito de arrependimento (Art. 49 do CDC) <strong>não se aplica</strong> após a visualização, resgate ou entrega das credenciais. Ao prosseguir com a compra e revelar os dados do produto, o cliente concorda expressamente em perder o direito de desistência por arrependimento.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Softwares, Painéis e Licenças (Keys)</h2>
            <p>Após a licença, painel ou key ser entregue, não há possibilidade de reembolso por alegações de "desistência", "compra por engano" ou "incompatibilidade com o sistema do usuário" (é responsabilidade do cliente ler os requisitos do produto antes da compra). Reembolsos ou substituições só ocorrerão caso a key/software seja comprovadamente inválida ou defeituosa na origem.</p>
            <p className="mt-2"><strong className="text-foreground">Exigência de Prova:</strong> Para alegar que um software/key não funciona, exigimos a gravação de tela contínua e sem cortes evidenciando o problema relatado desde a compra/recebimento até a tentativa de ativação/uso.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Contas de Jogos (Acessos e Banimentos)</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Contas NFA (Non-Full Access):</strong> A garantia cobre exclusivamente o momento do primeiro login. O cliente deve verificar o funcionamento em até 12 horas após a compra. Após o primeiro acesso bem-sucedido, por não possuírem dados alteráveis, não nos responsabilizamos por perdas de acesso futuras. Não há reembolsos sob nenhuma hipótese após o login testado e validado.</li>
              <li><strong>Responsabilidade por Banimentos:</strong> Nenhuma conta possui garantia contra bloqueios, suspensões ou banimentos causados por ações do comprador após a entrega (uso de cheats, scripts, conduta tóxica, IP flagged ou qualquer outra violação dos Termos de Serviço da desenvolvedora do jogo).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Disputas, Chargebacks e Bloqueios</h2>
            <p>Prezamos pelo diálogo amigável. A abertura de disputas judiciais, estornos no cartão de crédito (chargeback) ou reclamações diretas nos gateways de pagamento <strong>sem antes esgotar as tentativas de resolução com o nosso suporte</strong> configuram quebra direta de confiança e fraude. Tais ações resultarão no banimento permanente da sua conta em nossa plataforma, bloqueio imediato de todas as assinaturas/produtos adquiridos e envio dos dados para órgãos de proteção ao crédito, caso aplicável.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Como Solicitar Suporte ou Reembolso (Apenas Defeitos)</h2>
            <p>Para relatar um produto defeituoso, abra um ticket no nosso servidor do Discord no prazo máximo de 12 horas após a identificação do problema. Forneça o ID do seu pedido, descrição e obrigatoriamente um vídeo (sem cortes) do problema. Nossa equipe técnica analisará a procedência em até 72 horas úteis.</p>
            <p className="mt-2">Reembolsos aprovados pela avaliação técnica serão processados no método de pagamento original ou convertidos em saldo na loja, a critério da administração. O prazo de crédito para pagamentos via cartão depende exclusivamente da administradora do cartão (podendo levar até 2 faturas).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Situações Não Reembolsáveis (Resumo)</h2>
            <div className="space-y-3">
              <p>Não são elegíveis a reembolso:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Produtos já utilizados, ativados ou cujos dados foram revelados.</li>
                <li>Qualquer conta NFA que já teve o primeiro login realizado e testado.</li>
                <li>Banimentos aplicados ao cliente após o momento da entrega por infrações in-game ou uso de softwares de terceiros.</li>
                <li>Alegações de falta de hardware potente o suficiente para rodar os jogos ou softwares.</li>
              </ul>
              <p className="mt-4 pt-2 border-t border-border/10">
                <strong className="text-foreground">Exceção para Contas Full Acesso (FA):</strong> Caso a sua conta Full Acesso apresente problemas irreversíveis (como recuperações pela publisher que não envolvam culpa do comprador) dentro do prazo de 7 dias após a compra, não aplicaremos reembolso financeiro direto, mas ofereceremos a <strong>substituição por uma conta de valor equivalente ou intermediário</strong>. Essa medida visa garantir uma solução justa, assegurando que o cliente não saia no prejuízo e preservando o equilíbrio da operação.
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
