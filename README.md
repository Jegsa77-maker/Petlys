# Plataforma Pet

Marketplace de serviços pet — Pilar 1 (conexão entre Tutor e Profissional).
Next.js (App Router) + Vercel · Supabase (PostgreSQL, Auth) · Pagar.me.

Baseado na Especificação Funcional v1.2 e no documento de Arquitetura da Fase 2.

## Stack

- **Frontend/Hosting:** Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript
- **Backend/Dados:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Formulários/validação:** React Hook Form + Zod
- **Ícones:** lucide-react
- **Pagamento:** Pagar.me (a integrar)

## Setup local

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o projeto no Supabase (se ainda não tiver)

Em [supabase.com](https://supabase.com), crie um projeto novo. Depois, em
**Project Settings > API**, copie:
- `Project URL`
- `anon public key`
- `service_role key` (nunca exponha esta no client)

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `.env.local` com as chaves do passo anterior.

### 4. Habilitar login social no Supabase

Em **Authentication > Providers**, habilite **Google** e **Facebook**, com as
credenciais OAuth de cada provedor (Google Cloud Console / Meta for
Developers). Nas URLs de redirecionamento autorizadas de cada provedor,
adicione:

```
https://<seu-projeto>.supabase.co/auth/v1/callback
```

E, na URL de callback do próprio app (usada pelo `app/(auth)/callback/route.ts`):

```
http://localhost:3000/callback           # desenvolvimento
https://<seu-dominio-vercel>.app/callback # produção
```

### 5. Habilitar login por telefone (OTP/SMS)

Em **Authentication > Providers > Phone**, habilite o provedor de SMS
(Twilio, MessageBird ou Vonage — configurar credenciais próprias).

### 6. Rodar as migrações SQL

Com o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e
logado (`supabase login`), linkado ao projeto (`supabase link`):

```bash
supabase db push
```

Isso aplica, em ordem, os arquivos em `supabase/migrations/` — testados
localmente ponta a ponta antes da entrega (schema, RLS, triggers de
auditoria de parâmetros e de bloqueio de saque por incidente).

### 7. Rodar o projeto

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Estrutura do projeto

```
app/
  (auth)/login/           # Tela de login (Google/Facebook)
  (auth)/callback/        # Route handler do OAuth
  (onboarding)/verificar-telefone/   # Verificação de telefone por OTP
  (onboarding)/escolher-perfil/      # Escolha Tutor/Profissional + CPF/CNPJ
lib/
  supabase/client.ts       # Cliente Supabase para Client Components
  supabase/server.ts       # Cliente Supabase para Server Components/Actions
  supabase/middleware.ts   # Renovação de sessão + controle de acesso por rota
  actions/auth.ts          # Server Actions de autenticação/onboarding
  validations/auth.ts      # Schemas Zod
types/database.ts          # Tipos gerados a partir do schema SQL real
supabase/migrations/       # 16 migrações SQL (schema completo + RLS)
proxy.ts                   # Middleware/Proxy do Next.js (proteção de rotas)
```

## O que já está pronto (Fase 3)

- Schema completo do banco (22 tabelas, RLS em 100% delas, triggers de
  auditoria e de bloqueio automático de saque por incidente) — testado
  localmente com Postgres real antes da entrega.
- Autenticação social (Google/Facebook) via Supabase Auth.
- Verificação obrigatória de telefone por código antes de liberar o uso do
  app (conta só é considerada ativa com telefone + e-mail verificados).
- Escolha de perfil (Tutor e/ou Profissional na mesma conta), com validação
  de 18 anos e coleta de CPF/CNPJ quando aplicável.
- Proteção de rotas por sessão e por papel (`/admin` exige administrador,
  `/supervisor` exige supervisor ou administrador).
- Fluxo do Tutor: busca por categoria/localização, cadastro de pet,
  solicitação (single ou multi-pet, recorrente), chat, proposta, aceite.
- Fluxo do Profissional: agenda/bloqueios, serviços e preços, Kanban de
  atendimentos (check-in → em andamento → finalização → concluído),
  avaliação bilateral ao final.
- Painel do Administrador/Supervisor: dashboard, fila de incidentes,
  parâmetros comerciais, gestão de supervisores.
- Máquina de estados formal de `requests`, reforçada por trigger no banco
  (`request_status_transitions_allowed`), incluindo o ciclo de ocorrências
  recorrentes (concluir uma ocorrência libera o check-in da próxima).

## Próximos passos

- Integração real com Pagar.me (cobrança, split, extrato, saque) —
  `lib/actions/payments.ts` e `payouts.ts` ainda não existem, assim como
  as rotas `/financeiro` do Tutor e do Profissional. Hoje o avanço
  `aguardando_pagamento → confirmado` só acontece manualmente/via seed,
  não existe webhook de pagamento.
- **Reagendamento de ocorrências.** Hoje a data de cada atendimento (mesmo
  em contratos recorrentes) só é definida na criação da solicitação — não
  existe UI nem Server Action pra alterar depois. Quando for implementado,
  a mudança deve partir do **Tutor**, escolhendo um horário livre dentro
  da disponibilidade já cadastrada pelo Profissional em `/agenda`
  (`professional_availability`) — não um campo de data solto.
- Testes automatizados (Fase 4) e pipeline de CI/CD (Fase 5).
