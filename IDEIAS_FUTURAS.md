# Ideias futuras — funcionalidades ainda não detalhadas

Este arquivo é diferente do `BACKLOG.md`: lá ficam itens que **já apareceram no escopo de uma história em andamento** e foram conscientemente adiados. Aqui ficam **ideias de produto** para ondas que ainda não começaram — pensadas em voz alta, sem desenho técnico, sem decisão de escopo fechada. Quando uma onda relevante começar, cada ideia daqui deve ser transformada em história de verdade (com desenho técnico e critério de aceite) ou descartada explicitamente — não fica aqui para sempre por omissão.

Cada ideia registra: onda/tema onde ela se encaixa, o que a pessoa descreveu, e as dependências/decisões que ela evidentemente vai exigir (sem comprometer a nenhuma delas ainda).

---

## Ferramentas do Profissional (fora do escopo do CRM)

**Nota (2026-09-02):** essas duas ideias foram registradas originalmente sob "Onda 5 — CRM do Profissional", mas não são CRM propriamente — uma evolui o Kanban que já existe (Onda 4), a outra é uma ferramenta de marketing/prova social. O CRM em si (clientes próprios, agendamento manual, cartão/QR, assinatura) saiu **por completo** do escopo desta plataforma por decisão do usuário — vai ser tratado como iniciativa separada, discutida no futuro; não fica registrado aqui como "ideia futura da Petlys" porque nem é certo que continue sendo Petlys. O histórico completo dessa discussão (decisões de arquitetura, dúvidas levantadas, riscos) fica preservado na entrada do `CHANGELOG.md` de 2026-09-02, caso a conversa seja retomada.

### Kanban reordenável pelo Profissional + otimização de rota

Hoje o Kanban (`components/kanban/kanban-board.tsx`) ordena os atendimentos do dia automaticamente por horário (`scheduled_at`). A ideia:

1. O Profissional poder **reordenar manualmente** os cards, conforme a ordem real em que pretende atender (não necessariamente a ordem cronológica dos horários combinados).
2. Depois desse arranjo manual, o sistema analisa os **endereços dos atendimentos do dia** e sugere uma ordem mais rápida/eficiente — exigindo integração com algum sistema de rotas/tráfego (Google Maps Directions API, Mapbox, ou similar).
3. Conforme o horário de um atendimento se aproxima, o sistema dá uma **estimativa de tempo de chegada atualizada em tempo real** (considerando trânsito no momento) — parecido com "chegando em X min" que apps de transporte mostram.

**Dependências que essa ideia evidencia (nenhuma decidida ainda):**
- Precisa de **endereço estruturado por atendimento** — hoje a solicitação não tem campo de local/endereço; isso é parte do item 4 da Onda 2 ("solicitação contextual completa"), que precisa vir antes.
- Precisa de um **fornecedor de rotas/tráfego** — decisão de produto/custo pendente (a maioria cobra por chamada de API).
- A estimativa "em tempo real" precisa de **geolocalização contínua do Profissional** (hoje só existe um check-in pontual com lat/lng, não rastreamento contínuo) — implica em uma decisão de privacidade também (o Profissional precisa consentir em compartilhar localização durante o expediente).

### Post automático no Instagram com selo e comentário do Tutor

Ao concluir um atendimento, o Profissional escolhe uma foto (dentre as já anexadas ao relatório do atendimento) para ser publicada automaticamente — uma "colaboração" entre Tutor, Profissional e Petlys, com um selo da marca e o comentário/depoimento do Tutor junto.

**Dependências que essa ideia evidencia (nenhuma decidida ainda):**
- Integração com a **API do Instagram/Meta** — decisão de em qual conta publica (do Profissional? da Petlys? as duas?).
- **Consentimento específico de imagem** — diferente do consentimento de compartilhar o prontuário (seção 6.1 da Especificação v2.0); publicar foto do pet e comentário do Tutor publicamente exige um opt-in próprio, explícito, por publicação (não um consentimento genérico dado uma vez).
- Fluxo de aprovação: é automático assim que o Profissional escolhe a foto, ou tem uma etapa de revisão (do Tutor? da Petlys?) antes de ir ao ar?
- Enquadra-se como ferramenta de marketing/prova social do Profissional — reforça o motivo dele preferir operar dentro da Petlys.

---

## Retenção do Profissional — grupos vindos da Onda 5 (fora o CRM)

Realocado do `BACKLOG.md` em 2026-09-02 — saíram do escopo de fechamento da plataforma, mas continuam válidos como ideia de produto futura da Petlys (diferente do CRM, que saiu por completo, ver nota acima).

