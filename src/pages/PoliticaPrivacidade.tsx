import Header from "@/components/Header";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-success transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-8">Política de Privacidade</h1>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Coleta de Dados</h2>
            <p>Coletamos informações que você nos fornece diretamente, como nome de usuário, endereço de e-mail e dados de pagamento. Também coletamos automaticamente informações sobre seu dispositivo e endereço IP para fins de segurança.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Uso dos Dados</h2>
            <p>Utilizamos seus dados para processar pedidos, fornecer suporte ao cliente, melhorar nossos serviços, prevenir fraudes e enviar comunicações relevantes sobre seus pedidos e atualizações da plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Compartilhamento de Dados</h2>
            <p>Não vendemos seus dados pessoais. Compartilhamos informações apenas com processadores de pagamento para concluir transações e com prestadores de serviço que nos auxiliam na operação da plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Segurança</h2>
            <p>Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração ou destruição. Utilizamos criptografia e armazenamento seguro para informações sensíveis.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Cookies</h2>
            <p>Utilizamos cookies para manter sua sessão, lembrar preferências e melhorar sua experiência. Você pode configurar seu navegador para recusar cookies, mas isso pode afetar a funcionalidade do site.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Seus Direitos</h2>
            <p>Você tem direito de acessar, corrigir ou solicitar a exclusão de seus dados pessoais. Para exercer esses direitos, entre em contato conosco através do nosso suporte.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Retenção de Dados</h2>
            <p>Mantemos seus dados pelo tempo necessário para fornecer nossos serviços e cumprir obrigações legais. Dados de transações são mantidos por até 5 anos para fins fiscais.</p>
          </section>
        </div>

        <p className="mt-12 text-xs text-muted-foreground">Última atualização: Março de 2026</p>
      </main>
    </div>
  );
};

export default PoliticaPrivacidade;
