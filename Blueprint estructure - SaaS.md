# Blueprint de Arquitetura — Venitus.on

**Plataforma comercial multi-corretora para corretores de seguros.**
Stack canônica: **Next.js (App Router) + Supabase + Vercel**.

> Este documento é a **especificação obrigatória** da arquitetura. Ele não descreve um SaaS genérico:
> descreve _este_ produto, derivado de `visao-projeto-venitus.on.md`, do fluxograma operacional
> `Atendimento Leads Total.pdf` e do documento executivo `arquitetura_funcional_...pdf`.
>
> Regras de trabalho diário estão em [`AGENTS.md`](AGENTS.md). Estado e decisões abertas em
> [`MEMORY.md`](MEMORY.md). Divergir deste blueprint exige registrar a decisão em `MEMORY.md`.

---

## 0. Como usar este documento

### 0.1 Para implementar

1. Ler este arquivo inteiro antes de gerar código.
2. Tratar as seções como checklist obrigatório, não como sugestão.
3. Rodar a checklist da seção 25 antes de declarar qualquer entrega pronta.

### 0.2 Para auditar

Produzir a tabela `Item | Status ✅⚠️❌ | Evidência (arquivo:linha) | Risco | Ação`, fechar com nota 0–100
e plano priorizado por risco. Não alterar código durante auditoria.

### 0.3 Os dez princípios não negociáveis

1. **O navegador nunca fala com o banco.** Todo dado passa pelo servidor Next.js.
2. **RLS é o piso, não o teto.** Toda tabela tem RLS; a autorização também é aplicada no servidor.
3. **A corretora é o tenant**, e essa identidade vem sempre do token, nunca da requisição.
4. **Fail closed.** Sem prova suficiente de acesso, negar.
5. **Least privilege** em papel, em rota, em tabela e em coluna.
6. **Dado de seguro é dado sensível.** CPF, CNH, CRLV, placa, apólice e endereço nunca aparecem em log,
   em erro, em URL ou em payload de cliente sem necessidade.
7. **Escrita em sistema externo é idempotente, registrada e reexecutável.**
8. **Migrations versionadas.** Nada de alterar schema pelo painel.
9. **Segredos só via ambiente.** Credenciais por corretora, criptografadas em repouso.
10. **Observabilidade mínima:** trilha de auditoria, log sem PII e painel de saúde das integrações.

---

## 1. O que estamos construindo

### 1.1 A tese

Uma operação de vendas de seguros **pronta para uso**, para corretores com baixa maturidade digital.
Não é um CRM para o corretor configurar.

> A complexidade fica na plataforma. A simplicidade fica para o corretor.

O corretor vê clientes, prioridades e próximas ações. Ele não vê pipeline, workflow, webhook, API ou regra
de distribuição.

### 1.2 A jornada que o sistema precisa executar

```
Captação → Identificação → Contatabilidade → Validação/Enriquecimento → Qualificação →
Intenção → Cotação → Oferta → Priorização → Fila → Distribuição → Consultor →
Negociação → Proposta → Vistoria/Pendências → Emissão → Apólice → Pós-venda
```

Agrupada nas quatro etapas macro que a operação real já usa:
`Conscientização` → `Educação` → `Seleção` → `Onboarding`.

### 1.3 Os três donos do lead

Essa separação existe para não cobrar SLA de uma pessoa antes de haver trabalho humano.

| Dono          | Quem                   | Quando                                                         |
| ------------- | ---------------------- | -------------------------------------------------------------- |
| Institucional | Corretora              | Desde a entrada do lead. Sempre.                               |
| Operacional   | Plataforma / automação | Validação, enriquecimento, qualificação, cotação, recuperação. |
| Comercial     | Consultor              | **Somente** a partir da distribuição na fila humana.           |

O SLA comercial começa na atribuição. Antes disso, o SLA é da automação.

### 1.4 O que a plataforma absorve da operação atual

O fluxograma operacional descreve a corretora rodando hoje sobre CRM, plataforma de WhatsApp, Supabase,
portal da seguradora e sistema de cadastro de venda. A plataforma precisa reproduzir esse comportamento
com estado próprio:

- validação em cadeia — WhatsApp ativo → CPF → CEP → placa — pedindo **apenas o dado faltante**;
- desambiguação quando a consulta de placa retorna mais de um modelo;
- confirmação com o cliente em três blocos: condutor, veículo, perfil de uso;
- captura da **maior preocupação** (roubo/furto, danos acidentais, danos a terceiros) e uso dela na
  argumentação comercial;
- cotação na seguradora e apresentação de planos;
- transferência ao consultor com contexto completo;
- três réguas de follow-up distintas (seção 11);
- fechamento até emissão, com pendências rastreáveis.

---

## 2. Decisões de arquitetura

| #     | Decisão                                                                                 | Razão                                                                                            |
| ----- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| AD-1  | **Next.js App Router na Vercel** como única camada exposta à internet.                  | Server Components permitem manter dado sensível fora do navegador por padrão.                    |
| AD-2  | **Supabase** como Postgres gerenciado + Auth + Storage.                                 | A operação atual já usa Supabase; RLS no banco dá uma segunda muralha real.                      |
| AD-3  | **PostgREST não é exposto ao navegador.** O cliente Supabase roda apenas no servidor.   | Elimina de uma vez a maior superfície de vazamento do modelo padrão Supabase. Ver seção 4.       |
| AD-4  | **Multi-tenant desde o dia 1**, banco único, `corretora_id` em toda tabela de domínio.  | A corretora é o tenant por definição do produto, não por configuração.                           |
| AD-5  | **Fila de jobs durável em Postgres**, drenada por worker com `SKIP LOCKED`.             | A régua de follow-up é requisito de MVP e não sobrevive a `setTimeout` em serverless.            |
| AD-6  | **Camada de conectores plugável** com outbox, idempotência e disjuntor.                 | O produto é, na prática, uma camada de integração. CRM, WhatsApp e seguradora são substituíveis. |
| AD-7  | **O estado da jornada é da plataforma.** O CRM externo é espelho, não fonte de verdade. | Fila, priorização e SLA precisam de leitura local, consistente e barata.                         |
| AD-8  | **Monorepo** com fronteiras internas explícitas.                                        | Time pequeno; a fronteira que importa aqui é navegador↔servidor, não repositório↔repositório.    |
| AD-9  | **Sem Docker como ambiente canônico.** Supabase CLI local + Vercel.                     | A paridade com produção vem do Supabase CLI, que roda o mesmo Postgres e as mesmas migrations.   |
| AD-10 | **Realtime desligado no v1.** Atualização por revalidação no servidor.                  | Realtime exigiria entregar token de banco ao navegador, contrariando AD-3. Ver 4.6.              |

---

## 3. Topologia

```
                            NAVEGADOR
                    HTML + JS mínimo. Sem chave de banco.
                    Cookie de sessão HttpOnly, Secure, SameSite=Lax.
                                  │
                                  │ HTTPS
                                  ▼
        ┌─────────────────────────────────────────────────────┐
        │           NEXT.JS (Vercel) — a única porta           │
        │  Server Components · Server Actions · Route Handlers │
        │  Guard de rota · Autorização · Montagem de DTO       │
        │  Cliente Supabase por requisição, com o JWT do user  │
        └───────────┬──────────────────────────┬───────────────┘
                    │                          │
                    ▼                          ▼
        ┌───────────────────────┐   ┌────────────────────────────┐
        │  SUPABASE             │   │  WORKER DE JOBS            │
        │  Postgres + RLS       │◄──┤  Follow-up · distribuição  │
        │  Auth · Storage       │   │  outbox · reconciliação    │
        └───────────┬───────────┘   └─────────────┬──────────────┘
                    │                             │
                    │                             ▼
                    │              ┌──────────────────────────────┐
                    │              │  CAMADA DE CONECTORES        │
                    └─────────────►│  CRM · WhatsApp · Seguradora │
                                   │  Validadores CPF/CEP/Placa   │
                                   └──────────────────────────────┘
```

Três regras que o desenho impõe:

1. Nenhuma seta sai do navegador para o Supabase.
2. Nenhuma seta sai do navegador para um conector externo.
3. Toda escrita externa passa pelo outbox, nunca direto de um handler de requisição.

---

## 4. A fronteira de segurança do navegador

Esta é a seção mais importante do blueprint. O modelo padrão do Supabase publica o banco na internet e
confia inteiramente no RLS. Para um produto que trafega CPF, CNH e apólice, essa aposta é grande demais.

**Postura adotada: o navegador não recebe credencial de banco de espécie alguma.**
O RLS continua ativo e obrigatório — como segunda muralha, para o caso de um erro de autorização no
servidor.

### 4.1 Vetores de vazamento e o que fazemos com cada um

| #   | Vetor                                                                 | Mitigação obrigatória                                                                                                                                               |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | Sessão em `localStorage` (padrão do cliente de navegador do Supabase) | Autenticação executada **no servidor**. Sessão em cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Nenhum token acessível a JS.                                         |
| V2  | Chave `anon` embutida no bundle                                       | Não existe cliente Supabase no navegador. Nenhuma variável `NEXT_PUBLIC_SUPABASE_*`.                                                                                |
| V3  | Chave `service_role` vazando                                          | Existe apenas no worker e em rotas administrativas server-only. Nunca em middleware, nunca em Client Component, nunca em variável `NEXT_PUBLIC_*`.                  |
| V4  | **Payload de Server Component**                                       | Tudo que um Server Component passa como prop para um Client Component **é serializado no HTML e fica visível**. Passar DTO enxuto, nunca a linha do banco. Ver 4.3. |
| V5  | IDOR por URL                                                          | Chaves primárias `uuid v4`. Toda leitura por id filtra também por tenant e escopo. UUID não é autorização.                                                          |
| V6  | Enumeração de recurso                                                 | Sem ids sequenciais em rota. Resposta idêntica para "não existe" e "não é seu": **404**, nunca 403 com detalhe.                                                     |
| V7  | Over-fetch                                                            | `select` com colunas explícitas. `select('*')` proibido em tabela com PII.                                                                                          |
| V8  | View ignorando RLS                                                    | Toda view criada com `security_invoker = on`. Sem isso a view roda com os direitos do dono e **fura o RLS**.                                                        |
| V9  | Função `SECURITY DEFINER`                                             | Só quando indispensável, sempre com `set search_path = ''` e argumentos validados.                                                                                  |
| V10 | Storage público                                                       | Todos os buckets privados. Acesso apenas por URL assinada de vida curta, gerada no servidor.                                                                        |
| V11 | Log e erro                                                            | Sem stack trace ao cliente. Log com redação de CPF, telefone, token e documento.                                                                                    |
| V12 | Enumeração de usuário no login                                        | Mensagem única — "Credenciais inválidas" — e tempo de resposta constante. Rate limit por IP e por conta.                                                            |
| V13 | Middleware tratado como segurança                                     | O guard de rota é UX. A autorização real está no Server Component/Action e no RLS.                                                                                  |
| V14 | CSRF                                                                  | Server Actions do Next já carregam proteção; mutação via Route Handler exige verificação de origem. Cookie `SameSite=Lax`.                                          |
| V15 | XSS                                                                   | Escape padrão do React. CSP restritiva. `dangerouslySetInnerHTML` proibido sem sanitização explícita.                                                               |