### Carreira e engajamento
Petlys Academy (trilhas e certificações, mais elaborado que o cálculo automático de nível de carreira que já existe), Clube de benefícios, Programa Profissional Fundador, comissão diferenciada por plano/nível.
**Dependências:** comissão diferenciada só faz sentido com a Onda 3 (financeiro real) rodando de verdade; Academy e Clube de benefícios dependem de decisão de conteúdo/parceria comercial fechada antes de virarem esforço de desenvolvimento.

### Comunidade e resiliência
Rede de indicação entre profissionais; duplas/grupos de cobertura entre profissionais pra ausência planejada (férias) — acordo informal entre eles, diferente do "backup de emergência" pago pelo Tutor (ver abaixo).
**Dependências:** rede de indicação precisa de decisão de recompensa (crédito? desconto de comissão? de novo depende da Onda 3). Cobertura entre profissionais precisa de decisão prévia de quem responde por incidente durante a cobertura e como fica o split entre titular e substituto.

### Estrutural
Suporte a múltiplos usuários por perfil de estabelecimento (hoje o modelo é 1 perfil = 1 usuário); serviços especializados/novas fontes de renda (ainda sem definição funcional do que seria um "serviço especializado" concretamente).
**Dependências:** múltiplos usuários por perfil é mudança estrutural no modelo de conta (`profiles`/`account_roles`), não incremental — precisa de decisão de permissões internas antes (quem vê financeiro, quem responde chat, etc.).

## Infraestrutura e proteção ampliada — itens vindos da Onda 6

Realocado do `BACKLOG.md` em 2026-09-02. A "proteção de conversa" (5º item da lista original) já foi entregue — ver `CHANGELOG.md`. Os outros 4 seguem como ideia futura:

### Petlys Espaços
Papel de Anfitrião, cadastro de espaço físico, busca/reserva, checklist de entrada/saída, split de pagamento a 3 vias (Anfitrião + Profissional + Petlys), avaliação bilateral, fluxo próprio de incidente de espaço (dano, higiene, fuga).
**Dependências:** maior item técnico do grupo — papel de usuário inteiro novo, e um split financeiro a 3 vias que hoje não existe (o split atual é só Profissional/Petlys). Depende de decisão de modelo de comissão a 3 vias e política de danos/vistoria antes de qualquer desenho técnico.

### Operação regional
Papel de Operador Regional por território, painel local de oferta/demanda/incidentes, campanhas de ativação local, remuneração e limites de autoridade do operador, auditoria central.
**Dependências:** até onde vai a autoridade de um Operador Regional (é praticamente um "mini-Admin" territorial) e como ele é remunerado — sem isso não dá pra estimar esforço de verdade.

### Seguro ou garantia
Dois caminhos possíveis: (1) apólice coletiva com seguradora de verdade (precisa de corretora, volume de operação) ou (2) garantia própria autofinanciada, sem seguradora, estilo "Rover Guarantee"/"Wag Guarantee" (reembolso até um teto, bancado pela Petlys, só pra atendimento pago dentro da plataforma) — caminho que o usuário indicou como mais provável.
**Ponto de atenção jurídico:** no Brasil "seguro" é palavra regulada pela SUSEP — se for o caminho 2 (sem seguradora licenciada), a comunicação precisa dizer "garantia", nunca "seguro".
**Dependências:** decisão financeira de negócio (teto por caso/mês); processo de sinistro pode reaproveitar o fluxo de incidente já existente da Onda 4 (baixo custo técnico quando chegar a hora); sinal de confiança visível no produto; pagamento do reembolso depende da Onda 3 pra ser automatizado.

### Backup de emergência
Tutor contrata cobertura adicional pra atendimento crítico (ex.: pet que precisa de medicação): profissional principal + backup reservam o mesmo horário; se o principal falha, o backup executa e recebe o valor do serviço + fee de urgência; se os dois falharem, um "sitter oficial da Petlys" assume. Diferente da "dupla de cobertura" da seção anterior — aqui é produto pago do Tutor pra Petlys, não acordo informal entre profissionais.
**Perguntas em aberto:** momento da contratação (junto da solicitação ou depois); acionamento automático (reaproveitando o fluxo de no-show já existente) ou manual; efeito reputacional no profissional que falhou; backup garantido ou "melhor esforço"; natureza do "sitter oficial" (profissional comum num programa especial, ou vínculo diferente); escopo por categoria de serviço; pagamento automático depende da Onda 3.

---

*Última atualização: 2026-09-02.*
