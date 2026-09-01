# Ideias futuras — funcionalidades ainda não detalhadas

Este arquivo é diferente do `BACKLOG.md`: lá ficam itens que **já apareceram no escopo de uma história em andamento** e foram conscientemente adiados. Aqui ficam **ideias de produto** para ondas que ainda não começaram — pensadas em voz alta, sem desenho técnico, sem decisão de escopo fechada. Quando uma onda relevante começar, cada ideia daqui deve ser transformada em história de verdade (com desenho técnico e critério de aceite) ou descartada explicitamente — não fica aqui para sempre por omissão.

Cada ideia registra: onda/tema onde ela se encaixa, o que a pessoa descreveu, e as dependências/decisões que ela evidentemente vai exigir (sem comprometer a nenhuma delas ainda).

---

## Onda 5 — CRM do Profissional

### Kanban reordenável pelo Profissional + otimização de rota

Hoje o Kanban (`components/kanban/kanban-board.tsx`) ordena os atendimentos do dia automaticamente por horário (`scheduled_at`). A ideia:

1. O Profissional poder **reordenar manualmente** os cards, conforme a ordem real em que pretende atender (não necessariamente a ordem cronológica dos horários combinados).
2. Depois desse arranjo manual, o CRM analisa os **endereços dos atendimentos do dia** e sugere uma ordem mais rápida/eficiente — exigindo integração com algum sistema de rotas/tráfego (Google Maps Directions API, Mapbox, ou similar).
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

*Última atualização: 2026-09-01.*