### 4.2 Os clientes Supabase

Exatamente três clientes existem no código, e nenhum deles é de navegador:

| Cliente                  | Onde vive                                      | Chave                                   | Uso                                                                                          |
| ------------------------ | ---------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `criarClienteServidor()` | Server Component, Server Action, Route Handler | `anon` + JWT do usuário vindo do cookie | Todo acesso de usuário. Sujeito a RLS.                                                       |
| `criarClienteAdmin()`    | Worker e rotas administrativas                 | `service_role`                          | Jobs, conciliação, onboarding de corretora. **Ignora RLS** — cada uso filtra o tenant à mão. |
| `criarClienteAnonimo()`  | Fluxos públicos (login, recuperação de senha)  | `anon` sem sessão                       | Apenas endpoints de Auth.                                                                    |

Todo módulo que instancia `criarClienteAdmin` importa `server-only` no topo, para que um import acidental
a partir do cliente quebre o build em vez de vazar em produção.

### 4.3 A regra do payload

O erro mais comum e mais silencioso desta stack:

```tsx
// ERRADO — a linha inteira vai para o HTML, com CPF junto, e o navegador lê.
const { data: oportunidade } = await supabase
  .from('oportunidade')
  .select('*')
  .eq('id', id)
  .single();
return <PainelCliente oportunidade={oportunidade} />;

// CERTO — o servidor escolhe o que o navegador pode ver.
const { data } = await supabase
  .from('oportunidade')
  .select('id, etapa, intencao, tempo_em_fila, veiculo_modelo')
  .eq('id', id)
  .single();
return <PainelCliente dados={paraDTO(data)} />;
```

Todo Client Component recebe um DTO montado explicitamente. Nenhuma linha de banco atravessa a fronteira
inteira. Documento, CPF e telefone completo só chegam quando a tela realmente os exige, e sempre mascarados
por padrão (`***.456.789-**`), com o valor completo atrás de uma ação auditada.

### 4.4 Autenticação

```
POST (Server Action) /entrar { email, senha }
  → signInWithPassword executado no SERVIDOR
  → sessão gravada em cookie HttpOnly + Secure + SameSite=Lax
  → resolve papel e corretora
  → redireciona:
        PLATFORM_ADMIN → /admin/inicio
        GESTOR         → /gestor/inicio
        CONSULTOR      → /app/inicio
```

Requisitos:

- senha de no mínimo 12 caracteres, verificada contra lista de senhas vazadas (recurso nativo do Auth);
- confirmação de e-mail obrigatória;
- **MFA obrigatório** para `PLATFORM_ADMIN` e `GESTOR`;
- access token de vida curta (15 min) com refresh rotativo;
- logout invalida a sessão no servidor e zera o cookie;
- sessão expirada devolve `/entrar?sessao=expirada`.

### 4.5 Cabeçalhos

