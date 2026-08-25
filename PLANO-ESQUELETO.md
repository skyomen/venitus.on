# Plano de execução — esqueleto e fluxo rodando

Objetivo: **a jornada inteira funcionando ponta a ponta, com login pronto, faltando apenas as APIs
externas reais.** Todo conector entra como stub (blueprint §10.5), então nada fica travado esperando
credencial ou documentação de terceiro.

Referências: [`AGENTS.md`](AGENTS.md) · [`MEMORY.md`](MEMORY.md) ·
[`Blueprint estructure - SaaS.md`](Blueprint%20estructure%20-%20SaaS.md)

---

## 1. Ponto de partida

| Item                    | Estado                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Node                    | v24.12 ✅                                                                                           |
| npm                     | v11.12 ✅                                                                                           |
| Docker + Compose        | 29.6 / v5.3 ✅                                                                                      |
| Git                     | 2.53 ✅                                                                                             |
| Repositório             | `github.com/skyomen/venitus.on` — existe e está **vazio** ✅                                        |
| `git config user.email` | **não configurado** — será `meyksonleite@gmail.com`                                                 |
| `gh` CLI                | **não instalado** — push por HTTPS; o Credential Manager do Windows deve pedir autenticação uma vez |
| Supabase CLI            | entra como dependência de desenvolvimento do projeto                                                |

---

## 2. Como as fatias funcionam

Cada fatia **fecha verde** (`npm run portao`: lint, typecheck, testes, cobertura ≥98% em linhas e
branches, duplicação ≤2%, build) e **entrega algo demonstrável**. Nenhuma fatia deixa o repositório em
estado intermediário.

Trabalho em branch por fatia, `main` protegida depois do primeiro push.

**Como o 98% se sustenta desde o início:** páginas e layouts ficam finos — só composição — e toda a lógica
vive em módulos puros que recebem dependências por parâmetro. Isso não é disciplina de teste, é a
arquitetura do blueprint. Retrofitar cobertura depois custa muito mais do que nascer com ela.

---

## 3. As fatias

### Fatia 0 — Repositório e portão de qualidade

**Objetivo:** o portão existe e é verde antes de haver produto para quebrá-lo.

- `git init`, identidade, `.gitignore`, primeiro commit, remote e push
- Next.js (App Router) + TypeScript `strict`
- Vitest + cobertura v8 com limiar 98% (linhas e branches), ESLint, Prettier, jscpd em 2%
- `lefthook`: pre-commit (lint/format nos alterados) e pre-push (portão inteiro)
- `scripts/portao.sh` e `npm run portao`
- GitHub Actions rodando o mesmo portão
- `README.md` com o caminho de 5 minutos

**Aceite:** `npm run portao` verde; CI verde no primeiro PR; `git push` concluído.

---

### Fatia 1 — Tenant, RLS e o teste que protege tudo

**Objetivo:** o isolamento entre corretoras existe e está provado antes de qualquer dado de negócio entrar.

- Supabase CLI local (`supabase start`), migration `001_tenant`
- `corretora`, `usuario`, `usuario_corretora` (índice único de 6.1), `plano`, `produto`, `seguradora`
- Hook de access token com `corretora_id` e `papel`; `corretora_atual()`, `papel_atual()`
- RLS habilitado **e forçado**, policies com `using` + `with check`, revokes de `anon`, índices de tenant
- Categoria declarada em cada tabela (§6.6)
- **Teste de isolamento gerado do catálogo**, rodando contra o Postgres real
- Seed sintético: duas corretoras e os usuários da seção 5

**Aceite:** usuário da corretora A não lê nem escreve nada de B, em nenhuma tabela; tabela nova sem policy
quebra o pipeline.

---

### Fatia 2 — Login e as três áreas

**Objetivo:** você entra no painel. É a fatia que você pediu explicitamente.

