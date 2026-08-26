# MEMORY.md — Venitus.on

Estado vivo do projeto. Regras duráveis ficam em [`AGENTS.md`](AGENTS.md).
Atualize na mesma sessão em que a decisão ou descoberta acontecer.

---

## 1. Onde estamos

**Fase:** fatias 0 a 5 entregues e verdes. A fatia 6 começou: a fila do consultor já é percorrível
no navegador.

O blueprint (`Blueprint estructure - SaaS.md`) foi reescrito para este produto: stack Supabase, fronteira
de segurança do navegador, RLS, modelo de dados, máquina de estados, conectores e motor de follow-up.

O modelo de tenant foi auditado contra as regras de negócio (seção 6) e as lacunas encontradas já estão
corrigidas no blueprint. As regras de qualidade, Docker e modos de dados estão registradas como spec em
`AGENTS.md`.

**Próximo marco:** 6.2 — o atendimento com o contexto de §9.5, cotação e proposta. Ver a seção 10.

**Repositório:** `https://github.com/skyomen/venitus.on.git` — existe e está vazio.
Identidade dos commits: `meyksonLeite <meyksonleite@gmail.com>`.
`gh` CLI não está instalado; push por HTTPS.

---

## 2. A operação real de hoje

Extraído do fluxograma `Atendimento Leads Total.pdf`. É a operação de uma corretora rodando em HubSpot, e
é o comportamento que a plataforma precisa absorver.

### Sistemas em uso

| Sistema          | Papel hoje                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| **HubSpot**      | CRM: contatos, oportunidades, funil (ex.: "Leads Mauer"), etapas, tarefas, arquivos.                            |
| **Digisac**      | Camada de WhatsApp: contatos, departamentos, service ID, transferência para consultor, encerramento de chamado. |
| **Supabase**     | Persistência dos dados coletados durante a jornada de qualificação.                                             |
| **Portal Suhai** | Cotação, proposta, espelho, transmissão, vistoria, agendamento de rastreador, emissão.                          |
| **Sics**         | Cadastro da venda após a emissão.                                                                               |
| Validadores      | Ferramentas externas de CPF, CEP, placa e WhatsApp ativo.                                                       |

### Etapas macro do funil

`Conscientização` → `Educação` → `Seleção` → `Onboarding`

### Entradas de lead

Landing Page / Chatbot, e WhatsApp direto. Ambas criam contato + oportunidade no CRM.

### Sequência de validação (ordem importa)

Telefone tem WhatsApp ativo → CPF → CEP → placa. Cada falha desvia para "pedir informação faltante" ou
"enviar e-mail". A validação de placa pode retornar mais de um modelo, e nesse caso exige desambiguação.

Campos capturados na validação: `dtNascimento_cpf`, `nome_cpf`, `sexo_cpf`, `cpfCnpj`, `ano_modelo`,
`chassi`, `marca`, `modelo`, `placa`, `qtd_modelos`, `status`.
Campos da oportunidade: `veiculoPlaca`, `veiculoAnoModelo`, `veiculoModelo`, `veiculoTipo`,
`veiculoTipoDeUso`, telefone normalizado com `+55`, garagem em residência / trabalho / estudo,
`dealId`, `dealName`, `dealStage`, `dealStageName`, `userIDRd`.
Campos do contato: `userCPF`, `userEstadoCivil` (casado=1, solteiro=2, demais=3), `userCEP`.

### Cadências de follow-up

- **Inatividade em conversa:** 30 min, 2 h, 3 h sem interação → mensagem personalizada conforme as últimas
  conversas.
- **Abertura sem resposta:** 4 follow-ups sobre templates `01_primeiro_contato`, `2_abertura`,
  `03_primeiro_contato`, `04_abertura`, `05_primeiro_contato`, com 24 h entre chamadas.
- **Recuperação pós-negociação:** etapa `R1` no 1º dia, `R2` no 2º, `R3 - Não Tchau` no 3º; sem resposta,
  oportunidade perdida e chamado encerrado no Digisac.

### Regra de duplicidade em vigor

Contato já existe no Digisac **e** a última mensagem tem menos de 15 dias → oportunidade marcada como
perdida com motivo "Duplicidade". A visão do produto substitui essa regra: preservar histórico e criar nova
oportunidade quando a intenção for nova (`AGENTS.md`, invariante 8).

### Qualificação hoje

Confirmados condutor, veículo e perfil de uso, o lead é marcado como **"Lead Quente"** e transferido ao
consultor responsável — o funil muda para "Negociação Ativa" e o departamento padrão do Digisac passa a ser
o do consultor. Antes disso o robô pergunta a **maior preocupação** (roubo/furto, danos acidentais, danos a
terceiros) e envia um vídeo correspondente à dor.

### Fechamento

Plano → forma de pagamento (boleto ou link de cartão) → CNH e CRLV → confirmação de e-mail e endereço →
proposta no portal → espelho → confirmação do cliente → transmissão → recusa? → vistoria (link) →
rastreador (agendamento) → acompanhamento de pendências → análise da seguradora → emissão → apólice
enviada ao cliente + carteirinha → valor líquido no CRM → cadastro no Sics → oportunidade "Vendida".

---

## 3. Decisões tomadas

