# AGENTS.md — Venitus.on

**No início de toda sessão, leia este arquivo e [`MEMORY.md`](MEMORY.md).**
Este arquivo é a regra durável. `MEMORY.md` é o estado mutável (decisões, pendências, log).

---

## O produto

Plataforma comercial vertical para corretores de seguros, **multi-corretora**. Não é um CRM vazio: é uma
operação de vendas pronta para uso — captação → qualificação → cotação → distribuição → negociação →
proposta → vistoria → emissão → pós-venda.

> A complexidade fica na plataforma. A simplicidade fica para o corretor.

---

## Fontes de verdade

Os PDFs não são lidos direto. Extraia primeiro:
`pdftotext -layout -enc UTF-8 "<arquivo>.pdf" saida.txt`

| Documento                                                 | Leia antes de                                                                                                                                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visao-projeto-venitus.on.md`                             | qualquer decisão de escopo, jornada, MVP ou métrica. É a visão canônica.                                                                                                          |
| `Atendimento Leads Total.pdf`                             | implementar qualquer etapa da jornada, follow-up, validação ou integração. É o fluxograma da operação **real de hoje** — a especificação comportamental mais concreta que existe. |
| `arquitetura_funcional_plataforma_corretores_seguros.pdf` | produzir material executivo ou de stakeholder. Mesma visão, versão apresentação.                                                                                                  |
| `Blueprint estructure - SaaS.md`                          | escrever qualquer linha de código. É a autoridade técnica: stack, fronteira de segurança do navegador, RLS, papéis, modelo de dados, conectores e critérios de aceite.            |

O blueprint é específico deste produto e é a autoridade técnica: stack, RLS, papéis, modelo de dados,
conectores e critérios de aceite. Divergir dele exige registrar a decisão em `MEMORY.md`.

---

## Invariantes

Não negociáveis. Violar qualquer um é bug de segurança, não preferência de estilo.

1. **Corretora é o tenant, desde o dia 1.** Toda entidade de domínio carrega `corretora_id` ou vínculo
   inequívoco ao tenant. O tenant vem sempre da sessão autenticada, nunca do corpo da requisição.
2. **Autorização vive no servidor.** A UI apenas esconde; a API e o banco bloqueiam.
3. **Fail closed.** Sem prova suficiente de acesso, negue.
4. **Dado de seguro é dado sensível.** CPF, CNH, CRLV, placa, apólice, endereço. Mantenha fora de logs,
   fora de mensagens de erro e fora de prompt de LLM salvo necessidade explícita. Documentos ficam em
   storage privado com URL assinada e prazo curto.
5. **Segredos só via ambiente.** Credenciais de integração por corretora ficam criptografadas em repouso,
   com chave distinta da chave de sessão.
6. **Migrations versionadas.** Toda mudança de schema é um arquivo versionado.
7. **Escrita em sistema externo é idempotente e registrada.** HubSpot, Digisac, Suhai e validadores recebem
   chave de idempotência, retry com backoff e um registro do evento. Uma reexecução não pode gerar contato,
   oportunidade ou proposta duplicados.
8. **Contato não duplica; oportunidade pode repetir.** Mesmo CPF/telefone + mesma intenção ativa → atualiza a
   oportunidade. Mesmo contato + nova intenção → cria oportunidade nova, preservando o histórico.
9. **Consultor só é atribuído na distribuição.** Antes disso o SLA pertence à automação, não a uma pessoa.
10. **Exemplos usam dados fictícios.** O fluxograma de referência contém nome e CPF reais de um cliente;
    em código, testes, seeds e documentos, gere dados sintéticos.

---

## Regras de spec

Definidas pelo dono do produto. Valem para qualquer alteração de código, por qualquer agente, sem
necessidade de reconfirmação.

### O portão verde

Toda tarefa termina com `npm run portao` verde, ou é revertida. Verde é uma definição fechada:

```
lint 0 erro · typecheck 0 erro · testes 100% passando
cobertura >= 98% em linhas E branches
duplicação <= 2%
build conclui · formatação sem diferença · worktree limpo
```

Não se encerra uma tarefa com teste quebrado, cobertura caída ou tipo com erro — nem "para arrumar no
próximo commit". Mudança que não cabe inteira é dividida em fatias que fecham verdes.

**Nunca entregar abaixo de 98%.** Rodar `npm run portao` e conferir o código de saída **antes** de dizer
que algo está pronto. Se a cobertura caiu, o trabalho não acabou.

**Nunca relatar número intermediário como se fosse a entrega.** Números vermelhos que apareceram no meio
do caminho e já foram resolvidos não entram no relatório de conclusão — eles confundem o que foi entregue
com o que foi passageiro. Se valer a pena contar como o problema foi resolvido, contar depois de afirmar o
estado final, e deixar claro que é histórico.

**Só dizer que algo funciona depois de exercitar o caminho que o usuário vai usar.** Verificar as partes
não é verificar o todo: um login pode ter rota, guard, cookie e claims corretos e ainda assim não deixar
ninguém entrar. Se não houver teste automático desse caminho, escrever um antes de anunciar.

**Baixar o limite para fazer o CI passar é proibido.** Se 98% não for alcançável em algum arquivo, a saída
é redesenhar o código para ser testável, ou registrar a exclusão em `vitest.config.ts` com justificativa
escrita. Nunca `/* c8 ignore */` espalhado no código.

Teste sem asserção significativa, criado só para levantar o número, é rejeitado na revisão. Blueprint,
seção 20.

### Modos de dados

Quatro modos, e o modo ativo sempre aparece na tela. Blueprint, seção 18.

| Modo               | Quando                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `sintetico`        | Padrão de `local` e `homologacao`.                                                                     |
| `espelho`          | Ver "os dados de produção" localmente. Snapshot **anonimizado**. É o caminho normal.                   |
| `producao-leitura` | Só investigação de incidente. Réplica somente leitura, 60 min, MFA, motivo registrado, sem exportação. |
| `producao`         | Só a aplicação implantada. Nunca a máquina de um dev.                                                  |

Antes de pedir `producao-leitura`, a pergunta é se `espelho` resolve. Quase sempre resolve. Dump cru de
produção nunca desce para a máquina de um desenvolvedor.

### Homologação em Docker

`docker compose -f docker-compose.homologacao.yml up -d --build` sobe a stack inteira com volume de dados
realista e sintético, isolada de produção. O PostgREST não é publicado no host nem aqui. Blueprint,
seção 17.

### Conectores que ainda não existem

As APIs chegam por partes. Toda família de conector nasce com `ConectorStub`, que cumpre o mesmo contrato,
grava a intenção em `integracao_outbox` como `AGUARDANDO_CONECTOR` e permite reprocessar quando a API real
entrar. A jornada roda inteira sem nenhuma API pronta. Blueprint, seção 10.5.

### Trabalho em fatias

Entregar por partes, cada parte fechando verde e funcionando ponta a ponta no que se propôs. Sem fatia que
deixa o repositório em estado intermediário.

---

## Linguagem ubíqua

Use estes termos em código, banco, UI e conversa. Um conceito, um nome.

| Termo               | Significado                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **Corretora**       | O tenant. Dona institucional do lead desde a entrada.                                         |
| **Gestor**          | Usuário que administra uma corretora e sua operação.                                          |
| **Consultor**       | Usuário que vende. Recebe oportunidades pela fila.                                            |
| **Contato**         | Identidade única da pessoa dentro da corretora. Não duplica.                                  |
| **Oportunidade**    | Uma intenção comercial de um contato. Pode se repetir ao longo do tempo.                      |
| **Cotação**         | Retorno da seguradora com opções de plano para uma oportunidade.                              |
| **Proposta**        | Cotação escolhida, formalizada e transmitida à seguradora.                                    |
| **Apólice**         | Contrato emitido.                                                                             |
| **Pendência**       | Item rastreável com responsável, prazo e alerta (documento, pagamento, vistoria, rastreador). |
| **Fila**            | Ordenação das oportunidades aguardando atendimento humano.                                    |
| **Distribuição**    | Momento em que a fila entrega a oportunidade a um consultor. Inicia o ownership comercial.    |
| **Contatabilidade** | Contatável / não contatável.                                                                  |
| **Completude**      | Completo / pendente.                                                                          |
| **Intenção**        | Fria / morna / quente.                                                                        |

Contatabilidade, completude e intenção são **dimensões independentes**. Um cliente quente com CEP errado
continua quente.

**Qualificação prioriza; não exclui.** Lead frio contatável permanece elegível e ganha prioridade ao envelhecer.

---

## Como trabalhar aqui

- **Este diretório ainda não é um repositório Git.** Peça antes de inicializar.
- **A stack está definida:** Next.js (App Router) + Supabase + Vercel. As decisões AD-1 a AD-10 estão na
  seção 2 do blueprint.
- **O navegador nunca recebe credencial de banco.** Nenhum cliente Supabase roda no navegador; a sessão
  vive em cookie `HttpOnly`. Blueprint, seção 4.
- **Toda tabela nova cumpre a checklist da seção 6.4 do blueprint** — `corretora_id`, RLS habilitado e
  forçado, `with check`, índice de tenant, revoke de `anon` e teste de isolamento.
- Decisões ainda abertas seguem em `MEMORY.md`. Elas não bloqueiam mais a arquitetura, só fatias
  específicas da implementação.
- **O Next 16 mudou convenções.** Antes de escrever código de framework, consulte
  `node_modules/next/dist/docs/` — o conhecimento prévio sobre versões anteriores desinforma mais do que
  ajuda. Já mordeu aqui: `middleware.ts` virou `proxy.ts`, e `coverage.all` saiu do Vitest 4.
- Ao fechar uma decisão ou descobrir um fato durável sobre o produto, **registre em `MEMORY.md`** na mesma
  sessão. Fato durável vai para `MEMORY.md`; regra durável vai para este arquivo.