- Autenticação **no servidor**, sessão em cookie `HttpOnly` (nenhum cliente Supabase no navegador)
- `/entrar`, `/sem-permissao`, logout
- `/admin`, `/gestor`, `/app` com guard e bloqueio cruzado
- Redirecionamento por papel após o login
- Faixa de modo de dados no topo (§18)
- Cabeçalhos de segurança e CSP
- Teste de payload (PII não vaza no HTML) e E2E de login + bloqueio cruzado

**Aceite:** os três usuários entram e cada um só alcança a própria área; `service_role` e chave de banco
ausentes do bundle.

> MFA: o cadastro fica implementado nesta fatia, mas a **obrigatoriedade** para `PLATFORM_ADMIN` e
> `GESTOR` só é ligada no ambiente de produção — senão trava o desenvolvimento local a cada login.

---

### Fatia 3 — Domínio e máquina de estados

**Objetivo:** a jornada existe como estrutura, com transições que o banco garante.

- Migration `002_dominio`: `contato`, `oportunidade`, `qualificacao`, `risco_veiculo`, `interacao`,
  `oportunidade_evento`, `cotacao`, `cotacao_opcao`, `proposta`, `apolice`, `pendencia`, `documento`
- Migration `003_configuracao`: `canal_captacao`, `corretora_produto`, `horario_atendimento`,
  `regra_distribuicao`, `template_mensagem`, `investimento_midia`
- Migration `004_plataforma`: `agendamento`, `integracao_outbox`, `integracao_evento`,
  `integracao_saude`, `integracao_credencial`, `lead_quarentena`, `auditoria`
- Função de transição (os seis passos de §8.2) + trigger que recusa `update` solto em `etapa`
- Regra de deduplicação de contato (§8.4)

**Aceite:** transição inválida é recusada pelo banco; toda transição grava evento; RLS e teste de
isolamento cobrindo as tabelas novas.

---

### Fatia 4 — Conectores stub e entrada de lead

**Objetivo:** o lead entra pela porta certa e a jornada anda sem nenhuma API real.

- `contrato.ts` e `registro.ts` (escolhe real ou stub por corretora)
- Stubs: validadores (CPF, CEP, placa, WhatsApp ativo), WhatsApp, CRM, seguradora, e-mail
- Webhook de entrada com assinatura verificada, corpo cru persistido, deduplicação
- Resolução de tenant por `canal_captacao`; canal desconhecido → `lead_quarentena` + alarme
- Validação em cadeia de §8.3, pedindo só o dado faltante
- Outbox + idempotência + disjuntor
- Teste de contrato: stub e real cumprem o mesmo acordo

**Aceite:** lead sintético entra por um canal, é validado em cadeia e chega a `QUALIFICADO`; canal
desconhecido nunca vira oportunidade.

---

### Fatia 5 — Fila, distribuição e follow-up

**Objetivo:** o motor que faz o produto ser uma operação, e não um cadastro.

- Cálculo de prioridade (§9.3) com pesos por corretora
- Distribuição com `FOR UPDATE SKIP LOCKED`, capacidade e horário
- Worker drenando `agendamento` e `integracao_outbox`
- As três réguas (§11.1), janela de 24 h (§11.4), dono da conversa (§11.5)
- Cancelamento de agendamentos quando o cliente responde

**Aceite:** dois workers em paralelo nunca entregam a mesma oportunidade; responder ao cliente cancela a
régua; fora da janela de 24 h só sai template aprovado.

---

### Fatia 6 — As telas do fluxo

**Objetivo:** o fluxo deixa de ser API e vira produto.

- `/app`: início que responde "o que preciso fazer agora", fila, atendimento com o contexto de §9.5,
  cotação, proposta, pendências, carteira
- `/gestor`: funil, SLA, produtividade
- `/admin`: corretoras, usuários, saúde das integrações
- Mobile primeiro, 1–2 cliques, acessibilidade (§5.4)
- Todo Client Component recebendo DTO

**Aceite:** a jornada completa é percorrível pela interface, em um telefone.

---