| #   | Data       | Decisão                                                                                                                                                                                                                                                                                                |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | 2026-08-25 | `AGENTS.md` e `MEMORY.md` são leitura obrigatória no início de cada sessão.                                                                                                                                                                                                                            |
| D2  | 2026-08-25 | Multi-tenant é requisito de fase 1: `corretora_id` em toda tabela de domínio, desde a primeira migration.                                                                                                                                                                                              |
| D3  | 2026-08-25 | Stack canônica: **Next.js (App Router) + Supabase + Vercel**. Fecha a decisão A1.                                                                                                                                                                                                                      |
| D4  | 2026-08-25 | **O navegador não recebe credencial de banco.** Sem cliente Supabase no browser, sem `NEXT_PUBLIC_SUPABASE_*`, sessão em cookie `HttpOnly`. RLS permanece obrigatório como segunda muralha.                                                                                                            |
| D5  | 2026-08-25 | O estado da jornada é da plataforma; o CRM externo é espelho, sincronizado por outbox.                                                                                                                                                                                                                 |
| D6  | 2026-08-25 | Realtime desligado no v1 — ele exigiria token de banco no navegador. Atualização por revalidação no servidor e SSE.                                                                                                                                                                                    |
| D7  | 2026-08-25 | Três papéis com rotas isoladas: `PLATFORM_ADMIN` (`/admin`), `GESTOR` (`/gestor`), `CONSULTOR` (`/app`).                                                                                                                                                                                               |
| D8  | 2026-08-25 | Follow-up em tabela `agendamento` drenada por worker com `SKIP LOCKED`, não em `setTimeout`.                                                                                                                                                                                                           |
| D9  | 2026-08-25 | **Um usuário ativo pertence a exatamente uma corretora**, garantido por índice único. Atender duas corretoras exige duas contas.                                                                                                                                                                       |
| D10 | 2026-08-25 | **Nenhuma policy de tabela de domínio menciona `PLATFORM_ADMIN`.** Ele opera sobre agregados sem PII; ver dado de cliente exige acesso assistido autorizado pelo gestor da corretora.                                                                                                                  |
| D11 | 2026-08-25 | Três categorias de tabela — domínio, catálogo da plataforma, plataforma restrita — declaradas em toda migration.                                                                                                                                                                                       |
| D12 | 2026-08-25 | Tenant do lead resolvido por `canal_captacao`, nunca por campo do corpo. Canal desconhecido vai para quarentena, sem tenant padrão.                                                                                                                                                                    |
| D13 | 2026-08-25 | **Portão de qualidade:** cobertura ≥98% (linhas e branches), duplicação ≤2%, worktree sempre verde. Condição de merge, não meta.                                                                                                                                                                       |
| D14 | 2026-08-25 | Homologação em Docker Compose, isolada, com volume sintético realista.                                                                                                                                                                                                                                 |
| D15 | 2026-08-25 | Quatro modos de dados. Ver produção localmente é por **snapshot anonimizado** (`espelho`); dado real só em `producao-leitura`, réplica somente leitura com sessão auditada de 60 min.                                                                                                                  |
| D16 | 2026-08-25 | Todo conector nasce com stub que cumpre o contrato e permite reprocessar quando a API real chegar.                                                                                                                                                                                                     |
| D17 | 2026-08-25 | **Renovação é mecanismo, não pós-venda genérico:** a emissão agenda D-60, que abre oportunidade nova no mesmo contato. Sem isso o produto vende uma vez só.                                                                                                                                            |
| D18 | 2026-08-25 | Carteira existente entra por importação validada, idempotente e reversível por lote, já agendando renovações.                                                                                                                                                                                          |
| D19 | 2026-08-25 | **A conversa tem um dono.** Atribuição silencia a automação; devolver à régua é ação explícita do consultor.                                                                                                                                                                                           |
| D20 | 2026-08-25 | Janela de 24 h do WhatsApp imposta num único portão de envio; template sem aprovação registrada não dispara.                                                                                                                                                                                           |
| D21 | 2026-08-25 | E-mail é família de conector, não detalhe: é o caminho alternativo quando o telefone não é válido.                                                                                                                                                                                                     |
| D22 | 2026-08-25 | Uma tabela de risco por ramo. `risco_veiculo` é de automóvel; o contrato do conector recebe o risco como tipo discriminado.                                                                                                                                                                            |
| D23 | 2026-08-25 | Mobile primeiro e acessibilidade como critério de aceite — a experiência é o diferencial declarado na visão.                                                                                                                                                                                           |
| D24 | 2026-08-25 | Região de dados brasileira, subprocessadores listados e plano de resposta a incidente escrito antes de precisar dele.                                                                                                                                                                                  |
| D59 | 2026-08-26 | **A fila entrega; o consultor não escolhe.** Não existe função nem botão para assumir uma oportunidade específica: escolher a dedo desmontaria a ordem de §9.4, e o lead frio que envelhece nunca mais seria atendido.                                                                                 |
| D60 | 2026-08-26 | **A tela chama `assumir_proxima_da_fila()`, que não recebe parâmetro.** A identidade vem de `auth.uid()`. `distribuir_proxima(uuid)` segue fechada para `authenticated`: liberá-la deixaria um consultor atribuir trabalho a outra pessoa.                                                             |
| D61 | 2026-08-26 | **Espera confortável até 15 min, limite em 60.** Não há número fechado no blueprint; este é o padrão até a corretora configurar o dela. Quinze minutos é o tempo em que o cliente ainda lembra que pediu cotação; uma hora parado é lead esfriando.                                                    |
| D62 | 2026-08-26 | **Consulta de leitura é adaptador**, fora da cobertura de unidade e verificada por integração e E2E. A decisão do que aparece vive em `nucleo/fila/cartao.ts` e a interpretação das linhas em `nucleo/fila/leitura.ts`.                                                                                |
| D53 | 2026-08-26 | **O contexto de um disparo sai numa consulta só** (`contexto_do_disparo`). As sete condições do portão moram em cinco tabelas; buscá-las em cinco viagens deixaria o worker decidir sobre um retrato inconsistente — o cliente responde no meio do caminho e a régua dispara mesmo assim.              |
| D54 | 2026-08-26 | **`DESISTIU` é um status do outbox.** A reserva pega `PENDENTE` e `FALHOU`, então `FALHOU` significa "vai tentar de novo". Empurrar `proxima_tentativa_em` para daqui a cem anos funcionaria e mentiria para quem lesse a tabela.                                                                      |
| D55 | 2026-08-26 | **`agendamento.motivo` existe.** `CANCELADO` pode ser "o consultor assumiu a conversa" ou "o cliente pediu para não receber mensagens", e quem investiga um follow-up que não saiu precisa saber qual dos dois foi.                                                                                    |
| D56 | 2026-08-26 | **A mensagem de texto livre é composta da etapa e da pendência real**, com fecho que muda a cada tentativa. §11.2 proíbe texto genérico, e "Oi, tudo bem?" três vezes num dia é o que faz o cliente bloquear o número da corretora.                                                                    |
| D57 | 2026-08-26 | **`service_role` recebe GRANT explícito de DML.** Com `auto_expose_new_tables` desligado — o padrão novo da nuvem — tabela criada depois não fica alcançável pelos papéis da Data API, e `service_role` é um deles. Variante da armadilha do `revoke from public`, com sintoma idêntico.               |
| D58 | 2026-08-26 | **A stack local roda em 5532x, não no 5432x padrão.** No Windows o Hyper-V reserva faixas dinâmicas de porta, e uma delas — 54277 a 54376 — engole as sete portas do Supabase de uma vez. Sai `netsh` em terminal elevado ou reinício; mudar a porta custa uma linha.                                  |
| D50 | 2026-08-25 | O worker fala com **portas**, nunca com o banco nem com conector concreto. É o que permite exercitar o laço inteiro — inclusive desfechos que levam dias — sem subir infraestrutura.                                                                                                                   |
| D51 | 2026-08-25 | **Um item que estoura não derruba o lote.** A falha é registrada e o próximo segue; um fornecedor com problema não pode parar a operação inteira.                                                                                                                                                      |
| D52 | 2026-08-25 | Bloqueio de envio tem três destinos distintos: **cancelar** (a régua perdeu o sentido), **reagendar** (é cedo demais) e **falhar** (configuração errada, que insistir não resolve).                                                                                                                    |
| D45 | 2026-08-25 | **A espera na fila não tem teto.** É isso que faz o lead antigo alcançar o quente; um limite superior traria de volta o abandono que a regra existe para evitar.                                                                                                                                       |
| D46 | 2026-08-25 | Capacidade zero do consultor significa **sem limite**, não fila parada — é o padrão de quem ainda não configurou.                                                                                                                                                                                      |
| D47 | 2026-08-25 | Existe **um portão único de envio** com janela de 24 h, template aprovado, horário, consentimento e dono da conversa. Espalhar essas regras garantiria que um ponto de disparo esquecesse uma delas.                                                                                                   |
| D48 | 2026-08-25 | O stub de WhatsApp **não finge entrega**: devolve `AGUARDANDO_CONECTOR`. Fingir faria a régua avançar sobre mensagens que nunca saíram.                                                                                                                                                                |
| D49 | 2026-08-25 | O disjuntor só conta **falha de caminho**. Falha de conteúdo é culpa do payload, e contá-la puniria o fornecedor por erro nosso.                                                                                                                                                                       |
| D41 | 2026-08-25 | **Formato e dígito verificador são lógica nossa**, não chamada externa. O conector enriquece (nome, endereço, modelo); conferir se o número é bem formado acontece antes, de graça.                                                                                                                    |
| D42 | 2026-08-25 | Falha de conector é **valor, não exceção**: `Resultado<T>` com motivo, e `valeTentarDeNovo` separa falha de caminho (reexecuta) de falha de conteúdo (não adianta).                                                                                                                                    |
| D43 | 2026-08-25 | Pedir conector não registrado **falha na hora**, sem recuar para o stub. Recuo silencioso faria a corretora operar sintética achando que é real.                                                                                                                                                       |
| D44 | 2026-08-25 | A decisão `CONSULTAR` da cadeia carrega o valor já normalizado — assim o executor não reconstrói o dado nem convive com um caso impossível.                                                                                                                                                            |
| D37 | 2026-08-25 | **Design system Vidro Polar**, em [`design-system.md`](design-system.md): tokens em três camadas, nenhum hexadecimal fora de `tokens.css`.                                                                                                                                                             |
| D38 | 2026-08-25 | Estado se lê por **marcador geométrico + texto**, nunca por cápsula colorida arredondada — ela vira enfeite, compete com a ação primária e é o padrão mais batido de interface gerada por IA.                                                                                                          |
| D39 | 2026-08-25 | Tema tem **três estados** (sistema/claro/escuro) em ciclo, resolvido no servidor por cookie. Dois estados deixariam `sistema` inalcançável, e o rótulo passaria a prometer um destino que a ação não segue.                                                                                            |
| D40 | 2026-08-25 | A translucidez do vidro **só existe no escuro**; sobre branco ela vira cinza sujo, e no claro o painel é sólido com borda.                                                                                                                                                                             |
| D32 | 2026-08-25 | **A etapa só muda por `mover_oportunidade()`.** Um gatilho recusa qualquer `update` direto, com marca local à transação. Sem isso a máquina de estados seria convenção, não garantia.                                                                                                                  |
| D33 | 2026-08-25 | Transições declaradas em tabela (`transicao_permitida`), não em código: assim são consultáveis e testáveis sem abrir uma função.                                                                                                                                                                       |
| D34 | 2026-08-25 | Tabelas filhas herdam a visibilidade da oportunidade por `exists`, em vez de repetir a regra do consultor em cada policy. A regra vive num lugar só.                                                                                                                                                   |
| D35 | 2026-08-25 | Conflito de identidade entre dois contatos **falha explicitamente** em vez de completar em silêncio: unir cadastros é decisão de negócio, e o chamador encaminha para quarentena.                                                                                                                      |
| D36 | 2026-08-25 | MFA obrigatória por ambiente (`MFA_OBRIGATORIA`), com padrão ligado só em produção. Quem cadastra um fator precisa usá-lo, qualquer que seja o papel.                                                                                                                                                  |
| D30 | 2026-08-25 | **O papel vem de `getClaims()`, nunca de `getUser()`.** O objeto de usuário carrega o `app_metadata` gravado na tabela do Auth, sem os claims do hook — ler dali derrubava todo login. `getClaims()` verifica a assinatura e devolve o que a RLS também enxerga, mantendo aplicação e banco de acordo. |
| D31 | 2026-08-25 | Playwright entra já na fatia 2, antes do previsto: o login foi entregue quebrado por não existir verificação automática do caminho do usuário. O E2E passa a fazer parte do portão.                                                                                                                    |
| D29 | 2026-08-25 | **`usuario_corretora` fundida em `usuario`.** A D9 (um usuário, uma corretora) tornou a tabela de vínculo redundante — ela existia para um N-para-N agora proibido. Uma tabela a menos, um join a menos em toda policy, e a regra passa a ser garantida por `check constraint` em vez de índice.       |
| D26 | 2026-08-25 | **ESLint fica na linha 9.** O `typescript-eslint` que acompanha o Next ainda não suporta a 10 — ela falha com `scopeManager.addGlobals is not a function`. Revisar quando o Next atualizar.                                                                                                            |
| D27 | 2026-08-25 | Marcadores pendentes verificados por script sensível a maiúsculas, não pelo ESLint: a regra `no-warning-comments` é insensível a caixa e marcaria a palavra portuguesa "todo".                                                                                                                         |
| D28 | 2026-08-25 | O fluxograma `Atendimento Leads Total.pdf` fica **fora do Git** — contém nome e CPF reais de um cliente. Permanece na máquina como documento de referência.                                                                                                                                            |
| D25 | 2026-08-25 | Denominador da cobertura definido, com pirâmide: RLS testado contra Postgres real; E2E no portão, fora do cálculo.                                                                                                                                                                                     |

