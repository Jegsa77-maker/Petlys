/**
 * Termos de Uso e Política de Privacidade (seção 6.1) — aceite versionado.
 *
 * IMPORTANTE: o texto abaixo é um placeholder funcional, não uma peça
 * jurídica pronta. Antes de operar com usuários e dinheiro reais, este
 * texto precisa de revisão por um advogado (ver seção 7 do plano 100% —
 * "termos de uso, privacidade, cancelamento, disputa, suspensão e
 * apelação" está listado como decisão que bloqueia o 100%, não como algo
 * que o código sozinho resolve).
 *
 * CURRENT_TERMS_VERSION muda sempre que o texto mudar de forma relevante —
 * isso força todo usuário (mesmo quem já tinha aceitado antes) a aceitar de
 * novo no próximo acesso (ver lib/supabase/middleware.ts).
 */
export const CURRENT_TERMS_VERSION = "2026-09-02";

export const TERMS_OF_USE_TEXT = `
Estes Termos de Uso regulam o acesso e uso da Plataforma Pet ("Plataforma"),
que conecta Tutores de animais de estimação a Profissionais de serviços pet.

1. A Plataforma atua como intermediária entre Tutores e Profissionais,
   facilitando a busca, contratação, comunicação e pagamento de serviços.
   A Plataforma não presta os serviços de pet care diretamente.

2. Cadastro: você declara que as informações fornecidas são verdadeiras e
   se compromete a mantê-las atualizadas, incluindo os dados do prontuário
   de cada pet cadastrado.

3. Responsabilidades do Tutor: fornecer informações completas e corretas
   sobre o pet (saúde, comportamento, rotina e emergência) relevantes para
   a segurança do atendimento contratado.

4. Responsabilidades do Profissional: prestar o serviço contratado com
   zelo, cumprir os horários combinados e manter as habilitações exigidas
   por categoria de serviço em dia.

5. Pagamentos: valores e formas de pagamento são definidos na proposta
   aceita entre as partes, processados através do provedor de pagamentos
   integrado à Plataforma.

6. Cancelamento: as políticas de cancelamento e reembolso vigentes estão
   descritas na proposta de cada atendimento e nos parâmetros comerciais
   públicos da Plataforma.

7. Suspensão: contas que violarem estes Termos, as políticas de segurança
   ou a legislação aplicável podem ter o acesso suspenso, com direito a
   recurso conforme o processo interno de moderação.

8. Alterações: estes Termos podem ser atualizados; mudanças relevantes
   exigem novo aceite explícito antes de você continuar usando a
   Plataforma.

Versão: ${CURRENT_TERMS_VERSION}
`.trim();

export const PRIVACY_POLICY_TEXT = `
Esta Política de Privacidade descreve como a Plataforma Pet coleta, usa e
protege seus dados pessoais e os dados dos pets cadastrados.

1. Dados coletados: nome, e-mail, telefone, CPF/CNPJ (quando aplicável),
   localização aproximada, e informações do prontuário de cada pet (saúde,
   comportamento, rotina e emergência).

2. Finalidade: os dados são usados para viabilizar a contratação de
   serviços, comunicação entre as partes, segurança do atendimento e
   cumprimento de obrigações legais e comerciais.

3. Compartilhamento do prontuário do pet: os dados de saúde e
   comportamento de cada pet só são compartilhados com o Profissional
   selecionado mediante autorização explícita do Tutor, registrada no
   momento da solicitação de atendimento.

4. Retenção: seus dados são mantidos enquanto sua conta estiver ativa e
   pelo prazo adicional exigido por obrigações legais.

5. Seus direitos (LGPD): você pode solicitar acesso, correção, exclusão ou
   portabilidade dos seus dados a qualquer momento pelos canais de suporte
   da Plataforma.

6. Segurança: aplicamos controles de acesso (RLS) por papel e por relação
   com cada registro, de forma que cada usuário só acessa os dados
   estritamente necessários à sua função na Plataforma.

Versão: ${CURRENT_TERMS_VERSION}
`.trim();