### Fatia 7 — Homologação em Docker e modos de dados

**Objetivo:** rodar a stack inteira como se fosse produção, com volume realista.

- `docker-compose.homologacao.yml` (PostgREST **não** publicado no host)
- Gerador de volume sintético: várias corretoras, etapas variadas, pendências vencidas, disjuntor aberto
- Estrutura dos modos de dados e dos scripts de espelho — a conexão com produção fica pronta, mas só é
  usada quando existir produção
- E2E rodando contra a homologação

**Aceite:** `docker compose up` sobe tudo; os E2E passam contra o ambiente em Docker.

---

### Fatia 8 — Renovação e carteira

**Objetivo:** fechar o ciclo que faz o produto ter receita recorrente.

- Emissão agenda D-60; o agendamento abre oportunidade nova no mesmo contato (§8.5)
- Importação de carteira: validação prévia, relatório por linha, idempotente, reversível por lote
- Apólices importadas já agendam renovação
- Roteiro de entrada de corretora com teste de fumaça (§19.1)

**Aceite:** apólice emitida gera renovação no prazo; reimportar o mesmo arquivo não duplica nada.

---

## 4. Credenciais de acesso ao painel

Criadas pelo seed, **apenas em ambiente local e de homologação**. Nunca em produção.

| E-mail                 | Papel            | Corretora      |
| ---------------------- | ---------------- | -------------- |
| `admin@venitus.local`  | `PLATFORM_ADMIN` | —              |
| `gestor@alfa.local`    | `GESTOR`         | Corretora Alfa |
| `consultor@alfa.local` | `CONSULTOR`      | Corretora Alfa |
| `gestor@beta.local`    | `GESTOR`         | Corretora Beta |
| `consultor@beta.local` | `CONSULTOR`      | Corretora Beta |

Senha local para todos: `Venitus@Local123`

As duas corretoras existem desde a fatia 1 porque o teste de isolamento precisa de duas. Não é enfeite:
é o que prova que o vazamento não acontece.

---

## 5. O que fica de fora, e por quê

| Fora do escopo                                                           | Motivo                                                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| APIs externas reais (CRM, WhatsApp, seguradora, validadores, retaguarda) | Chegam por partes. Todos os stubs cumprem o contrato e a fila é reprocessável (§10.5). |
| Faturamento da plataforma                                                | Decisão A8 em aberto — não existe nos documentos. Não bloqueia o esqueleto.            |
| Ramos além de automóvel                                                  | Decisão A9. A estrutura já comporta (§7.7).                                            |
| Realtime                                                                 | Decisão D6. Atualização por revalidação no servidor.                                   |
| Permissões finas dentro de papel                                         | Roadmap. Os três papéis cobrem o MVP.                                                  |
| Snapshot real de produção                                                | Só faz sentido quando houver produção. A estrutura fica pronta na fatia 7.             |

---

## 6. Riscos conhecidos

| Risco                            | Mitigação                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Cobertura de 98% em código de UI | Páginas finas, lógica em módulos puros. O denominador está definido em §20.6.                |
| Teste de RLS exige Postgres real | Supabase CLI local sobre Docker, que já está instalado. Mock não prova policy.               |
| `gh` ausente                     | Push por HTTPS. Se o Credential Manager não resolver, você autentica uma vez pelo terminal.  |
| Stub mascarando erro de contrato | Teste de contrato e marcação `origem_resposta = 'STUB'`; venda de stub não entra em métrica. |
| Fatias grandes demais            | Cada uma termina verde e demonstrável. Se uma crescer, ela é dividida antes de começar.      |

---

## 7. Ordem de execução

```
0 Portão  →  1 Tenant/RLS  →  2 Login  →  3 Domínio  →  4 Conectores stub
                                              ↓
                          8 Renovação  ←  7 Docker  ←  6 Telas  ←  5 Fila/follow-up
```

Depois da fatia 2 você já entra no painel. Depois da 6, o fluxo inteiro é percorrível pela interface.