---

## 4. Decisões em aberto

A arquitetura não está mais bloqueada. Cada item abaixo bloqueia uma fatia específica da implementação.

| #   | Questão                                                                               | Contexto                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A2  | **Qual CRM e qual o alcance do espelhamento?**                                        | A direção já está decidida (D5: espelho). Falta definir quais objetos e campos sincronizam, e o que fazer em conflito.                                                                                                                                                  |
| A3  | **Canal de WhatsApp.** Continuar em Digisac, ou ir direto à Cloud API da Meta?        | Digisac já carrega a operação (departamentos, chamados). API própria dá controle sobre a régua.                                                                                                                                                                         |
| A4  | **O gestor também vende?**                                                            | Os três papéis estão fechados (D7). Falta saber se `GESTOR` precisa atender oportunidades — isso muda o escopo de linha dele em `/app`.                                                                                                                                 |
| A5  | **Suhai.** Existe API oficial de cotação/proposta, ou o portal é operado manualmente? | O fluxograma descreve trabalho manual no portal. Define o que é integrável no MVP.                                                                                                                                                                                      |
| A6  | **Corretoras piloto.** Quais e quantas?                                               | Define volume, e se multi-tenant é exercitado de verdade no MVP.                                                                                                                                                                                                        |
| A7  | **Marca.** "Venitus.on" é o nome definitivo do produto?                               | —                                                                                                                                                                                                                                                                       |
| A8  | **Como a plataforma cobra a corretora?**                                              | `plano` existe como tabela, mas **faturamento não aparece em nenhum dos documentos**: nem preço, nem ciclo, nem o que acontece com quem atrasa, nem se os limites do plano são bloqueantes ou apenas informativos. É a única peça de modelo de negócio ainda em branco. |
| A9  | **Quais ramos além de automóvel, e quando?**                                          | O MVP é auto. A estrutura já comporta outros ramos (§7.7), mas a ordem muda a prioridade do catálogo e dos conectores.                                                                                                                                                  |

