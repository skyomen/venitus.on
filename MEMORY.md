# MEMORY.md — Venitus.on

Estado vivo do projeto. Regras duráveis ficam em [`AGENTS.md`](AGENTS.md).
Atualize na mesma sessão em que a decisão ou descoberta acontecer.

---

## 1. Onde estamos

**Fase:** arquitetura definida, nenhum código escrito ainda.

O blueprint (`Blueprint estructure - SaaS.md`) foi reescrito para este produto: stack Supabase, fronteira
de segurança do navegador, RLS, modelo de dados, máquina de estados, conectores e motor de follow-up.

O modelo de tenant foi auditado contra as regras de negócio (seção 6) e as lacunas encontradas já estão
corrigidas no blueprint. As regras de qualidade, Docker e modos de dados estão registradas como spec em
`AGENTS.md`.

**Próximo marco:** executar [`PLANO-ESQUELETO.md`](PLANO-ESQUELETO.md) — nove fatias, da fatia 0
(repositório e portão) à fatia 8 (renovação e carteira). Depois da fatia 2 o painel já é acessível.

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

| #   | Data       | Decisão                                                                                                                                                                                     |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 2026-08-25 | `AGENTS.md` e `MEMORY.md` são leitura obrigatória no início de cada sessão.                                                                                                                 |
| D2  | 2026-08-25 | Multi-tenant é requisito de fase 1: `corretora_id` em toda tabela de domínio, desde a primeira migration.                                                                                   |
| D3  | 2026-08-25 | Stack canônica: **Next.js (App Router) + Supabase + Vercel**. Fecha a decisão A1.                                                                                                           |
| D4  | 2026-08-25 | **O navegador não recebe credencial de banco.** Sem cliente Supabase no browser, sem `NEXT_PUBLIC_SUPABASE_*`, sessão em cookie `HttpOnly`. RLS permanece obrigatório como segunda muralha. |
| D5  | 2026-08-25 | O estado da jornada é da plataforma; o CRM externo é espelho, sincronizado por outbox.                                                                                                      |
| D6  | 2026-08-25 | Realtime desligado no v1 — ele exigiria token de banco no navegador. Atualização por revalidação no servidor e SSE.                                                                         |
| D7  | 2026-08-25 | Três papéis com rotas isoladas: `PLATFORM_ADMIN` (`/admin`), `GESTOR` (`/gestor`), `CONSULTOR` (`/app`).                                                                                    |
| D8  | 2026-08-25 | Follow-up em tabela `agendamento` drenada por worker com `SKIP LOCKED`, não em `setTimeout`.                                                                                                |
| D9  | 2026-08-25 | **Um usuário ativo pertence a exatamente uma corretora**, garantido por índice único. Atender duas corretoras exige duas contas.                                                            |
| D10 | 2026-08-25 | **Nenhuma policy de tabela de domínio menciona `PLATFORM_ADMIN`.** Ele opera sobre agregados sem PII; ver dado de cliente exige acesso assistido autorizado pelo gestor da corretora.       |
| D11 | 2026-08-25 | Três categorias de tabela — domínio, catálogo da plataforma, plataforma restrita — declaradas em toda migration.                                                                            |
| D12 | 2026-08-25 | Tenant do lead resolvido por `canal_captacao`, nunca por campo do corpo. Canal desconhecido vai para quarentena, sem tenant padrão.                                                         |
| D13 | 2026-08-25 | **Portão de qualidade:** cobertura ≥98% (linhas e branches), duplicação ≤2%, worktree sempre verde. Condição de merge, não meta.                                                            |
| D14 | 2026-08-25 | Homologação em Docker Compose, isolada, com volume sintético realista.                                                                                                                      |
| D15 | 2026-08-25 | Quatro modos de dados. Ver produção localmente é por **snapshot anonimizado** (`espelho`); dado real só em `producao-leitura`, réplica somente leitura com sessão auditada de 60 min.       |
| D16 | 2026-08-25 | Todo conector nasce com stub que cumpre o contrato e permite reprocessar quando a API real chegar.                                                                                          |
| D17 | 2026-08-25 | **Renovação é mecanismo, não pós-venda genérico:** a emissão agenda D-60, que abre oportunidade nova no mesmo contato. Sem isso o produto vende uma vez só.                                 |
| D18 | 2026-08-25 | Carteira existente entra por importação validada, idempotente e reversível por lote, já agendando renovações.                                                                               |
| D19 | 2026-08-25 | **A conversa tem um dono.** Atribuição silencia a automação; devolver à régua é ação explícita do consultor.                                                                                |
| D20 | 2026-08-25 | Janela de 24 h do WhatsApp imposta num único portão de envio; template sem aprovação registrada não dispara.                                                                                |
| D21 | 2026-08-25 | E-mail é família de conector, não detalhe: é o caminho alternativo quando o telefone não é válido.                                                                                          |
| D22 | 2026-08-25 | Uma tabela de risco por ramo. `risco_veiculo` é de automóvel; o contrato do conector recebe o risco como tipo discriminado.                                                                 |
| D23 | 2026-08-25 | Mobile primeiro e acessibilidade como critério de aceite — a experiência é o diferencial declarado na visão.                                                                                |
| D24 | 2026-08-25 | Região de dados brasileira, subprocessadores listados e plano de resposta a incidente escrito antes de precisar dele.                                                                       |
| D25 | 2026-08-25 | Denominador da cobertura definido, com pirâmide: RLS testado contra Postgres real; E2E no portão, fora do cálculo.                                                                          |

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

## 8. Log de sessões

| Data       | O que aconteceu                                                                                                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-25 | Leitura completa dos 4 documentos. Criados `AGENTS.md` e `MEMORY.md`. Levantadas as decisões A1–A7.                                                                                                                                                                               |
| 2026-08-25 | Blueprint reescrito para o produto: Supabase, fronteira do navegador, RLS, modelo de dados, jornada, conectores e follow-up. Fechadas D3–D8; A1 resolvida. Removidas todas as referências a produtos de terceiros.                                                                |
| 2026-08-25 | Criado `PLANO-ESQUELETO.md`: nove fatias até o fluxo rodando com stubs. Repositório e credenciais de acesso definidos.                                                                                                                                                            |
| 2026-08-25 | Segunda revisão antes do código: 7 lacunas fora do tenant (G1–G7), com destaque para renovação de apólice e arbitragem bot×consultor. Fechadas D17–D25.                                                                                                                           |
| 2026-08-25 | Auditoria do modelo de tenant (seção 6): 4 falhas estruturais encontradas e fechadas, 5 lacunas de configuração por corretora preenchidas. Adicionados ao blueprint: qualidade (§20), Docker de homologação (§17), modos de dados (§18) e conector stub (§10.5). Fechadas D9–D16. |
