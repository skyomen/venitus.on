# Venitus.on

Plataforma comercial multi-corretora para corretores de seguros. Não é um CRM para configurar: é uma
operação de vendas pronta para uso, do lead à apólice.

> A complexidade fica na plataforma. A simplicidade fica para o corretor.

**Stack:** Next.js (App Router) · Supabase (Postgres + Auth + Storage) · Vercel · Docker para homologação.

---

## Subir em 5 minutos

Pré-requisitos: Node 22+, Docker Desktop **em execução**, Git.

```bash
git clone https://github.com/skyomen/venitus.on.git
cd venitus.on

cp .env.example .env      # preencher com os valores que `npm run db:up` imprime
npm install

npm run db:up             # sobe Postgres, Auth e Storage em containers
npm run dev               # http://localhost:3000
```

`npm run db:up` imprime `API URL`, `anon key` e `service_role key` do ambiente local — é de lá que saem os
valores do `.env`.

---

## Comandos

| Comando                     | O que faz                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`               | Aplicação em desenvolvimento                                                                  |
| `npm run portao`            | **O portão de qualidade.** Formatação, lint, tipos, marcadores, cobertura, duplicação e build |
| `npm test`                  | Testes                                                                                        |
| `npm run test:cov`          | Testes com cobertura                                                                          |
| `npm run test:db`           | Isolamento entre corretoras, contra o Postgres real                                           |
| `npm run db:up` / `db:down` | Sobe e derruba a stack local em Docker                                                        |
| `npm run db:reset`          | Recria o banco: migrations + seed                                                             |
| `npm run db:status`         | Chaves e portas do ambiente local                                                             |

---

## O portão

Nenhuma alteração termina vermelha. `npm run portao` só passa com:

```
formatação sem diferença · lint 0 erro · typecheck 0 erro
nenhum marcador pendente sem issue
cobertura >= 98% em linhas E branches
duplicação <= 2%
build concluído
```

Os ganchos do Git rodam formatação e lint no commit, e o portão inteiro no push. O CI roda o mesmo
comando em ambiente limpo. Baixar um limite para fazer o CI passar não é uma opção — a saída é redesenhar
o código para ser testável.

---

## Documentação

Leitura obrigatória antes de mexer no código:

| Arquivo                                                              | O que contém                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                                             | Regras duráveis, invariantes de segurança e linguagem do domínio    |
| [`MEMORY.md`](MEMORY.md)                                             | Estado do projeto, decisões tomadas e decisões em aberto            |
| [`Blueprint estructure - SaaS.md`](<Blueprint estructure - SaaS.md>) | A arquitetura: RLS, modelo de dados, jornada, conectores, qualidade |
| [`PLANO-ESQUELETO.md`](PLANO-ESQUELETO.md)                           | As fatias de entrega e onde estamos                                 |

---

## Duas regras que explicam o resto

**O navegador nunca recebe credencial de banco.** Não existe cliente Supabase no navegador, nem variável
`NEXT_PUBLIC_SUPABASE_*`. A sessão vive em cookie `HttpOnly` e todo dado passa pelo servidor. O RLS
continua obrigatório — como segunda muralha, não como única.

**A corretora é o tenant.** Toda tabela de domínio carrega `corretora_id`, e esse valor vem sempre do
token, nunca do corpo da requisição.

---

## Acessos locais

Criados pelo seed, só em local e homologação. Senha de todos: `Venitus@Local123`

| E-mail                 | Papel            | Corretora |
| ---------------------- | ---------------- | --------- |
| `admin@venitus.local`  | `PLATFORM_ADMIN` | —         |
| `gestor@alfa.local`    | `GESTOR`         | Alfa      |
| `consultor@alfa.local` | `CONSULTOR`      | Alfa      |
| `gestor@beta.local`    | `GESTOR`         | Beta      |
| `consultor@beta.local` | `CONSULTOR`      | Beta      |

As duas corretoras existem para que o teste de isolamento tenha um segundo tenant contra o qual provar que
o vazamento não acontece.

---

## Estado atual

Fatias 0 e 1 concluídas: repositório, portão, CI, tenant e RLS com isolamento provado. A tela de login
entra na fatia 2 — veja [`PLANO-ESQUELETO.md`](PLANO-ESQUELETO.md).