---

## 5. O que o blueprint passou a exigir

O blueprint deixou de ser um checklist genérico e virou a especificação deste produto. Os pontos abaixo
são os que ele acrescentou, e a razão de cada um:

| Acrescentado                                           | Por quê                                                                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fronteira de segurança do navegador (seção 4)          | O modelo padrão do Supabase publica o banco na internet e aposta tudo no RLS. Com CPF, CNH e apólice em jogo, o navegador passou a não receber credencial nenhuma.   |
| RLS detalhado com claim de tenant no JWT (seção 6)     | Isolamento entre corretoras precisa ser barato de consultar e impossível de esquecer. Daí o hook de access token, o `force row level security` e a checklist de 6.4. |
| Modelo de dados completo (seção 7)                     | Derivado da visão e dos campos que a operação real já coleta.                                                                                                        |
| Máquina de estados da jornada (seção 8)                | A jornada é o núcleo do domínio; etapa não pode ser texto livre que qualquer código escreve.                                                                         |
| Camada de conectores com outbox e disjuntor (seção 10) | O produto é uma camada de integração. Sem isso, banco e sistemas externos divergem na primeira falha de rede.                                                        |
| Motor de follow-up durável (seção 11)                  | Três réguas vindas da operação real, com cancelamento quando o cliente responde.                                                                                     |
| LGPD como requisito de arquitetura (seção 14)          | CPF, CNH, CRLV e conversas de WhatsApp são o dado corrente aqui.                                                                                                     |
| Testes de isolamento e de payload (seção 19)           | São os dois testes que impedem justamente os vazamentos que a stack facilita.                                                                                        |

