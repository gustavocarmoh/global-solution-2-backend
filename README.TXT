========================================
Meeting Room Scheduler API - README.TXT
========================================

1. DESCRICAO GERAL
------------------
API REST em Node.js/Express com TypeScript, Oracle Database e JWT. Permite:
- Cadastro/autenticacao de clientes.
- Gerenciamento de perfil (role, disponibilidade, foto, idade).
- Agendamento de salas com checagem de conflitos.
- Chat de suporte humano e chat IA (OpenAI ou fallback).
- Endpoint para automatizar liberacao de agendamentos via PL/SQL.

2. FUNCOES, METODOS E CLASSES
-----------------------------
Camada de controllers (src/controllers):
  - authController.ts
      * register(req,res): valida unicidade de email, gera hash de senha (bcrypt), cria cliente e retorna token JWT assinado (jsonwebtoken). Justificativa: centralizar criacao e resposta padronizada.
      * login(req,res): consulta cliente, compara hash, devolve token + perfil. Justificativa: fluxo stateless com JWT.
  - profileController.ts
      * getProfile(req,res): busca dados do cliente logado usando withOracleConnection.
      * updateProfile(req,res): atualiza campos dinamicamente, valida disponibilidade (objeto {dia: [horarios]}). Justificativa: flexibilidade e validacoes sem duplicar codigo.
  - bookingController.ts
      * createBooking/listBookings/updateBooking/cancelBooking: operacoes CRUD com verificacao de conflitos (`assertRoomAvailability`) e garantias de integridade via Oracle (DATE/TIMESTAMP). Justificativa: encapsular logica de agenda e prevenir sobreposicoes.
  - chatController.ts
      * sendSupportMessage/listSupportMessages: gerencia canal SUPORT, grava mensagens em `support_messages`.
      * sendAiMessage: coleta disponibilidade do perfil e chama `generateAiResponse` (OpenAI ou fallback) para armazenar respostas IA.
  - automationController.ts
      * releaseExpiredBookings: executa procedure `PROC_RELEASE_EXPIRED_BOOKINGS` via PL/SQL bind out, retornando linhas afetadas.

Camada de middleware (src/middleware):
  - auth.ts: `authenticate` le header Authorization, valida JWT e anexa `req.user`. Justificativa: proteger rotas e disponibilizar contexto do cliente.
  - validation.ts: `handleValidationErrors` usa express-validator para formatar erros. Beneficio: respostas consistentes.

Camada de servicos/utilitarios:
  - services/aiService.ts: `generateAiResponse` integra OpenAI Chat Completions e fallback heuristico para quando nao ha chave configurada. Beneficio: comportamento previsivel em dev/offline.
  - utils/db.ts: `withOracleConnection` gerencia conexao/pool e garante fechamento correto.
  - config/oracle.ts: inicializa pool global e encerra em SIGINT/SIGTERM.

3. INSTRUCOES DE EXECUCAO
-------------------------
1) `npm install`
2) Criar `.env` com credenciais Oracle, `JWT_SECRET`, opcional `OPENAI_API_KEY`.
3) Executar procedure PL/SQL (`sqlplus user/pwd@//host/service @plsql/automation.sql`).
4) Rodar:
   - Desenvolvimento: `npm run dev`
   - Produção: `npm run build && npm start`
5) Testar health check em `GET /health` e endpoints autenticados com header `Authorization: Bearer <token>`.

Justificativas tecnicas:
- Uso de `tsx` em dev evita build manual.
- `withOracleConnection` minimiza vazamentos de conexao.
- `.env.example` padroniza configuracao entre ambientes.

4. TECNOLOGIAS ADOTADAS E BENEFICIOS
------------------------------------
- **Express + TypeScript**: rapidez de desenvolvimento com tipagem forte para evitar erros de runtime e permitir IDE/autocomplete robustos.
- **OracleDB (`oracledb`)**: suporte a PL/SQL, transacoes robustas e integracao com sistemas corporativos existentes.
- **JWT (`jsonwebtoken`)**: autenticação stateless; facilita escalabilidade horizontal.
- **bcryptjs**: hash seguro de senhas; livre de dependencia nativa.
- **express-validator**: valida inputs declarativamente, reduzindo codigo manual.
- **OpenAI SDK**: integra assistente virtual real quando credenciais estao disponiveis; fallback garante resiliencia.
- **dotenv**: facilita gerenciar configuracoes sensiveis sem hardcode.
- **tsc + tsconfig**: gera build otimizado (`dist/`) para producao.