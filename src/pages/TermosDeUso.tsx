import Header from "@/components/Header";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermosDeUso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-success transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-8">Termos de Uso</h1>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar a Royal Store, você concorda em cumprir e ficar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá usar nossos serviços.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Descrição dos Serviços</h2>
            <p>A Royal Store é uma plataforma de comércio digital que oferece softwares, contas de jogos verificadas e produtos digitais relacionados a games. Nossos serviços incluem a venda de licenças de software, contas de jogos e suporte técnico.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Cadastro e Conta</h2>
            <p>Para realizar compras, é necessário criar uma conta. Você é responsável por manter a confidencialidade de suas credenciais de acesso. Todas as atividades realizadas em sua conta são de sua responsabilidade.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Uso Aceitável</h2>
            <p>Você concorda em utilizar nossos serviços apenas para fins legais e de acordo com estes termos. É proibido revender, redistribuir ou compartilhar os produtos adquiridos sem autorização prévia.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Propriedade Intelectual</h2>
            <p>Todo o conteúdo da Royal Store, incluindo textos, gráficos, logos e software, é protegido por direitos autorais. Você não pode copiar, modificar ou distribuir qualquer conteúdo sem autorização.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Limitação de Responsabilidade</h2>
            <p>A Royal Store não se responsabiliza por danos indiretos, incidentais ou consequenciais resultantes do uso de nossos serviços. Nossa responsabilidade total é limitada ao valor pago pelo produto ou serviço em questão.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Modificações dos Termos</h2>
            <p>Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entram em vigor imediatamente após a publicação. O uso continuado dos serviços após alterações constitui aceitação dos novos termos.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Contato</h2>
            <p>Para dúvidas sobre estes Termos de Uso, entre em contato conosco através do nosso Discord ou e-mail de suporte.</p>
          </section>
        </div>

        <p className="mt-12 text-xs text-muted-foreground">Última atualização: Março de 2026</p>
      </main>
    </div>
  );
};

export default TermosDeUso;