Ficaram de fora, deliberadamente: Docker como ambiente canônico (o Supabase CLI cobre a paridade) e a
separação em dois repositórios (a fronteira que importa aqui é navegador↔servidor).

## 6. Auditoria do modelo de tenant

Feita em 2026-08-25, cruzando cada exigência dos documentos com o modelo do blueprint. Onde havia lacuna,
o blueprint foi corrigido na mesma sessão.

### Cobertura das exigências

| Exigência (origem)                                    | Situação              | Onde                                                               |
| ----------------------------------------------------- | --------------------- | ------------------------------------------------------------------ |
| Corretora é o tenant; nenhuma vê outra (visão §3)     | ✅                    | `corretora_id` + RLS, blueprint §6                                 |
| Três níveis de ownership (visão §4)                   | ✅                    | §1.3 e §8                                                          |
| Usuários, gestores e consultores (visão §21)          | ✅                    | `usuario_corretora`                                                |
| Logo e identidade visual (visão §21)                  | ⚠️ → ✅ **corrigido** | `corretora.logo_url`, `cor_primaria`                               |
| WhatsApp por corretora (visão §21)                    | ✅                    | `integracao_credencial`                                            |
| **Fontes de leads (visão §8 e §21)**                  | ❌ → ✅ **corrigido** | `canal_captacao` + resolução de tenant, §6.8                       |
| Regras de distribuição (visão §21)                    | ✅                    | `regra_distribuicao`                                               |
| Horários (visão §21)                                  | ⚠️ → ✅ **corrigido** | `horario_atendimento`                                              |
| Mensagens e templates (visão §21)                     | ✅                    | `template_mensagem`                                                |
| Credenciais por corretora (visão §21)                 | ✅                    | `integracao_credencial`, §13.2                                     |
| **Produtos disponíveis por corretora (visão §21)**    | ❌ → ✅ **corrigido** | `produto` (catálogo) + `corretora_produto`                         |
| **Planos (visão §20)**                                | ❌ → ✅ **corrigido** | `plano` com `limites` e `recursos`                                 |
| **Custo por lead / oportunidade / venda (visão §24)** | ❌ → ✅ **corrigido** | `investimento_midia` — sem gasto registrado, CPL não tem numerador |
| Permissões finas (visão §20)                          | ⚠️ adiado             | Roadmap item 7. Papéis cobrem o MVP.                               |
| Integrações plugáveis por seguradora (visão §21)      | ✅                    | §10, contrato + stub                                               |
| Logs, auditoria, saúde (visão §20)                    | ✅                    | §15                                                                |

### Falhas estruturais encontradas e fechadas