CSP sem `unsafe-inline` em script, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` e HSTS. Definidos em um único lugar e cobertos por teste.

### 4.6 O custo assumido

Sem cliente no navegador não há Realtime nem Storage direto. As consequências são aceitas:

- **Atualização de tela:** revalidação no servidor e, onde a fila exigir, SSE emitido pelo Next.
- **Upload de documento:** vai para uma Server Action que valida tipo e tamanho e grava com o cliente do
  servidor. Sem upload direto do navegador para o bucket.

Se o Realtime se tornar necessário, ele entra por decisão registrada em `MEMORY.md`, com token de vida
curta e escopo mínimo — sem reabrir o PostgREST ao navegador.

---

## 5. Identidade, papéis e rotas

### 5.1 Papéis

| Papel            | Escopo                                    | Prefixo de rota | Home             |
| ---------------- | ----------------------------------------- | --------------- | ---------------- |
| `PLATFORM_ADMIN` | A plataforma inteira, todas as corretoras | `/admin/*`      | `/admin/inicio`  |
| `GESTOR`         | Uma corretora, inteira                    | `/gestor/*`     | `/gestor/inicio` |
| `CONSULTOR`      | Uma corretora, apenas o que é seu         | `/app/*`        | `/app/inicio`    |
| `SERVICO`        | Identidade da automação, sem login        | —               | —                |

`CONSULTOR` é o corretor que vende: enxerga a própria fila, a própria carteira e os próprios atendimentos.
`GESTOR` enxerga tudo da corretora dele e nada de outra.

### 5.2 Regras de roteamento

1. Sem sessão válida → `/entrar`.
2. Papel fora do prefixo → `/sem-permissao`. Sem redirecionar para uma área que o usuário não pode ver.
3. Recurso de outro tenant → **404**, para não confirmar existência.
4. O guard de rota é conveniência. A autorização real acontece no Server Component/Action e no RLS.

### 5.3 Matriz de autorização

Toda rota de UI tem uma rota de dados equivalente, com o mesmo escopo dos dois lados. Divergência entre a
matriz de UI e a de dados é bug de segurança, não inconsistência de estilo.

| Área         | Papéis           | Escopo de linha                                                                                  |
| ------------ | ---------------- | ------------------------------------------------------------------------------------------------ |
| `/admin/**`  | `PLATFORM_ADMIN` | Todas as corretoras                                                                              |
| `/gestor/**` | `GESTOR`         | `corretora_id` = tenant do token                                                                 |
| `/app/**`    | `CONSULTOR`      | `corretora_id` = tenant **e** (`consultor_id` = usuário **ou** item ainda não atribuído na fila) |

### 5.4 Princípios de experiência

A visão diz que a experiência é o diferencial, não um detalhe de acabamento. Isso vira requisito:

1. **Mobile primeiro, de verdade.** O consultor atende do celular, em trânsito, com rede ruim. A tela do
   atendimento é desenhada para o telefone e adaptada para o desktop, não o contrário.
2. **Um ou dois cliques** para 80% das ações recorrentes. Toda ação que exigir mais que isso é revisada
   no PR.
3. **A home responde a uma pergunta:** "o que eu preciso fazer agora?". Ela abre com a próxima ação, não
   com um relatório.
4. **Rede ruim é o caso normal.** Ação otimista com reconciliação, estado de carregamento explícito e
   nenhuma perda de digitação em queda de conexão.
5. **Sem vocabulário de CRM na interface.** O corretor lê "clientes", "cotações", "pendências". Nunca
   "pipeline", "deal" ou "workflow". A linguagem da tela é a do `AGENTS.md`.
6. **Acessibilidade** como critério de aceite: navegação por teclado, foco visível, contraste mínimo
   AA, área de toque adequada e leitor de tela nos fluxos principais.

Menu do consultor, fixo: Início · Clientes · Atendimentos · Cotações · Propostas · Apólices · Carteira.

---

## 6. Multi-tenancy e RLS

A corretora é o tenant. Isolamento entre corretoras é requisito estrutural: nenhuma configuração, nenhuma
flag e nenhum caminho de código pode desligá-lo.

### 6.1 O modelo

Banco único, `corretora_id uuid not null` em **toda** tabela de domínio. Sem exceção "porque essa tabela é
pequena" ou "porque é só de leitura".

O tenant vem do **claim no JWT**, nunca do corpo, da query string ou de um header. Um hook de access token
injeta `corretora_id` e `papel` no token no momento do login:

```sql
-- Hook de access token: coloca tenant e papel dentro do JWT.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_corretora uuid;
  v_papel text;
begin
  select uc.corretora_id, uc.papel
    into v_corretora, v_papel
  from public.usuario_corretora uc
  where uc.usuario_id = (event->>'user_id')::uuid
    and uc.ativo
  limit 1;

  return jsonb_set(
    event,
    '{claims,app_metadata}',
    coalesce(event->'claims'->'app_metadata', '{}'::jsonb)
      || jsonb_build_object('corretora_id', v_corretora, 'papel', v_papel)
  );
end;
$$;
```

E dois helpers que as policies usam:

```sql
create or replace function public.corretora_atual()
returns uuid language sql stable set search_path = '' as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'corretora_id', ''
  )::uuid
$$;

create or replace function public.papel_atual()
returns text language sql stable set search_path = '' as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'papel', 'NENHUM'
  )
$$;
```

**Um usuário pertence a exatamente uma corretora.** Índice único parcial em `usuario_corretora
(usuario_id) where ativo` garante isso no banco. Sem essa regra o `limit 1` do hook escolheria um tenant
arbitrário — e um usuário de duas corretoras veria dados da errada conforme a ordem do plano de execução.
Atender a mesma pessoa em duas corretoras exige duas contas, com e-mails distintos. Troca de corretora
dentro de uma sessão entra por decisão registrada em `MEMORY.md`, nunca por acidente.

**O claim fica congelado no token.** Mudança de papel ou de vínculo exige revogar as sessões do usuário —
caso contrário ele opera com o papel antigo até o refresh. Por isso o access token vive 15 minutos, e toda
alteração em `usuario_corretora` dispara revogação de sessão na mesma transação.

### 6.2 Padrão de policy

Todas as tabelas seguem o mesmo molde. Três coisas são obrigatórias em cada uma:

```sql
alter table public.oportunidade enable row level security;
alter table public.oportunidade force  row level security;   -- vale inclusive para o dono da tabela

-- Leitura: gestor vê a corretora inteira; consultor vê o que é dele ou o que está livre na fila.
create policy oportunidade_leitura on public.oportunidade
for select to authenticated
using (
  corretora_id = (select public.corretora_atual())
  and (
    (select public.papel_atual()) = 'GESTOR'
    or consultor_id = (select auth.uid())
    or consultor_id is null
  )
);

-- Escrita: o WITH CHECK é o que impede mover uma linha para outro tenant.
create policy oportunidade_alteracao on public.oportunidade
for update to authenticated
using      (corretora_id = (select public.corretora_atual()))
with check (corretora_id = (select public.corretora_atual()));
```

Detalhes que não são estilo:

- **`force row level security`** — sem isso o dono da tabela escapa das policies.
- **`with check` em todo `insert` e `update`** — o `using` filtra o que você vê; só o `with check` impede
  gravar `corretora_id` de outro tenant.
- **`(select auth.uid())` envolto em subquery** — o Postgres avalia uma vez por consulta em vez de uma vez
  por linha. Em tabela grande a diferença é de ordem de grandeza.
- **Índice em `corretora_id`** em toda tabela, e índice composto onde a policy filtra por dois campos
  (`corretora_id, consultor_id`). Policy é predicado: sem índice, ela vira varredura completa.

### 6.3 Fechando as portas padrão

```sql
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
```

O papel `anon` não tem acesso a nada de domínio. Se um dia o PostgREST for exposto por engano, ele não
serve dado.

### 6.4 Checklist de toda tabela nova

Nenhuma migration que crie tabela é aprovada sem estes sete itens:

```
[ ] corretora_id uuid not null references corretora(id)
[ ] enable row level security + force row level security
[ ] policy de select com filtro de tenant
[ ] policy de insert/update/delete com using E with check
[ ] índice em corretora_id
[ ] revoke de anon
[ ] teste de isolamento cobrindo a tabela (seção 21)
```

### 6.5 Views e funções

- Toda view: `create view ... with (security_invoker = on)`. Uma view sem isso executa com os direitos do
  criador e devolve dados de todos os tenants.
- Função `SECURITY DEFINER` só com justificativa escrita, sempre com `set search_path = ''`, e nunca
  recebendo `corretora_id` como argumento — ela deriva o tenant do token, como todo o resto.

### 6.6 As três categorias de tabela

A regra "toda tabela tem `corretora_id`" precisa de uma taxonomia explícita, senão o catálogo de produtos
vira tabela de tenant e a auditoria vira tabela sem dono. São três categorias, e toda tabela nova declara
a sua no comentário da migration.

| Categoria                  | `corretora_id`? | Política de leitura                     | Política de escrita             | Exemplos                                                             |
| -------------------------- | --------------- | --------------------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| **Domínio**                | Obrigatório     | Filtrada pelo tenant do token           | Filtrada, com `with check`      | `contato`, `oportunidade`, `cotacao`, `apolice`                      |
| **Catálogo da plataforma** | Não tem         | Todo usuário autenticado lê             | Só `PLATFORM_ADMIN`             | `produto`, `seguradora`, `plano`, `tipo_pendencia`                   |
| **Plataforma restrita**    | Pode ou não ter | Só `PLATFORM_ADMIN`, ou ninguém via API | Só o worker, via `service_role` | `auditoria`, `integracao_outbox`, `integracao_evento`, `agendamento` |

Catálogo é leitura pública para autenticados, mas **o que cada corretora habilita é tabela de domínio**:
`corretora_produto` diz quais produtos aquela corretora vende. O catálogo é comum; a habilitação é do
tenant.

### 6.7 O acesso do `PLATFORM_ADMIN`

Um administrador da plataforma não tem `corretora_id` no token — `corretora_atual()` devolve `null` e, com
as policies da seção 6.2, ele não lê nada. Isso é proposital, e a solução **não** é adicionar
`or papel_atual() = 'PLATFORM_ADMIN'` em toda policy: uma linha dessas em cada tabela transforma um único
token comprometido em acesso irrestrito a todas as corretoras.

O desenho adotado:

1. O `PLATFORM_ADMIN` opera sobre **agregados e metadados** — corretoras, usuários, planos, saúde de
   integração, contadores. Nunca sobre o dado do cliente final.
2. Essas telas leem de views agregadas de categoria "plataforma restrita", com policy explícita
   `papel_atual() = 'PLATFORM_ADMIN'`, e essas views **não expõem PII**.
3. Suporte que exija ver o dado de um cliente específico passa por **acesso assistido**: o admin abre um
   chamado, um `GESTOR` da corretora autoriza, a plataforma emite um token de escopo restrito com validade
   curta, e cada leitura vai para `auditoria`. Sem autorização do tenant, não há acesso.
4. Rotina de manutenção que precise atravessar tenants roda no worker com `service_role`, fora de qualquer
   caminho alcançável por requisição de usuário, e sempre filtrando o tenant explicitamente no código.

Resultado: nenhuma policy de tabela de domínio menciona `PLATFORM_ADMIN`. O isolamento entre corretoras
não tem porta dos fundos.

### 6.8 Resolução do tenant na entrada

Todo lead chega por um canal, e é o canal que diz de quem ele é. O tenant **nunca** vem de um campo do
corpo da requisição — se viesse, qualquer um postaria leads na corretora que quisesse.

```
Lead chega  →  identifica o canal pelo destino
               (número de WhatsApp, id do formulário, conta de mídia, chave de API)
            →  canal_captacao → corretora_id
            →  canal desconhecido → quarentena, alerta, nunca um tenant padrão
```

`canal_captacao` é tabela de domínio e a chave de identificação é única na plataforma inteira. Canal não
reconhecido vai para quarentena e dispara alarme — jamais é atribuído a uma corretora por adivinhação.

---

## 7. Modelo de dados

Derivado do modelo conceitual da visão e dos campos que a operação real já coleta.

### 7.1 Tenant e identidade

| Tabela              | Papel                                          | Campos-chave                                                                                                      |
| ------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `corretora`         | O tenant                                       | `id`, `nome`, `documento`, `status`, `plano_id`, `logo_url`, `cor_primaria`, `fuso_horario`, `configuracao jsonb` |
| `usuario`           | Perfil ligado a `auth.users`                   | `id` (= `auth.users.id`), `nome`, `telefone`, `status`                                                            |
| `usuario_corretora` | Vínculo e papel. Único por usuário ativo (6.1) | `usuario_id`, `corretora_id`, `papel`, `capacidade_atendimento`, `ativo`                                          |

### 7.2 Núcleo comercial

| Tabela                | Papel                                                            | Campos-chave                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `contato`             | Identidade única da pessoa **dentro da corretora**. Não duplica. | `corretora_id`, `cpf`, `telefone_e164`, `nome`, `email`, `cep`, `estado_civil`, `data_nascimento`, `sexo`                                                                            |
| `oportunidade`        | Uma intenção comercial. Pode se repetir.                         | `corretora_id`, `contato_id`, `produto_id`, `etapa`, `status`, `origem`, `canal_captacao_id`, `consultor_id`, `atribuido_em`, `prioridade`, `entrou_na_fila_em`, `apolice_origem_id` |
| `qualificacao`        | As três dimensões, independentes                                 | `oportunidade_id`, `contatabilidade`, `completude`, `intencao`, `preocupacao_principal`, `calculada_em`                                                                              |
| `risco_veiculo`       | Dados do bem segurado. **Específico de automóvel** — ver 7.7     | `oportunidade_id`, `placa`, `marca`, `modelo`, `ano_fabricacao`, `ano_modelo`, `chassi`, `tipo_uso`, `garagem_residencia`, `garagem_trabalho`, `garagem_estudo`, `cep_pernoite`      |
| `interacao`           | Cada mensagem trocada                                            | `corretora_id`, `oportunidade_id`, `canal`, `direcao`, `conteudo`, `template`, `enviado_em`, `respondido_em`                                                                         |
| `oportunidade_evento` | Linha do tempo append-only                                       | `oportunidade_id`, `tipo`, `de_etapa`, `para_etapa`, `ator`, `payload jsonb`, `ocorrido_em`                                                                                          |

**Unicidade do contato:** índice único parcial por corretora, sobre CPF quando existir e sobre telefone
normalizado em E.164 quando não existir. A regra de negócio é da seção 8.4.

### 7.3 Cotação e fechamento

| Tabela          | Papel                            | Campos-chave                                                                                                                                                     |
| --------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cotacao`       | Uma execução contra a seguradora | `corretora_id`, `oportunidade_id`, `seguradora`, `status`, `requisicao jsonb`, `resposta jsonb`, `executada_em`                                                  |
| `cotacao_opcao` | Cada plano retornado             | `cotacao_id`, `nome_plano`, `coberturas jsonb`, `premio`, `franquia`, `parcelamento jsonb`                                                                       |
| `proposta`      | Cotação escolhida e formalizada  | `corretora_id`, `oportunidade_id`, `cotacao_opcao_id`, `status`, `forma_pagamento`, `numero_externo`, `espelho_confirmado_em`, `transmitida_em`, `motivo_recusa` |
| `apolice`       | Contrato emitido                 | `corretora_id`, `proposta_id`, `numero`, `vigencia_inicio`, `vigencia_fim`, `valor_liquido`, `emitida_em`                                                        |
| `pendencia`     | Item rastreável com prazo        | `corretora_id`, `oportunidade_id`, `tipo`, `descricao`, `responsavel`, `prazo`, `status`, `resolvida_em`                                                         |
| `documento`     | Referência ao arquivo no Storage | `corretora_id`, `oportunidade_id`, `tipo`, `caminho`, `enviado_por`, `enviado_em`                                                                                |

`pendencia.tipo` cobre o que o fluxo real exige: `DOCUMENTO`, `PAGAMENTO`, `VISTORIA`, `RASTREADOR`,
`ANALISE_SEGURADORA`, `DADO_CADASTRAL`.

### 7.4 Catálogo da plataforma

Comum a todas as corretoras. Sem `corretora_id`, leitura para autenticados, escrita só do
`PLATFORM_ADMIN` (categoria da seção 6.6).

| Tabela       | Papel                           | Campos-chave                                                 |
| ------------ | ------------------------------- | ------------------------------------------------------------ |
| `seguradora` | Seguradoras suportadas          | `codigo`, `nome`, `conector`, `ativa`                        |
| `produto`    | Produtos vendáveis              | `codigo`, `nome`, `ramo`, `seguradora_id`, `ativo`           |
| `plano`      | Planos comerciais da plataforma | `codigo`, `nome`, `limites jsonb`, `recursos jsonb`, `preco` |

### 7.5 Configuração por corretora

Isto é o "CONFIGURAÇÃO POR CORRETORA" da visão, materializado. Tudo aqui é tabela de domínio.

| Tabela                  | Papel                                                      | Campos-chave                                                                    |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `corretora_produto`     | Quais produtos do catálogo esta corretora vende            | `corretora_id`, `produto_id`, `ativo`, `parametros jsonb`                       |
| `canal_captacao`        | Como o lead é atribuído ao tenant (6.8)                    | `corretora_id`, `tipo`, `chave_identificacao` (única global), `origem`, `ativo` |
| `horario_atendimento`   | Janela de operação e de disparo de mensagem                | `corretora_id`, `dia_semana`, `inicio`, `fim`, `fuso`                           |
| `regra_distribuicao`    | Pesos de prioridade, capacidade e modo de distribuição     | `corretora_id`, `pesos jsonb`, `modo`, `ativo`                                  |
| `template_mensagem`     | Templates de WhatsApp, por etapa e por régua               | `corretora_id`, `codigo`, `canal`, `corpo`, `aprovado_em`                       |
| `integracao_credencial` | Credencial de cada conector, criptografada (13.2)          | `corretora_id`, `conector`, `segredo_cifrado`, `status`, `expira_em`            |
| `investimento_midia`    | Gasto por origem e período — base de CPL e custo por venda | `corretora_id`, `origem`, `periodo`, `valor`                                    |

`investimento_midia` existe porque a visão cobra CPL, custo por lead contatável, custo por oportunidade e
custo por venda. Sem o gasto registrado, essas métricas não têm numerador — e o dashboard do gestor fica
pela metade.

### 7.6 Plataforma restrita

| Tabela              | Papel                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| `agendamento`       | Fila de jobs durável (seção 11.3)                                           |
| `integracao_outbox` | Escritas pendentes para sistemas externos (seção 10.3)                      |
| `integracao_evento` | Log de cada chamada externa, com corpo redigido                             |
| `integracao_saude`  | Estado do disjuntor por corretora e conector                                |
| `lead_quarentena`   | Lead cujo canal não foi reconhecido (6.8). Nunca vira oportunidade sozinho. |
| `auditoria`         | Trilha append-only de ação sensível                                         |

### 7.7 O risco é específico do ramo

`risco_veiculo` só serve para automóvel. Moto, residencial ou vida têm outro conjunto de campos, e forçar
tudo numa tabela genérica de `chave/valor` destrói validação e índice.

Decisão: **uma tabela de risco por ramo**, todas apontando para `oportunidade`, e o contrato do conector de
seguradora recebe o risco como um tipo discriminado pelo ramo. No MVP existe só `risco_veiculo`. Quando o
segundo ramo entrar, a jornada não muda — só nascem a tabela e o mapeamento novos.

### 7.8 Convenções

- Toda PK é `uuid` com `gen_random_uuid()`. Sem `bigserial` em nada alcançável por URL.
- Toda tabela tem `criado_em` e `atualizado_em timestamptz`.
- Dinheiro é `numeric(14,2)`. Nunca `float`.
- Telefone é sempre E.164 (`+5511999998888`) — normalizado na entrada, uma única função.
- CPF armazenado só em dígitos, com validação de dígito verificador antes de gravar.
- Enum é tipo Postgres, não `text` livre. Etapa inválida deve falhar no banco.
- Soft delete apenas onde há razão de auditoria; quando houver, o índice único considera o filtro.

---

## 8. A máquina de estados da jornada

A jornada é o núcleo do domínio. Ela não pode ser uma coluna de texto que qualquer código escreve.

### 8.1 Etapas

```
NOVO
 → EM_VALIDACAO
 → AGUARDANDO_DADO           (falta CPF, CEP, placa ou confirmação)
 → QUALIFICADO
 → EM_COTACAO
 → COTADO
 → NA_FILA
 → ATRIBUIDO                 (aqui começa o SLA do consultor)
 → EM_NEGOCIACAO
 → PROPOSTA_EM_ELABORACAO
 → PROPOSTA_TRANSMITIDA
 → EM_VISTORIA
 → EM_ANALISE_SEGURADORA
 → AGUARDANDO_APOLICE
 → VENDIDA
```

Estados terminais paralelos: `PERDIDA` (com motivo obrigatório) e `ENCERRADA_SEM_CONTATO`.

### 8.2 Transição

Transição é uma função, nunca um `update` solto. Cada uma:

1. valida se a transição é permitida a partir da etapa atual;
2. valida as pré-condições da etapa de destino;
3. grava em `oportunidade_evento` quem fez, quando e por quê;
4. cancela os agendamentos que a etapa anterior tinha criado;
5. cria os agendamentos da nova etapa;
6. enfileira o espelhamento para o CRM no outbox.

Os seis passos acontecem **na mesma transação**. Um trigger no banco recusa qualquer mudança de `etapa`
que não venha da função de transição, para que nenhum caminho alternativo exista.

### 8.3 A validação em cadeia

A etapa `EM_VALIDACAO` executa na ordem que a operação real usa, e para no primeiro problema:

```
WhatsApp ativo?  não → contatabilidade = NAO_CONTATAVEL, tenta e-mail
     ↓ sim
CPF válido?      não → AGUARDANDO_DADO (pede só o CPF)
     ↓ sim
CEP válido?      não → AGUARDANDO_DADO (pede só o CEP)
     ↓ sim
Placa válida?    não → AGUARDANDO_DADO (pede só a placa)
     ↓ sim
Retornou 1 modelo?  não → AGUARDANDO_DADO (pede desambiguação ao cliente)
     ↓ sim
QUALIFICADO
```

Regra que o produto impõe: **pedir apenas o dado que falta**, nunca reabrir o formulário inteiro.

### 8.4 Contato não duplica; oportunidade pode repetir

Na entrada de um lead:

```
Existe contato com este CPF (ou telefone) nesta corretora?
├── não → cria contato + cria oportunidade
└── sim → existe oportunidade ATIVA com a mesma intenção?
          ├── sim → atualiza a oportunidade existente e registra o novo toque
          └── não → cria nova oportunidade no mesmo contato
```

Isto substitui a regra atual da operação, que marca "Duplicidade" e perde a oportunidade quando houve
contato nos últimos 15 dias. O histórico do contato é preservado e uma nova intenção vira negócio novo.

### 8.5 Renovação: o ciclo que fecha o produto

A apólice tem vigência, e vigência termina. A visão coloca "pós-venda", "carteira" e "novas oportunidades"
na jornada — é aqui que elas viram mecanismo.

```
apólice emitida
      ↓
vigência corre
      ↓
D-60 antes do fim  →  cria oportunidade de RENOVAÇÃO no mesmo contato
                      (apolice_origem_id aponta para a apólice que vence)
      ↓
entra na jornada normal: cotação → fila → consultor → proposta → emissão
      ↓
renovada  →  nova apólice, ciclo recomeça
não renovada  →  perdida com motivo, contato permanece na carteira
```

Regras:

- A oportunidade de renovação é **oportunidade nova no mesmo contato** — exatamente a regra de 8.4. O
  histórico do cliente fica visível como uma linha do tempo de apólices.
- O gatilho é um agendamento (seção 11.3) criado no momento da emissão, não uma varredura diária de tabela.
- O prazo (D-60) é configurável por corretora e por produto.
- Renovação já entra qualificada: os dados do risco vêm da apólice anterior, e só o que mudou é perguntado.
- Apólice a vencer sem oportunidade aberta é um alarme, não um silêncio.

Sem isso, o produto vende uma vez e perde a receita recorrente que é justamente o que segura uma corretora.

### 8.6 Entrada por carteira existente

"Carteira existente" está na lista de fontes de lead da visão. Ela é diferente de todas as outras: chega em
lote, na migração de uma corretora que está entrando na plataforma.

- Importação por arquivo, com **validação prévia** e relatório de erros por linha, antes de gravar
  qualquer coisa.
- Deduplicação pela mesma regra de 8.4 — sem criar contato duplicado.
- Apólices vigentes importadas **já agendam sua renovação** (8.5). É o que faz a corretora ver valor na
  primeira semana.
- Importação é idempotente: rodar o mesmo arquivo duas vezes não duplica nada.
- Todo registro importado nasce marcado com a origem `CARTEIRA_IMPORTADA` e o lote, para que uma
  importação errada possa ser revertida inteira.

---

## 9. Qualificação, priorização e fila

### 9.1 Três dimensões independentes

| Dimensão        | Valores                        |
| --------------- | ------------------------------ |
| Contatabilidade | `CONTATAVEL`, `NAO_CONTATAVEL` |
| Completude      | `COMPLETO`, `PENDENTE`         |
| Intenção        | `FRIA`, `MORNA`, `QUENTE`      |

São colunas separadas e nunca colapsam em um único score de "lead bom/ruim". WhatsApp válido + quer
contratar hoje + CEP errado resulta em `CONTATAVEL + PENDENTE + QUENTE` — e continua quente.

### 9.2 Sinais de intenção

Cada sinal observado grava um evento e recalcula a intenção: respondeu à conversa; pediu cotação;
perguntou preço; perguntou parcelamento; escolheu cobertura; escolheu plano; enviou documento; pediu
contato humano; declarou urgência; mencionou cotação concorrente; voltou a conversar mais de uma vez.

A **maior preocupação** (roubo/furto, danos acidentais, danos a terceiros) é capturada explicitamente e
acompanha a oportunidade até o atendimento.

### 9.3 Prioridade

```
prioridade = peso_intencao
           + peso_espera        (cresce com o tempo — evita abandono de lead antigo)
           + peso_contexto      (produto, origem, ticket estimado)
           - carga_do_consultor (capacidade disponível)
```

Os pesos vivem em `regra_distribuicao`, por corretora. O princípio é fixo:
**qualificação determina prioridade, não exclusão.** Lead frio contatável permanece elegível e sobe
conforme envelhece.

### 9.4 Distribuição

O consultor é atribuído **somente** quando a vez chega na fila humana. A reserva usa lock de linha para
que dois workers nunca entreguem a mesma oportunidade:

```sql
with proxima as (
  select id from public.oportunidade
   where corretora_id = p_corretora
     and etapa = 'NA_FILA'
     and consultor_id is null
   order by prioridade desc, entrou_na_fila_em asc
   for update skip locked
   limit 1
)
update public.oportunidade o
   set consultor_id = p_consultor,
       etapa        = 'ATRIBUIDO',
       atribuido_em = now()
  from proxima
 where o.id = proxima.id
returning o.id;
```

A atribuição respeita horário de funcionamento e capacidade configurados pela corretora, e é o marco que
inicia o SLA comercial.

### 9.5 O que o consultor recebe

Nunca "Novo lead". Sempre o contexto que o fluxo real já monta:

```
🔥 LEAD QUENTE
Cliente:               nome
Veículo:               marca, modelo, ano
Intenção:              quer contratar hoje
Maior preocupação:     roubo / furto
Cotação:               realizada
Plano de interesse:    compreensiva
Pendência:             confirmar CEP
Tempo na fila:         4 minutos
[ATENDER CLIENTE]
```

---

## 10. Camada de conectores

O produto é uma camada de integração. Esta seção é o que impede que ela vire um emaranhado.

### 10.1 O contrato

Todo conector implementa a mesma interface e é registrado por corretora. Trocar de CRM, de provedor de
WhatsApp ou de seguradora não altera o núcleo da jornada.

| Família        | Operações                                                                          | Observação                                                                                  |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| CRM            | criar/atualizar contato, criar/atualizar oportunidade, mover etapa, anexar arquivo | Espelho. A verdade é local (AD-7).                                                          |
| WhatsApp       | enviar template, enviar texto, receber webhook, transferir atendimento, encerrar   | Requer consentimento e janela de sessão.                                                    |
| Seguradora     | cotar, elaborar proposta, transmitir, consultar status, emitir                     | Uma no MVP; contrato genérico desde já.                                                     |
| **E-mail**     | enviar transacional, receber retorno, tratar bounce                                | Canal alternativo obrigatório: o fluxo real cai para e-mail quando o telefone não é válido. |
| Validadores    | CPF, CEP, placa, WhatsApp ativo                                                    | Barato, alta frequência, cacheável.                                                         |
| **Retaguarda** | cadastrar venda, conciliar comissão                                                | Sistema de retaguarda da corretora, acionado após a emissão.                                |
| Mídia          | importar custo por origem e período                                                | Alimenta `investimento_midia`, base de CPL e custo por venda.                               |

### 10.2 Regras de todo conector

1. **Chave de idempotência** em toda escrita. Reexecutar não cria contato, oportunidade ou proposta em
   duplicidade.
2. **Timeout explícito** e retry com backoff exponencial e jitter.
3. **Disjuntor por corretora e conector.** Após N falhas consecutivas, abre, para de tentar e sinaliza em
   `integracao_saude`. A jornada segue degradada em vez de travar.
4. **Registro em `integracao_evento`** de requisição e resposta, com PII redigida.
5. **Sem segredo em log.** Nunca o header de autorização.
6. **Rate limit respeitado** por corretora — o limite do fornecedor costuma ser por conta.

### 10.3 Outbox

Nenhum handler de requisição chama sistema externo direto. A mudança de domínio e a intenção de
espelhá-la são gravadas na mesma transação:

```
transação:
  update oportunidade ...
  insert oportunidade_evento ...
  insert integracao_outbox (destino, operacao, payload, chave_idempotencia)
commit
        ↓
worker drena o outbox, chama o conector, marca entregue ou reagenda
```

Isso garante que o banco e os sistemas externos não divergem por causa de uma falha de rede no meio de
uma requisição.

### 10.4 Webhooks de entrada

Toda entrada externa — lead de mídia, mensagem de WhatsApp, retorno da seguradora:

- assinatura verificada antes de qualquer processamento;
- corpo persistido cru antes de ser interpretado;
- processamento assíncrono, resposta imediata `200`;
- deduplicação por id do evento;
- tenant resolvido pelo destino (número, conta, chave), nunca por um campo do corpo.

### 10.5 Conector ausente: o modo stub

As APIs reais chegam por partes. A jornada **não espera por elas**. Toda família de conector nasce com
duas implementações, e a corretora escolhe qual está ativa:

| Implementação  | Comportamento                                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConectorReal` | Chama a API de verdade. Entra quando a credencial e a documentação existirem.                                                                                              |
| `ConectorStub` | Valida o payload contra o contrato, grava a intenção em `integracao_outbox` com status `AGUARDANDO_CONECTOR`, devolve uma resposta sintética coerente e registra o evento. |

O stub não é mock de teste: ele roda em homologação e até em piloto controlado. Consequências que fazem
ele valer a pena:

- a máquina de estados percorre a jornada inteira sem nenhuma API externa pronta;
- o payload que a API real vai receber já está sendo montado e validado desde o primeiro dia;
- quando o conector real entra, os itens parados em `AGUARDANDO_CONECTOR` podem ser **reprocessados** —
  nada do que aconteceu durante o período de stub se perde;
- trocar stub por real é mudar uma linha de configuração da corretora, não refatorar a jornada.

Regras do stub:

1. Ele implementa **o mesmo contrato**, com a mesma validação de entrada. Um payload que o stub aceita e a
   API real recusaria é um bug do contrato, e o teste de contrato existe para pegar isso.
2. Toda resposta sintética é marcada como tal no banco (`origem_resposta = 'STUB'`). Métrica nunca conta
   venda de stub como venda real.
3. Em produção, corretora com conector crítico em stub aparece no painel de saúde como **degradada**.
4. Quando a API real chegar, o trabalho é: escrever `ConectorReal`, passar no teste de contrato, virar a
   configuração, reprocessar a fila. Nessa ordem.

---

## 11. Motor de follow-up

Transversal à jornada: o cliente pode abandonar em qualquer ponto — coleta de dados, cotação, escolha de
plano, proposta, vistoria ou emissão.

### 11.1 As três réguas

Vindas direto da operação real:

| Régua                          | Gatilho                               | Cadência                                                                   |
| ------------------------------ | ------------------------------------- | -------------------------------------------------------------------------- |
| **Inatividade em conversa**    | Cliente parou de responder            | 30 min → 2 h → 3 h, com mensagem contextual à última conversa              |
| **Abertura sem resposta**      | Template inicial enviado, sem retorno | 4 tentativas, 24 h entre elas                                              |
| **Recuperação pós-negociação** | Negociação esfriou                    | `R1` no 1º dia → `R2` no 2º → `R3` no 3º → perdida e atendimento encerrado |

### 11.2 Governança

Cada disparo respeita e registra: cadência, limite de tentativas, consentimento, horário permitido pela
corretora e motivo de encerramento. A mensagem considera a etapa atual, a última conversa e a pendência
real — nunca um texto genérico.

### 11.3 Agendamento durável

```sql
create table public.agendamento (
  id                uuid primary key default gen_random_uuid(),
  corretora_id      uuid not null references public.corretora(id),
  oportunidade_id   uuid not null references public.oportunidade(id),
  tipo              text not null,          -- INATIVIDADE_30M, ABERTURA_2, R1 ...
  executar_em       timestamptz not null,
  status            text not null default 'PENDENTE',
  tentativas        int  not null default 0,
  chave_unicidade   text unique,            -- impede duplicar o mesmo passo
  payload           jsonb,
  criado_em         timestamptz not null default now()
);
create index on public.agendamento (executar_em) where status = 'PENDENTE';
```

Um tick de um minuto (`pg_cron` ou cron da Vercel) drena a fila:

```sql
select * from public.agendamento
 where status = 'PENDENTE' and executar_em <= now()
 order by executar_em
 for update skip locked
 limit 50;
```

**A regra que mais importa:** quando o cliente responde, todos os agendamentos pendentes daquela
oportunidade são cancelados na mesma transação que registra a resposta. Sem isso o cliente recebe cobrança
depois de já ter respondido — o defeito mais visível que uma régua de follow-up pode ter.

### 11.4 A janela de 24 horas do WhatsApp

Restrição do canal, não escolha de produto: fora da janela de 24 horas desde a última mensagem do cliente,
só é possível enviar **template aprovado**. Texto livre é recusado pelo provedor.

O motor de follow-up conhece essa regra e ela é imposta em um lugar só:

- todo disparo consulta a janela antes de escolher entre texto livre e template;
- template sem aprovação registrada (`template_mensagem.aprovado_em`) não é disparável — falha no envio,
  não em produção com o cliente;
- a régua de abertura, com 24 h entre tentativas, é justamente uma sequência de templates;
- as regras da corretora — horário permitido, consentimento, limite de tentativas — são verificadas na
  mesma função. Um único portão de envio, sem caminho alternativo.

### 11.5 Quem está falando com o cliente

O bot e o consultor compartilham a mesma conversa. Sem arbitragem explícita, o cliente recebe uma cobrança
automática enquanto conversa com uma pessoa — o defeito mais constrangedor que este produto pode ter.

A conversa tem um **dono**, sempre:

| Dono                  | Quando                                   | O que a automação faz                                      |
| --------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `AUTOMACAO`           | Até a distribuição                       | Conduz a jornada e dispara as réguas.                      |
| `CONSULTOR`           | Da atribuição em diante                  | Silencia. Nenhum disparo automático sem ação do consultor. |
| `AUTOMACAO_ASSISTIDA` | Consultor devolve à régua explicitamente | Retoma só as réguas que ele autorizou.                     |

Regras que sustentam isso:

1. A transição para `ATRIBUIDO` muda o dono da conversa na mesma transação, e cancela os agendamentos da
   automação.
2. Mensagem recebida do cliente cancela os agendamentos pendentes daquela oportunidade, qualquer que seja
   o dono.
3. Dois consultores nunca são donos da mesma conversa: a atribuição é exclusiva e trocá-la é uma ação
   registrada, com motivo.
4. Mensagens de entrada são processadas **em ordem por oportunidade**, e deduplicadas pelo id do provedor.
   Webhook fora de ordem é o normal, não a exceção.

---

## 12. Documentos e Storage

O fluxo real coleta CNH, CRLV, espelho de proposta e apólice. São os arquivos mais sensíveis do produto.

- **Todos os buckets são privados.** Nenhum bucket público existe no projeto.
- **Caminho carrega o tenant:** `documentos/{corretora_id}/{oportunidade_id}/{tipo}/{uuid}-{arquivo}`.
- **Policy no `storage.objects`** valida a primeira pasta contra o tenant do token:

```sql
create policy documentos_leitura on storage.objects
for select to authenticated
using (
  bucket_id = 'documentos'
  and (storage.foldername(name))[1] = (select public.corretora_atual())::text
);
```

- **Upload** passa por Server Action que valida MIME real (não a extensão), tamanho máximo e tipo
  esperado, e gera nome novo. O nome original nunca vira caminho.
- **Leitura** é sempre por URL assinada gerada no servidor, com validade de 60 a 300 segundos, e cada
  emissão é registrada em `auditoria`.
- **Retenção** definida por tipo de documento, com expurgo automático (seção 14).

---

## 13. Segredos

### 13.1 Da plataforma

Só em variável de ambiente. Nunca no Git, nunca em `NEXT_PUBLIC_*`, nunca em log.

| Variável                         | Onde é lida          | Exposição                             |
| -------------------------------- | -------------------- | ------------------------------------- |
| `SUPABASE_URL`                   | servidor             | interna                               |
| `SUPABASE_ANON_KEY`              | servidor             | interna — **não** vira `NEXT_PUBLIC_` |
| `SUPABASE_SERVICE_ROLE_KEY`      | worker e rotas admin | crítica                               |
| `CHAVE_CRIPTOGRAFIA_CREDENCIAIS` | servidor             | crítica, distinta da chave de sessão  |
| `WEBHOOK_SEGREDO_*`              | servidor             | crítica                               |

`.env.example` completo, com todas as chaves e nenhum valor real. `.env` no `.gitignore`.
Valores diferentes em local, staging e produção. Nada de `changeme` em produção.

### 13.2 Das corretoras

Cada corretora conecta as próprias contas de CRM, WhatsApp e seguradora. Essas credenciais:

- ficam em `integracao_credencial`, **criptografadas em repouso** com chave da plataforma;
- são descriptografadas apenas no worker, em memória, no momento da chamada;
- nunca voltam a uma tela — a UI mostra estado ("conectado", "expirado"), jamais o valor;
- são rotacionáveis sem downtime;
- têm data de expiração acompanhada, com alerta antes de vencer.

Conexão de CRM por corretora via aplicação pública e autorização da conta do cliente, não por uma conta
central compartilhada. Isso é o que permite o SaaS escalar sem gargalo de conta única.

---

## 14. LGPD e dado sensível

O produto trata CPF, CNH, CRLV, endereço, placa, apólice e conversas de WhatsApp. Isso não é detalhe
jurídico — é requisito de arquitetura.

| Exigência                | Implementação                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Classificação            | Cada coluna com PII é marcada em `COMMENT ON COLUMN`, e a lista é a fonte do redator de log.                |
| Minimização              | Coletar só o que a cotação exige. Sem campo "por garantia".                                                 |
| Consentimento            | Opt-in de WhatsApp registrado com data, origem e texto aceito. Opt-out honrado imediatamente e para sempre. |
| Retenção                 | Prazo por tipo de dado. Job periódico de expurgo, com registro do que foi expurgado.                        |
| Acesso                   | Toda leitura de CPF completo, documento ou apólice grava em `auditoria` quem viu e quando.                  |
| Portabilidade e exclusão | Exportação e anonimização do titular por corretora, executáveis sem intervenção manual no banco.            |
| Redação                  | Log, mensagem de erro e telemetria passam por um redator central. Nenhum caminho de log escapa dele.        |
| Prompt de IA             | Nenhum dado pessoal vai a modelo de linguagem sem necessidade explícita e registro da base legal.           |
| Exemplos                 | Seeds, testes e documentação usam dados sintéticos. Nunca dado de cliente real.                             |

### 14.1 Onde o dado mora

PII de titulares brasileiros. A região do banco, do storage e dos logs é definida explicitamente e fica
registrada — e a escolha padrão é a região brasileira. Todo fornecedor que processa dado pessoal é
**subprocessador**: a lista é mantida, com o que cada um acessa e o contrato que cobre o tratamento. Isso
inclui provedor de nuvem, canal de WhatsApp, CRM, seguradora, validadores e qualquer serviço de
observabilidade.

Telemetria e monitoração são tratadas como qualquer outro destino de dado: passam pelo redator, e nenhuma
ferramenta de terceiro recebe PII.

### 14.2 Quando vazar

Plano escrito antes de precisar dele, porque durante o incidente não há tempo de inventá-lo:

1. **Detectar e conter** — revogar credencial, fechar o acesso, preservar evidência sem apagar rastro.
2. **Dimensionar** — quais titulares, quais campos, qual janela. A trilha de `auditoria` é o que torna
   essa resposta possível; sem ela, a resposta é "não sabemos", que é a pior de todas.
3. **Notificar** — a ANPD e os titulares, no prazo legal, quando houver risco relevante.
4. **Corrigir e registrar** — causa raiz, correção, e o teste que impede a repetição.

Ensaio periódico do plano, com credencial de emergência que expira e cujo uso é auditado.

---

## 15. Observabilidade

### 15.1 Auditoria

`auditoria` é append-only — sem `update`, sem `delete`, garantido por policy. Registra login e falha de
login, mudança de papel ou vínculo, atribuição de oportunidade, acesso a PII completa, emissão de URL
assinada, alteração de credencial de integração e toda ação de `PLATFORM_ADMIN`.

### 15.2 Log

Estruturado, com `corretora_id`, `usuario_id`, `oportunidade_id` e id de correlação. Sem PII, sem token,
sem corpo de documento. O redator central é obrigatório e coberto por teste.

### 15.3 Saúde das integrações

A visão exige um painel de saúde. Ele mostra, por corretora e por conector: estado do disjuntor, latência,
taxa de erro, itens parados no outbox e credencial próxima do vencimento. Falha de integração é visível
antes do cliente reclamar.

### 15.4 Alarmes mínimos

Outbox parado acima do limiar; disjuntor aberto; taxa de erro de login acima do normal; job atrasado;
agendamento vencido não executado; violação de RLS detectada em teste de produção sintético.

---

## 16. Estrutura do repositório

Monorepo, com a fronteira que importa marcada em código, não em pasta.

```
app-venitus.on/
├── AGENTS.md                  ← regras para IA e devs
├── MEMORY.md                  ← estado e decisões
├── Blueprint estructure - SaaS.md   ← este arquivo
├── .env.example
├── .env.homologacao.example
├── docker-compose.homologacao.yml
├── vitest.config.ts           ← cobertura 98%, exclusões justificadas
├── .jscpd.json                ← duplicação máx. 2%
├── lefthook.yml               ← pre-commit e pre-push
├── scripts/
│   ├── portao.sh              ← lint + typecheck + teste + jscpd + build
│   ├── espelho-anonimizar.sh  ← roda na origem, nunca no dev (18.1)
│   └── espelho-carregar.sh
├── supabase/
│   ├── migrations/            ← única forma de mudar schema
│   ├── seed.sql               ← dados sintéticos, só local
│   └── config.toml
├── src/
│   ├── app/
│   │   ├── (publico)/entrar/            ← login
│   │   ├── (publico)/sem-permissao/
│   │   ├── (protegido)/admin/           ← PLATFORM_ADMIN
│   │   ├── (protegido)/gestor/          ← GESTOR
│   │   ├── (protegido)/app/             ← CONSULTOR
│   │   └── api/webhooks/                ← entrada externa, assinatura verificada
│   ├── nucleo/
│   │   ├── jornada/           ← máquina de estados e transições
│   │   ├── qualificacao/
│   │   ├── fila/
│   │   └── followup/
│   ├── conectores/
│   │   ├── contrato.ts        ← a interface que todos implementam
│   │   ├── registro.ts        ← escolhe real ou stub por corretora (10.5)
│   │   ├── crm/               ← real/ e stub/
│   │   ├── whatsapp/          ← real/ e stub/
│   │   ├── seguradora/        ← real/ e stub/
│   │   └── validadores/       ← real/ e stub/
│   ├── dados/
│   │   ├── cliente-servidor.ts
│   │   ├── cliente-admin.ts   ← importa 'server-only'
│   │   └── consultas/         ← select com colunas explícitas + DTO
│   ├── seguranca/
│   │   ├── autorizacao.ts     ← a matriz da seção 5.3, em um lugar só
│   │   ├── redator.ts         ← redação de PII
│   │   └── cabecalhos.ts
│   └── worker/                ← drenagem de agendamento e outbox
└── testes/
    ├── isolamento/            ← tenant A nunca lê B (21.1)
    ├── payload/               ← PII não vaza no HTML (21.2)
    ├── contrato/              ← stub e real cumprem o mesmo contrato (21.3)
    ├── autorizacao/
    └── jornada/
```

Regras de Git: `main` protegida, PR com review, branch por feature, `.gitignore` cobrindo `.env`,
`.next`, `node_modules` e qualquer dump. Mensagem de commit explica o porquê.

---

## 17. Ambientes e Docker

### 17.1 Os quatro ambientes

| Ambiente      | Onde roda                             | Banco                 | Dados                           | Para quê                                                                    |
| ------------- | ------------------------------------- | --------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| `local`       | Supabase CLI + `npm run dev`          | Postgres local        | Sintéticos, poucos registros    | Desenvolvimento do dia a dia. Ciclo rápido.                                 |
| `homologacao` | **Docker Compose**, na máquina do dev | Postgres no container | Sintéticos, **volume realista** | Validar a jornada inteira antes do PR. Ambiente que se parece com produção. |
| `preview`     | Vercel + projeto Supabase de staging  | Staging               | Sintéticos                      | Revisão de PR pelo time.                                                    |
| `producao`    | Vercel + projeto Supabase dedicado    | Produção              | Reais                           | Clientes.                                                                   |

`local` e `homologacao` são coisas diferentes de propósito. `local` é rápido e descartável.
`homologacao` sobe a stack completa — banco, auth, storage, worker, e-mail — com dados em volume que
expõem problema de índice, de N+1 e de policy sem índice de tenant, que a base de dez registros esconde.

### 17.2 O Compose de homologação

```yaml
# docker-compose.homologacao.yml — sobe a stack inteira, isolada da produção.
services:
  db: # Postgres com as mesmas extensões do Supabase
  auth: # GoTrue
  rest: # PostgREST — publicado SÓ na rede interna do Compose
  storage: # Storage API, buckets privados
  studio: # inspeção do banco em http://localhost:54323
  mailpit: # captura de e-mail, http://localhost:8025
  app: # Next.js, http://localhost:3000
  worker: # drena agendamento e outbox
```

Regras do Compose:

1. **`rest` nunca é publicado no host.** Só a rede interna do Compose o alcança. Homologação não pode
   ensinar um hábito que produção proíbe (AD-3).
2. Volumes nomeados e distintos dos de `local` — os dois ambientes coexistem sem se sobrescrever.
3. Segredos vêm de `.env.homologacao`, que não é commitado. Chaves diferentes das de produção,
   obrigatoriamente.
4. Healthcheck em `db`, `auth` e `app`. `app` só sobe com `db` saudável.
5. O worker roda como serviço próprio, para que a régua de follow-up seja exercitada de verdade.

```bash
cp .env.homologacao.example .env.homologacao
docker compose -f docker-compose.homologacao.yml up -d --build
npm run dados:homologacao          # aplica migrations + gera volume sintético
# app     http://localhost:3000
# studio  http://localhost:54323
# e-mail  http://localhost:8025
docker compose -f docker-compose.homologacao.yml down -v   # derruba e limpa
```

---

## 18. Modos de dados no ambiente local

Você precisa investigar comportamento com os dados reais, e o produto trata CPF, CNH e apólice. Os dois
fatos convivem por meio de quatro modos explícitos, e **o modo ativo aparece sempre na tela**: uma faixa
no topo da aplicação, com cor própria por modo. Nunca dá para confundir onde se está.

| Modo               | Origem dos dados                     | PII real? | Escrita? | Uso                                                                 |
| ------------------ | ------------------------------------ | --------- | -------- | ------------------------------------------------------------------- |
| `sintetico`        | Gerador local                        | Não       | Sim      | Padrão de `local` e `homologacao`.                                  |
| `espelho`          | Snapshot de produção **anonimizado** | Não       | Sim      | **A opção recomendada** para ver "os dados de produção" localmente. |
| `producao-leitura` | Réplica de produção, somente leitura | **Sim**   | Não      | Investigação de incidente. Acesso excepcional.                      |
| `producao`         | Produção                             | Sim       | Sim      | Só a aplicação implantada. Jamais a máquina de um dev.              |

### 18.1 Modo `espelho` — o caminho normal

É isto que resolve "ver os dados de produção no local" na maior parte dos casos: o snapshot real, com o
volume real, com as distribuições reais — e sem dado pessoal de ninguém.

```
produção → dump lógico → PIPELINE DE ANONIMIZAÇÃO → banco local do Docker
```

O que a anonimização **preserva**, porque é o que faz o bug aparecer:

- volume e cardinalidade de cada tabela;
- distribuição de etapas, origens, intenções e motivos de perda;
- datas, prazos, SLAs e a linha do tempo dos eventos;
- valores monetários e faixas de prêmio;
- integridade referencial completa.

O que a anonimização **substitui**, de forma determinística — o mesmo CPF de origem vira sempre o mesmo
CPF falso, para que os relacionamentos continuem batendo:

| Campo                         | Vira                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Nome                          | Nome sintético estável por hash                                                |
| CPF / CNPJ                    | Documento sintético, válido no dígito verificador, fora de qualquer faixa real |
| Telefone                      | Faixa reservada de teste                                                       |
| E-mail                        | `usuario-{hash}@exemplo.invalido`                                              |
| CEP e endereço                | CEP sintético, mantendo a região                                               |
| Placa e chassi                | Sintéticos, mantendo marca, modelo e ano                                       |
| Número de apólice e proposta  | Reescritos                                                                     |
| Corpo de mensagem de WhatsApp | Substituído por texto sintético do mesmo tamanho                               |
| Arquivos no Storage           | Trocados por um PDF placeholder de tamanho equivalente                         |

Regras que tornam o modo seguro:

1. A anonimização roda **no servidor de origem**, antes do dado sair. Dump cru de produção nunca toca a
   máquina de um desenvolvedor.
2. Uma verificação automática roda depois e falha o processo se encontrar qualquer padrão de CPF,
   telefone, e-mail ou placa real remanescente. Sem essa verificação passando, o snapshot não é publicado.
3. O snapshot expira em 7 dias e o job local o apaga.
4. O arquivo de snapshot nunca entra no Git.

```bash
npm run dados:espelho          # baixa o snapshot anonimizado mais recente e carrega no Docker
```

### 18.2 Modo `producao-leitura` — acesso excepcional

Para o caso em que o dado precisa ser o verdadeiro: um cliente específico, um bug que só acontece com
aquele registro. Isto é acesso a dado pessoal real e é tratado como tal.

| Controle     | Regra                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Origem       | **Réplica somente leitura.** Nunca a instância primária.                                                |
| Credencial   | Temporária, emitida sob demanda, validade máxima de 60 minutos.                                         |
| Autenticação | MFA obrigatória. Nunca `service_role`.                                                                  |
| Autorização  | Papel de suporte designado. Autorização do `GESTOR` da corretora quando o alvo é dado de cliente (6.7). |
| Motivo       | Campo obrigatório na abertura da sessão, gravado em `auditoria`.                                        |
| Escrita      | Bloqueada na conexão. A aplicação sobe com mutações desabilitadas.                                      |
| Exportação   | Sem `dump`, sem CSV, sem cópia para disco.                                                              |
| Visual       | Faixa vermelha permanente e marca d'água com o nome de quem abriu a sessão.                             |
| Registro     | Cada consulta executada vai para a trilha de auditoria.                                                 |
| Encerramento | Automático ao fim da janela, sem prorrogação silenciosa.                                                |

Antes de abrir uma sessão dessas, a pergunta é: **o modo `espelho` resolve?** Na maioria das vezes
resolve, e aí `producao-leitura` não se justifica.

---

## 19. Dados: migrations, seeds e entrada de uma corretora

- Schema muda **só** por arquivo em `supabase/migrations/`. Alteração pelo painel é proibida: ela some no
  próximo deploy e cria divergência silenciosa entre ambientes.
- Toda migration é reversível, ou traz nota explícita de irreversibilidade.
- Migration que cria tabela declara a categoria (6.6) e cumpre a checklist de 6.4.
- Seeds existem em `local`, `homologacao` e `preview`. Nunca em produção.
- O gerador de volume sintético produz uma operação plausível: várias corretoras, consultores com
  capacidades diferentes, oportunidades em todas as etapas, pendências vencidas, follow-ups agendados e
  integrações em estados variados — inclusive com disjuntor aberto.
- Backup diário de produção, com **restauração testada**. Backup nunca restaurado não é backup.

### 19.1 Colocar uma corretora no ar

Ativar uma corretora é um procedimento, não uma sequência de `insert` improvisada. Ele é roteirizado,
idempotente e auditado do começo ao fim:

```
1. criar tenant             corretora, plano, fuso, identidade visual
2. criar o gestor           convite por e-mail, MFA obrigatória no primeiro acesso
3. habilitar produtos       corretora_produto a partir do catálogo
4. conectar integrações     credenciais da corretora; o que faltar entra como stub (10.5)
5. registrar canais         canal_captacao com chave única — sem isso o lead não tem dono (6.8)
6. configurar operação      horários, regras de distribuição, templates aprovados
7. importar carteira        validação prévia, relatório de erros, renovações agendadas (8.6)
8. criar consultores        convite, capacidade de atendimento
9. teste de fumaça          um lead sintético percorre a jornada inteira nesta corretora
10. go-live                 canais reais ativados
```

O passo 9 não é opcional: nenhuma corretora recebe lead real antes de um lead sintético ter atravessado a
jornada dela, com a configuração dela. E o inverso também é roteirizado — **desativar** uma corretora
suspende canais, encerra sessões, para as réguas e preserva o dado sob a política de retenção.

---

## 20. Qualidade de código

Os portões desta seção não são meta aspiracional. São condição de merge.

### 20.1 Os três números

| Métrica                  | Limite                                | Ferramenta           | Onde é imposto          |
| ------------------------ | ------------------------------------- | -------------------- | ----------------------- |
| **Cobertura de teste**   | **≥ 98%** em linhas **e** em branches | Vitest + coverage v8 | Falha o CI abaixo disso |
| **Duplicação de código** | **≤ 2%**                              | jscpd                | Falha o CI acima disso  |
| **Worktree verde**       | Sempre                                | Portão único (20.3)  | Pre-push e CI           |

**Cobertura de 98% em branches, não só em linhas.** Cobertura de linha alta com branch baixa esconde
justamente o caminho de erro — e neste produto o caminho de erro é onde mora o vazamento.

Exclusão de cobertura só existe em `vitest.config.ts`, em lista explícita, com comentário justificando
cada entrada. Categorias aceitas: código gerado, arquivo de tipo puro, ponto de entrada sem lógica.
Comentário `/* c8 ignore */` espalhado pelo código é proibido — ele torna a cobertura uma métrica
negociável linha a linha.

Duplicação medida com mínimo de 50 tokens, ignorando migrations e código gerado. Acima de 2%, o CI aponta
os blocos e o PR não passa.

### 20.2 O que "verde" significa

`main` e toda branch de trabalho ficam verdes. Verde é uma definição fechada, sem interpretação:

```
[ ] lint            0 erro, 0 aviso
[ ] typecheck       0 erro, TypeScript strict, nenhum `any` implícito ou explícito
[ ] testes          100% passando, nenhum pulado sem issue vinculada
[ ] cobertura       >= 98% linhas e branches
[ ] duplicação      <= 2%
[ ] build           conclui
[ ] formatação      sem diferença
[ ] worktree limpo  nada não commitado, nada gerado fora do .gitignore
```

**Regra para agentes e pessoas:** toda alteração termina com o portão verde ou é revertida. Não se
encerra uma tarefa deixando teste quebrado, cobertura caída ou tipo com erro — nem "para arrumar no
próximo commit". Se a mudança não couber inteira, ela é dividida em fatias que fecham verdes.

### 20.3 O portão único

Um só comando, idêntico na máquina do dev, no hook e no CI. Divergência entre eles é o que faz "passa
aqui e quebra lá".

```bash
npm run portao      # lint + typecheck + test --coverage + jscpd + build
```

- **pre-commit:** lint e formatação nos arquivos alterados. Rápido.
- **pre-push:** `npm run portao` inteiro.
- **CI:** `npm run portao` de novo, em ambiente limpo, mais os testes de isolamento e de payload.
- **Merge:** bloqueado enquanto o CI não estiver verde. Sem exceção, sem override.

### 20.4 Padrões de escrita

| Regra                       | Limite                                                                       |
| --------------------------- | ---------------------------------------------------------------------------- |
| TypeScript `strict`         | Ligado. `any` proibido; onde o tipo é desconhecido, `unknown` com narrowing. |
| Complexidade ciclomática    | ≤ 10 por função                                                              |
| Tamanho de função           | ≤ 50 linhas                                                                  |
| Tamanho de arquivo          | ≤ 300 linhas                                                                 |
| Profundidade de aninhamento | ≤ 3                                                                          |
| Parâmetros por função       | ≤ 4; acima disso, objeto nomeado                                             |
| Exportação                  | Nomeada. `export default` só onde o framework exigir.                        |

Convenções que valem mais que as métricas:

- **A linguagem do domínio é a do `AGENTS.md`.** `oportunidade`, não `deal`. `corretora`, não `tenant`,
  no código de domínio. Um conceito, um nome, em banco, tipo, função e tela.
- **Módulo profundo:** interface pequena, implementação encapsulada. Um módulo que expõe quinze funções
  para fazer uma coisa é um módulo raso, e vai ser duplicado.
- **Erro é valor, não exceção**, nos caminhos esperados — validação falhou, integração recusou, dado
  faltando. Exceção fica para o que é realmente excepcional.
- **Sem código morto.** Recurso desligado sai do repositório; o Git guarda o histórico.
- **Comentário explica o porquê.** Comentário que repete o código é ruído e sai na revisão.
- **Sem TODO solto.** Todo TODO cita uma issue, ou não entra.

### 20.5 Como chegar a 98% sem inflar

Noventa e oito por cento só é atingível se o código for desenhado para ser testável. A arquitetura já
ajuda: a lógica de jornada, qualificação, prioridade e régua é **pura**, recebe dependências por
parâmetro e não conhece nem HTTP nem banco. Isso é o que torna a cobertura alta barata em vez de
teatral.

Teste que existe só para levantar o número é pior que nenhum: ele custa manutenção e não pega defeito.
A revisão de PR rejeita teste sem asserção significativa, teste que só verifica mock e snapshot gigante
usado como substituto de asserção.

### 20.6 O que os 98% medem

Uma meta de cobertura só significa alguma coisa se o denominador estiver definido. Aqui ele é:

| Entra na cobertura                                          | Fica de fora (declarado em `vitest.config.ts`) |
| ----------------------------------------------------------- | ---------------------------------------------- |
| Lógica de domínio: jornada, qualificação, prioridade, régua | Código gerado (tipos do banco, cliente de API) |
| Conectores, contratos e mapeamentos                         | Arquivos só de tipo                            |
| Server Actions, Route Handlers, autorização                 | Ponto de entrada sem lógica                    |
| Montagem de DTO e redação de PII                            | Arquivo de configuração                        |
| Componentes com lógica                                      | Migrations                                     |

A pirâmide, para que o número não seja alcançado por um único tipo de teste:

- **Unitário** — a maior parte. Lógica pura, sem banco e sem rede. É rápido porque a arquitetura o permite.
- **Integração** — contra o Postgres real do Supabase CLI. É aqui que RLS, policy e transação são
  verificados; teste de RLS com banco falso não prova nada.
- **Contrato** — stub e real cumprindo o mesmo acordo (21.3).
- **Ponta a ponta** — poucos, sobre os caminhos que não podem quebrar: login, distribuição, cotação,
  fechamento. Rodam no navegador, contra a homologação em Docker.

Os testes E2E entram no portão, mas não no cálculo de cobertura — senão eles viram a muleta que esconde a
falta de teste de unidade.

---

## 21. Testes

Testes comuns são obrigatórios. Estes quatro são específicos deste produto e valem mais que o resto.

### 21.1 Isolamento entre corretoras

O teste mais importante do repositório. Com duas corretoras semeadas e um usuário em cada:

- para **toda** tabela de domínio, o usuário de A não lê nenhuma linha de B;
- o usuário de A não escreve linha com `corretora_id` de B — nem por `insert`, nem por `update` tentando
  mover a linha;
- consultor não lê oportunidade atribuída a outro consultor da mesma corretora;
- `PLATFORM_ADMIN` não lê PII de nenhuma corretora pelos caminhos normais (6.7);
- acesso a id de outro tenant devolve 404, não 403;
- o teste é **gerado a partir do catálogo de tabelas**: tabela nova sem policy quebra o pipeline em vez
  de passar despercebida.

### 21.2 Vazamento no payload

Renderizar as telas com PII e afirmar que o HTML entregue não contém CPF completo, telefone completo,
número de apólice nem `service_role`. Roda sobre o HTML real, em CI.

### 21.3 Contrato de conector

Cada conector — stub e real — é validado contra o mesmo contrato: mesmos campos obrigatórios, mesmas
recusas, mesma forma de resposta. É isso que garante que trocar stub por API real não quebra a jornada
(10.5). Inclui reexecução com a mesma chave de idempotência, afirmando que nada duplica.

### 21.4 Jornada

Percorrer a máquina de estados afirmando que transição inválida é recusada, que cada transição grava
evento, e que responder ao cliente cancela os agendamentos pendentes.

### 21.5 Ponta a ponta

Poucos e estáveis, sobre a homologação em Docker: login e bloqueio cruzado entre as três áreas; lead
entrando por canal até virar oportunidade; distribuição sem entrega dupla; cotação apresentando opções;
fechamento até apólice. Teste E2E instável é corrigido ou removido — nunca marcado para ignorar.

---

## 22. CI/CD

Todo PR: `npm run portao` → testes de isolamento → teste de payload → teste de contrato. Nenhum merge com
qualquer etapa vermelha.

Verificações adicionais no pipeline:

- nenhuma variável `NEXT_PUBLIC_*` contendo segredo;
- nenhuma tabela nova sem RLS e sem categoria declarada;
- nenhum `select('*')` em tabela com PII;
- varredura de segredo commitado;
- auditoria de dependência;
- verificação de que o snapshot de espelho não vazou para o repositório.

Deploy: preview automático por PR, produção por merge em `main`, migrations aplicadas antes de o tráfego
apontar para a nova versão.

---

## 23. Escopo do MVP

O MVP prova **uma jornada completa**, não uma coleção de telas.

```
Lead → WhatsApp → Qualificação → Cotação → Fila → Consultor →
Negociação → Proposta → Emissão → Venda
```

| Incluir                                             | Deixar para depois          |
| --------------------------------------------------- | --------------------------- |
| 1 seguradora, com conector real ou stub (10.5)      | Múltiplas seguradoras       |
| Poucas corretoras piloto                            | Regras avançadas por tenant |
| Jornada padronizada                                 | Modelos preditivos          |
| Distribuição básica com as três réguas de follow-up | Marketplace de integrações  |
| Dashboard essencial do gestor                       | Expansão de canais          |

Mesmo no MVP, nada das seções 4, 6, 13, 14, 20 e 21 é adiável. Segurança e qualidade não são fase 2.

---

## 24. Métricas

O funil inteiro, instrumentado desde o primeiro dia:

```
LEADS → CONTATÁVEIS → QUALIFICADOS → COTADOS → QUENTES → PROPOSTAS → VENDAS
```

| Família       | Indicadores                                            |
| ------------- | ------------------------------------------------------ |
| Aquisição     | CPL, volume e conversão por origem                     |
| Qualidade     | taxa de contato, completude, distribuição de intenção  |
| Velocidade    | SLA da automação, tempo em fila, SLA comercial         |
| Conversão     | cotação → proposta → venda, por origem e por corretora |
| Economia      | custo por contatável, por oportunidade e por venda     |
| Produtividade | atendimentos, propostas e vendas por consultor         |

Cada métrica é derivada de `oportunidade_evento` cruzado com `investimento_midia`, nunca de contador
incrementado à mão. Venda originada de conector em stub não entra nas métricas de negócio (10.5).

---

## 25. Critérios de aceite

Nada é "pronto" antes de todos passarem.

### Funcional

```
[ ] Login em /entrar
[ ] PLATFORM_ADMIN → /admin/inicio · GESTOR → /gestor/inicio · CONSULTOR → /app/inicio
[ ] Bloqueio cruzado entre as três áreas
[ ] Sessão sobrevive a refresh; logout encerra de verdade
[ ] Lead entra por canal_captacao e é atribuído ao tenant correto
[ ] Canal desconhecido cai em quarentena, sem tenant padrão
[ ] Validação em cadeia pede apenas o dado faltante
[ ] Qualificação grava as três dimensões de forma independente
[ ] Cotação executa e apresenta opções (real ou stub)
[ ] Fila prioriza e distribui sem entregar a mesma oportunidade duas vezes
[ ] Consultor recebe a oportunidade com contexto completo
[ ] As três réguas disparam e são canceladas quando o cliente responde
[ ] Jornada chega até apólice, com pendências rastreáveis
[ ] Emissão agenda a renovação; D-60 abre oportunidade nova no mesmo contato
[ ] Importação de carteira é idempotente e agenda renovações
[ ] Fora da janela de 24 h, só template aprovado é enviado
[ ] Atribuição silencia a automação; cliente respondendo cancela agendamentos
[ ] Telefone inválido cai para o canal de e-mail
[ ] Roteiro de entrada de corretora executa até o teste de fumaça
```

### Segurança

```
[ ] Nenhuma variável NEXT_PUBLIC_ com chave de banco
[ ] Nenhum cliente Supabase no bundle do navegador
[ ] Sessão em cookie HttpOnly; nada em localStorage
[ ] Toda tabela com RLS habilitado E forçado, e categoria declarada
[ ] Toda policy de escrita com WITH CHECK
[ ] Nenhuma policy de tabela de domínio mencionando PLATFORM_ADMIN
[ ] Um usuário ativo pertence a exatamente uma corretora
[ ] Teste de isolamento passando, gerado do catálogo
[ ] Teste de payload passando
[ ] Recurso de outro tenant devolve 404
[ ] Buckets privados; URL assinada de vida curta
[ ] Credencial de corretora criptografada em repouso
[ ] Log sem PII, erro sem stack trace
[ ] MFA ativo para PLATFORM_ADMIN e GESTOR
[ ] Rate limit no login, com mensagem genérica
[ ] Nenhum segredo no Git
[ ] Snapshot de espelho passa na verificação de anonimização
[ ] Região de dados definida e subprocessadores listados
[ ] Plano de resposta a incidente escrito e ensaiado
```

### Qualidade

```
[ ] Cobertura >= 98% em linhas e branches
[ ] Duplicação <= 2%
[ ] npm run portao verde
[ ] Nenhuma exclusão de cobertura sem justificativa escrita
[ ] Nenhum any, nenhum TODO sem issue
[ ] Pirâmide respeitada: RLS testado contra Postgres real, não contra mock
[ ] E2E no portão, fora do cálculo de cobertura
```

### Engenharia

```
[ ] Migrations versionadas; nenhuma alteração de schema pelo painel
[ ] docker compose de homologação sobe a stack inteira
[ ] Os quatro modos de dados funcionam e o modo ativo aparece na tela
[ ] .env.example e .env.homologacao.example completos
[ ] README que leva do clone ao login em 5 minutos
[ ] Outbox e idempotência em toda escrita externa
[ ] Todo conector tem stub e passa no teste de contrato
[ ] Painel de saúde das integrações
[ ] Backup com restauração testada
[ ] Telas principais utilizáveis no celular, com teclado e leitor de tela
```

---

## 26. O que não fazer

1. Expor o PostgREST ao navegador "só nessa tela" — nem em homologação.
2. Guardar sessão em `localStorage`.
3. Confiar apenas no RLS, ou apenas no servidor. São duas muralhas, e as duas ficam de pé.
4. Passar a linha do banco inteira para um Client Component.
5. Criar tabela sem categoria declarada, sem RLS ou sem índice de tenant.
6. Escrever policy só com `using`, esquecendo o `with check`.
7. Adicionar `PLATFORM_ADMIN` a policy de tabela de domínio.
8. Criar view sem `security_invoker`.
9. Usar `service_role` em código alcançável por requisição de usuário.
10. Aceitar `corretora_id` vindo do corpo da requisição, ou adivinhar tenant de canal desconhecido.
11. Chamar sistema externo direto de um handler, sem outbox.
12. Agendar follow-up com `setTimeout` em ambiente serverless.
13. Mudar `etapa` com `update` solto, fora da função de transição.
14. Alterar schema pelo painel do Supabase.
15. Devolver 403 onde 404 evita confirmar existência.
16. Baixar dump cru de produção para a máquina de um desenvolvedor.
17. Abrir sessão `producao-leitura` quando o modo `espelho` resolveria.
18. Encerrar uma tarefa com o portão vermelho.
19. Baixar o limite de cobertura ou de duplicação para fazer o CI passar.
20. Escrever teste sem asserção só para levantar cobertura.
21. Colocar dado de cliente real em seed, teste ou documentação.

---

## 27. Prompt padrão para outra IA

### 27.1 Implementar

```text
Leia AGENTS.md, MEMORY.md e "Blueprint estructure - SaaS.md" por completo antes de escrever código.
Implemente <a fatia pedida> seguindo o blueprint, sem exceção nas seções 4, 6, 13, 14, 20 e 21.
Regras que não se negociam:
- nenhum cliente Supabase no navegador; sessão em cookie HttpOnly
- toda tabela nova declara categoria (6.6) e cumpre a checklist de 6.4
- nenhuma policy de domínio menciona PLATFORM_ADMIN
- todo Client Component recebe DTO, nunca linha de banco
- toda escrita externa passa por outbox com chave de idempotência
- todo conector novo nasce com stub e teste de contrato
- dados sintéticos em qualquer exemplo
A tarefa só termina com o portão verde: cobertura >= 98% em linhas e branches, duplicação <= 2%,
lint e typecheck zerados, build concluído. Se não couber inteira, divida em fatias que fechem verdes.
Ao final, rode a checklist da seção 25 e reporte item a item o que passou e o que falhou.
```

### 27.2 Auditar

```text
Leia "Blueprint estructure - SaaS.md".
Audite o repositório seção por seção.
Gere a tabela: Item | Status ✅⚠️❌ | Evidência (arquivo:linha) | Risco | Ação.
Feche com nota 0–100 e plano priorizado por risco (Crítico → Alto → Médio).
Não altere código; só auditoria.
```

---

## 28. Roadmap após o MVP

Em ordem, sem pular segurança:

1. Recuperação de senha e e-mails transacionais
2. Gestão de usuários e capacidade pelo gestor
3. Conectores reais substituindo os stubs, um a um, com reprocessamento da fila
4. Segunda seguradora — a prova real de que o conector é plugável
5. Dashboard de custo do funil (CPL até custo por venda)
6. Regras de distribuição configuráveis por corretora
7. Permissões finas dentro de papel
8. Observabilidade completa e alarme proativo
9. Endurecimento de produção: WAF, rate limit na borda, gerenciador de segredos

---

## 29. Glossário

| Termo               | Significado                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Tenant              | A corretora. Unidade de isolamento de todo dado.                                            |
| RLS                 | Row Level Security — policy no Postgres que filtra linha por linha.                         |
| `with check`        | Cláusula que valida a linha **depois** da escrita. Sem ela, dá para gravar em outro tenant. |
| `security_invoker`  | Faz a view rodar com os direitos de quem consulta. Sem isso a view fura o RLS.              |
| Categoria de tabela | Domínio, catálogo ou plataforma restrita (6.6). Define a política de acesso.                |
| Outbox              | Tabela de escritas pendentes para sistemas externos, gravada na mesma transação do domínio. |
| Idempotência        | Repetir a operação não muda o resultado.                                                    |
| Disjuntor           | Corta chamadas a um integrador que está falhando, em vez de insistir.                       |
| Stub                | Conector que cumpre o contrato sem API real, guardando a intenção para reprocessar (10.5).  |
| DTO                 | Objeto montado no servidor com só o que o navegador pode ver.                               |
| Espelho             | Snapshot de produção anonimizado, carregado localmente (18.1).                              |
| Portão              | O comando único que define worktree verde (20.3).                                           |
| Fail closed         | Na dúvida, negar.                                                                           |
| Régua               | Sequência de follow-ups com cadência definida.                                              |

---

## 30. Checklist final para colar no PR

```
[ ] RLS habilitado e forçado em toda tabela tocada; categoria declarada
[ ] Policies com using E with check
[ ] Índice em corretora_id
[ ] Nenhum select('*') em tabela com PII
[ ] Client Component recebe DTO, não linha
[ ] Nenhuma NEXT_PUBLIC_ nova com segredo
[ ] Escrita externa com idempotência e outbox
[ ] Conector novo com stub e teste de contrato
[ ] Transição de etapa pela função de transição
[ ] Log passando pelo redator
[ ] Teste de isolamento cobrindo o que mudou
[ ] Migration versionada
[ ] Dados de exemplo sintéticos
[ ] npm run portao verde: cobertura >= 98%, duplicação <= 2%
[ ] Checklist da seção 25 executada
```

---

**Fim do blueprint.**
Implementação que ignore as seções 4, 6, 13, 14, 20 ou 21 está fora de conformidade.