| #   | Falha                                                                                        | Consequência se não corrigida                                                                                                                            | Correção                                                                              |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| F1  | O hook de JWT fazia `limit 1` sobre `usuario_corretora`, sem regra de unicidade.             | Usuário vinculado a duas corretoras receberia um tenant arbitrário, variando com o plano de execução — vazamento silencioso e não determinístico.        | D9: um usuário ativo, uma corretora, com índice único.                                |
| F2  | `PLATFORM_ADMIN` não tem `corretora_id` no token; as policies o bloqueariam.                 | O reflexo seria adicionar `or papel_atual() = 'PLATFORM_ADMIN'` em toda policy — o que transforma um token comprometido em acesso a todas as corretoras. | D10: agregados sem PII + acesso assistido autorizado pelo gestor. §6.7.               |
| F3  | A regra "toda tabela tem `corretora_id`, sem exceção" não comportava catálogo nem auditoria. | Catálogo de produtos viraria tabela de tenant e auditoria ficaria sem política definida.                                                                 | D11: três categorias declaradas por migration. §6.6.                                  |
| F4  | Nada dizia **como** um lead é atribuído a uma corretora.                                     | Sem isso, o tenant acabaria vindo do corpo da requisição — qualquer um postaria lead na corretora que quisesse.                                          | D12: `canal_captacao` com chave única global; desconhecido vai para quarentena. §6.8. |

**Conclusão:** o modelo de tenant agora atende às regras de negócio dos documentos. F1, F2 e F4 eram
falhas de isolamento reais — as três teriam passado despercebidas até produção.

### Segunda passada: o que faltava fora do tenant

Revisão pedida antes de iniciar o código. Sete lacunas encontradas, todas corrigidas no blueprint.

| #   | Lacuna                                                                                            | Por que importava                                                                                                                                                                             | Onde ficou   |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| G1  | **Renovação de apólice** não existia em lugar nenhum.                                             | Apólice tem vigência. Sem o ciclo de renovação o produto vende uma vez e perde a receita recorrente que sustenta uma corretora. A visão pede "pós-venda", "carteira" e "novas oportunidades". | §8.5         |
| G2  | **Carteira existente** estava na lista de fontes de lead da visão, sem nenhum caminho de entrada. | É a migração que coloca uma corretora no ar. Sem ela, o cliente novo começa com a base vazia.                                                                                                 | §8.6         |
| G3  | **E-mail** não era família de conector.                                                           | O fluxo real cai para e-mail quando o telefone não é válido. Sem o canal, esse lead morre.                                                                                                    | §10.1        |
| G4  | **Janela de 24 h do WhatsApp** não estava escrita.                                                | Fora dela o provedor recusa texto livre. A régua quebraria em produção, não em teste.                                                                                                         | §11.4        |
| G5  | **Arbitragem bot × consultor** indefinida.                                                        | Automação disparando cobrança enquanto o consultor conversa com o cliente. O defeito mais constrangedor possível.                                                                             | §11.5        |
| G6  | **Experiência** não tinha requisito, sendo o diferencial declarado da visão.                      | Consultor atende do celular com rede ruim. Sem requisito, sai um CRM de desktop — exatamente o que a visão recusa.                                                                            | §5.4         |
| G7  | **Residência de dados e resposta a incidente** ausentes.                                          | PII de titulares brasileiros. Durante um vazamento não há tempo de inventar o plano, e sem auditoria a resposta vira "não sabemos".                                                           | §14.1, §14.2 |

Menores, também corrigidos: `oportunidade.produto_id` como FK ao catálogo; uma tabela de risco por ramo em
vez de tabela genérica (§7.7); roteiro de entrada de corretora com teste de fumaça obrigatório (§19.1);
denominador da cobertura e pirâmide de testes (§20.6).

---

## 7. Ferramentas

Node v24.12 · npm v11.12 · Docker 29.6 + Compose v5.3 · Git 2.53. `gh` **não instalado**.
Supabase CLI entra como dependência de desenvolvimento.

- `pdftotext` disponível via Git Bash (`/mingw64/bin`). `pdftoppm` **não** está instalado — não é possível
  renderizar página de PDF como imagem.
- Nenhum servidor MCP conectado até agora.

---

## 8. Fatias entregues

| Fatia                             | Estado | O que ficou de pé                                                                                                                                                                                                                                               |
| --------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Repositório e portão          | ✅     | Next 16 + React 19 + TS strict; portão único verde (cobertura 100%, 0 clones); ganchos de commit e push; CI no GitHub Actions; Supabase CLI subindo Postgres 17, Auth e Storage em containers; redator de PII como primeiro módulo.                             |
| 1 — Tenant e RLS                  | ✅     | Migration de tenant com 5 tabelas categorizadas; hook de access token injetando `corretora_id` e `papel`; RLS habilitado e forçado; recorte de coluna impedindo autopromoção; seed com 2 corretoras e 5 logins; 39 testes de integração contra o Postgres real. |
| 2 — Login                         | ✅     | Login server-side com cookie `HttpOnly`; três áreas isoladas com guard no layout; faixa de modo de dados; 14 testes de ponta a ponta em navegador; verificação de que nenhuma chave vai ao bundle.                                                              |
| 3 — Domínio e máquina de estados  | ✅     | 26 tabelas novas com RLS e categoria; transições declaradas em tabela; gatilho que recusa `update` direto em `etapa`; deduplicação de contato; segundo fator com cadastro e verificação. 198 testes de integração, 20 E2E.                                      |
| 4 — Conectores stub e lead        | ✅     | Contrato único de conector com falha como valor; stubs de validadores, WhatsApp, CRM e seguradora, validados por teste de contrato; cadeia de validação de §8.3; webhook assinado com quarentena para canal desconhecido.                                       |
| 5 — Fila, distribuição, follow-up | ✅     | Prioridade com pesos por corretora; distribuição com `SKIP LOCKED` e capacidade; três réguas; portão único de envio; disjuntor e reexecução; worker drenando `agendamento` e `integracao_outbox` contra o banco; tique por cron da Vercel a cada minuto.        |
| 6 a 8                             | —      |                                                                                                                                                                                                                                                                 |

O portão foi verificado nos dois sentidos, duas vezes:

- **Fatia 0:** um módulo sem teste derruba a cobertura e retorna código 1; removido, volta a 0.
- **Fatia 1:** uma tabela criada sem RLS, sem policy e sem categoria fez o teste de catálogo gerar três
  asserções novas e reprovar. O teste se monta a partir do `pg_class`, então tabela nova não passa
  despercebida.

Dois defeitos reais apareceram por escrever o teste junto com o código:

1. A regra de telefone do redator consumia o meio de um CPF — a fronteira de palavra trata a transição
   dígito/pontuação como fronteira.
2. Dois testes de escalonamento de privilégio **passavam pelo motivo errado**: o PostgREST recusa `PATCH`
   sem filtro com o código `21000`, e eles nunca chegaram a exercitar o recorte de colunas. Reescritos com
   filtro, agora afirmam o código `42501` — o privilégio negando de fato.

---

## 9. Log de sessões

| Data       | O que aconteceu                                                                                                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-25 | Leitura completa dos 4 documentos. Criados `AGENTS.md` e `MEMORY.md`. Levantadas as decisões A1–A7.                                                                                                                                                                               |
| 2026-08-25 | Blueprint reescrito para o produto: Supabase, fronteira do navegador, RLS, modelo de dados, jornada, conectores e follow-up. Fechadas D3–D8; A1 resolvida. Removidas todas as referências a produtos de terceiros.                                                                |
| 2026-08-26 | **Fatia 6.1 entregue.** A fila do consultor no navegador: `Estado`, `MedidorDeIntencao` e `CartaoOportunidade`; DTO de §9.5; leitura sob RLS; puxar o próximo; início com números reais. 632 testes de unidade a 100%, 257 de integração, 41 E2E. Fechadas D59–D62.               |
| 2026-08-26 | **Fatia 5 fechada.** Adaptadores do worker ao Supabase, `contexto_do_disparo`, mensagem contextual e teste de integração percorrendo a régua inteira. Portão verde por código de saída: 565 testes de unidade a 100%, 245 de integração, 33 E2E, 0 clones. Fechadas D53–D58.      |
| 2026-08-25 | **Fatia 5, segunda metade.** Conector de CRM com stub honesto, decisões do worker e laço de drenagem com isolamento de falha. 469 testes de unidade, 100% de cobertura. Fechadas D50–D52. Falta só a camada de adaptadores ao banco — ver seção 10.                               |
| 2026-08-25 | **Fatia 5, primeira metade.** Prioridade da fila, distribuição com `SKIP LOCKED` e capacidade, três réguas com cadências reais, portão único de envio, disjuntor e reexecução, conector de WhatsApp com stub honesto. Fechadas D45–D49.                                           |
| 2026-08-25 | **Fatia 4 entregue.** Validação de formato e dígito verificador, contrato de conector com stub validado por teste de contrato, cadeia de validação de §8.3, entrada de lead por canal com quarentena e webhook com assinatura. Fechadas D41–D44.                                  |
| 2026-08-25 | **Design system Vidro Polar implementado.** Tokens em três camadas, tema claro e escuro em ciclo de três estados resolvido no servidor, seis componentes base com teste, densidade por área. Criado `design-system.md`. Fechadas D37–D40.                                         |
| 2026-08-25 | **Fatia 3 entregue, mais o MFA que faltava da fatia 2.** 31 tabelas no total, máquina de estados com caminho único, deduplicação de contato e segundo fator completo. Dois defeitos reais achados pelos testes. Fechadas D32–D36.                                                 |
| 2026-08-25 | **Fatia 2 entregue.** Login corrigido (`getClaims` no lugar de `getUser`), Playwright no portão, 106 testes de unidade + 39 de integração + 14 E2E. Regra de entrega registrada no `AGENTS.md`. Fechadas D30–D31.                                                                 |
| 2026-08-25 | **Fatia 1 entregue.** Tenant, RLS, hook de claims, seed com 5 logins e 39 testes de integração. CI passou a subir o Supabase para rodar isolamento. Fechada D29.                                                                                                                  |
| 2026-08-25 | **Fatia 0 entregue e publicada** em `github.com/skyomen/venitus.on`. Portão verde, CI configurado, stack local em Docker. Fechadas D26–D28.                                                                                                                                       |
| 2026-08-25 | Criado `PLANO-ESQUELETO.md`: nove fatias até o fluxo rodando com stubs. Repositório e credenciais de acesso definidos.                                                                                                                                                            |
| 2026-08-25 | Segunda revisão antes do código: 7 lacunas fora do tenant (G1–G7), com destaque para renovação de apólice e arbitragem bot×consultor. Fechadas D17–D25.                                                                                                                           |
| 2026-08-25 | Auditoria do modelo de tenant (seção 6): 4 falhas estruturais encontradas e fechadas, 5 lacunas de configuração por corretora preenchidas. Adicionados ao blueprint: qualidade (§20), Docker de homologação (§17), modos de dados (§18) e conector stub (§10.5). Fechadas D9–D16. |

---

## 10. Retomada — leia isto antes de continuar

Reescrito em 2026-08-26, ao fechar a fatia 5.

### Antes de qualquer coisa

1. Ler `AGENTS.md` e este arquivo por inteiro. As regras de spec do `AGENTS.md` não são sugestão:
   portão verde conferido por código de saída, cobertura ≥98%, duplicação ≤2%, e nada de anunciar
   conclusão sem exercitar o caminho que o usuário percorre.
2. Ler `design-system.md` antes de mexer em qualquer tela. A fatia 6 é toda tela.
3. Subir o ambiente:

```bash
npm install
npm run db:up      # exige Docker Desktop rodando
npm run db:reset
npm run portao     # tem de sair com código 0
```

**O Docker Desktop cai entre sessões nesta máquina.** Se `npm run db:up` falhar, abrir o Docker
Desktop e esperar o daemon responder antes de tentar de novo. Sem ele, `test:db` e `test:e2e` não
rodam — e sem eles não há portão verde, logo não se commita.

**Conferir o código de saída do portão de verdade.** `npm run portao | tail` devolve o código do
`tail`, não o do portão. Redirecionar para arquivo e ler `$?` depois.

### O que vem agora: 6.2, o atendimento

A fatia 6 está sendo entregue em partes. **6.1 está fechada**: o início com números reais, a fila
com o cartão de §9.5, e puxar o próximo cliente — tudo exercitado por E2E em perfil de celular.

Falta:

- **6.2** — a tela de atendimento com o contexto da conversa, cotação, proposta e pendências. É
  onde `plano_de_interesse` finalmente ganha origem no esquema: hoje o cartão omite a linha porque
  nada a registra.
- **6.3** — `/gestor`: funil, SLA, produtividade.
- **6.4** — `/admin`: corretoras, usuários, saúde das integrações.

O plano está em `PLANO-ESQUELETO.md`; o desenho, em `design-system.md`.

- `/app` — resta o atendimento com o contexto de §9.5, cotação, proposta, pendências e carteira.
- `/gestor` — funil, SLA, produtividade.
- `/admin` — corretoras, usuários, saúde das integrações.
- Mobile primeiro, 1 a 2 cliques, acessibilidade (§5.4). Todo Client Component recebe DTO.
- `CartaoOportunidade`, `Estado` e `MedidorDeIntencao` já existem, em `componentes/base` e
  `componentes/dominio`. Marcador geométrico e medidor de três traços, **nunca** cápsula colorida.

**Aceite:** a jornada completa é percorrível pela interface, em um telefone.

Como a cobertura se sustenta em código de tela: páginas e layouts ficam finos, só composição, e
`src/app/**` já está fora do denominador (`vitest.config.mts`). Toda decisão vive em módulo puro que
recebe dependência por parâmetro. Retrofitar cobertura de UI depois custa muito mais.

### Armadilhas já conhecidas

- **Não mude `etapa` por `update`.** O gatilho recusa; use `mover_oportunidade()`. Isso vale
  inclusive para limpeza de teste.
- **`revoke ... from public` corta o `service_role`**, que herda de `public`. Toda função nova que o
  worker chame precisa de `grant execute ... to service_role` explícito.
- **`service_role` também não recebe DML de tabela nova.** `auto_expose_new_tables` está desligado no
  `config.toml`, que é o padrão novo da nuvem. Tabela que o worker escreve precisa de
  `grant select, update ... to service_role`. O sintoma é `permission denied for table` só no
  caminho da Data API — a conexão direta do teste continua funcionando e esconde o problema.
- **O PostgREST expande composto nulo** num objeto de campos nulos. Testar `data === null` dá sempre
  falso; conferir um campo, como `data?.id`.
- **Identificador sintético em teste precisa ser único por execução**, senão o teste encontra o dado
  da rodada anterior. Ver a semente em `testes/jornada/duplicidade.test.ts`.
- **O ESLint limita a 4 parâmetros e 50 linhas por função.** Acima disso, objeto nomeado e quebra em
  partes nomeadas.
- **`server-only` lança dentro do Vitest.** `vitest.db.config.mts` resolve o pacote para o `empty.js`
  dele por alias. Declarar a condição `react-server` no `resolve` global parece mais elegante e
  quebra o `pg`, que troca de entrada conforme ela.
- **A reserva do worker é global**, uma fila só para todos os tenants. Teste que drena precisa
  neutralizar o que os outros arquivos deixaram pendente antes de afirmar qualquer coisa — ver
  `limparFilaAlheia` em `testes/jornada/worker.test.ts`.
- **As portas locais são 5532x** (API 55321, banco 55322, Studio 55323, e-mail 55324). Ver D58.

### Quando existir produção

As migrations sobem por `supabase db push` contra o projeto remoto, com `supabase link` feito uma
vez. Nada disso é necessário enquanto o desenvolvimento for local: `npm run db:reset` aplica tudo do
zero em segundos e é assim que o portão roda.

---
