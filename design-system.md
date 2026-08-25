# Vidro Polar — design system do Venitus.on

**Toda tela nova e toda alteração de tela seguem este documento.** Ele é a autoridade de interface,
como o blueprint é a autoridade de arquitetura.

A tese: **painéis translúcidos sobre azul profundo**. A profundidade vem da luz na borda, não de
sombra difusa — cada painel parece flutuar sobre a operação em vez de estar colado nela.

Implementação: [`src/design/tokens.css`](src/design/tokens.css) ·
[`src/design/base.css`](src/design/base.css) · [`src/componentes/base/`](src/componentes/base)

---

## 1. Princípios

Vêm do produto, não do gosto. Cada um resolve uma disputa concreta.

1. **A tela responde a uma pergunta:** "o que eu preciso fazer agora?". Quando um número e uma ação
   disputam o topo, a ação ganha.
2. **O polegar é o cursor padrão.** O consultor atende do celular, em trânsito, com rede ruim. Alvo
   mínimo de 44 px; o desktop é a adaptação.
3. **Dois toques para 80% das ações recorrentes.** Caminho mais longo é exceção, e exceção precisa
   de justificativa no PR.
4. **Sem vocabulário de sistema.** A pessoa gerencia _clientes_ e _cotações_, nunca _pipeline_,
   _deal_ ou _workflow_.

---

## 2. Arquitetura de tokens

Três camadas. **Componente nunca lê primitiva.** É isso que permite trocar de tema sem tocar em
componente, e é a diferença entre um sistema e uma paleta.

| Camada         | Exemplo                      | Quem lê          | Muda quando                       |
| -------------- | ---------------------------- | ---------------- | --------------------------------- |
| 1 · Primitiva  | `--ciano-300: #5FD4E8`       | Só a camada 2    | Quase nunca. É o inventário.      |
| 2 · Semântica  | `--acao: var(--ciano-300)`   | Componentes      | Ao trocar de tema ou de modo.     |
| 3 · Componente | `--botao-fundo: var(--acao)` | Um componente só | Ao ajustar um componente isolado. |

**Regras verificáveis:**

- Nenhum valor hexadecimal fora de `tokens.css`.
- Nenhum valor de espaço fora da escala (`--e1` a `--e8`).
- Tela não define cor nem espaçamento próprios. Se precisou, falta um componente base.

```css
/* Não */
background: #5fd4e8;
/* Não */
background: var(--ciano-300); /* primitiva dentro de componente */
/* Sim */
background: var(--acao); /* o componente diz o que a cor significa */
```

---

## 3. Cor

Um acento só, reservado para ação. **Estado é família separada** e nunca vira "mais uma cor bonita".

### Papéis semânticos

| Token               | Escuro    | Claro     | Usa para                        |
| ------------------- | --------- | --------- | ------------------------------- |
| `--superficie-base` | `#0A1622` | `#F2F6FA` | Fundo da aplicação              |
| `--superficie-1`    | branco 5% | `#FFFFFF` | Painel em repouso               |
| `--superficie-2`    | branco 8% | `#E9EFF6` | Campo, botão secundário         |
| `--texto-forte`     | `#E8F1F8` | `#0C1B27` | Título, valor, resposta         |
| `--texto-medio`     | `#B8CBDB` | `#35485A` | Texto corrido                   |
| `--texto-fraco`     | `#8FA8BD` | `#5D7183` | Rótulo, apoio, unidade          |
| `--acao`            | `#5FD4E8` | `#0E7A93` | Ação primária, foco, seleção    |
| `--quente`          | `#FF8A5C` | `#C24A22` | Lead quente, urgência comercial |
| `--bom`             | `#59D6A2` | `#1D7A51` | Concluído, dentro do prazo      |
| `--atencao`         | `#F0C46A` | `#8A6410` | Pendência, prazo próximo        |
| `--critico`         | `#FF7B8E` | `#B32B41` | Falha, perda, vencido           |

### Os dois modos

O sistema nasce escuro por identidade. O claro **não é uma inversão**: tem valores próprios, porque
o ciano precisa escurecer para funcionar sobre branco.

São três estados, não dois: `sistema` (padrão, acompanha o aparelho), `claro` e `escuro`. Só a
escolha explícita marca o documento com `data-tema` — é a ausência do atributo que deixa a consulta
de mídia decidir.

A preferência vive em cookie e é aplicada **no servidor**. Aplicá-la no cliente faria a página abrir
no tema errado e piscar ao corrigir.

**A translucidez some no modo claro.** Sobre branco ela vira cinza sujo; no claro o painel é sólido
com borda.

---

## 4. A regra do vidro

Translucidez é a assinatura do sistema e o seu maior risco. Ela custa legibilidade e desempenho.

| Use vidro em                                                            | Não use vidro em                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Painel de conteúdo, cartão de oportunidade, cabeçalho fixo, folha modal | Texto pequeno, tabela densa, campo de formulário, lista longa |

Sempre sobre o fundo controlado da aplicação, nunca sobre imagem.

**Três níveis, e só três:**

- **Nível 0 — plano.** Sem borda, sem sombra. Fundo e áreas de leitura longa.
- **Nível 1 — painel.** `--painel-fundo`, borda de 1 px, luz interna no topo. O padrão.
- **Nível 2 — destaque.** `.painel--destaque`. Reservado ao que exige decisão.

Não existe nível 3. Se algo precisa se destacar acima do nível 2, o problema é de layout — a
resposta é tirar coisa da tela, não empilhar sombra.

---

## 5. Tipografia

Duas famílias: `--fonte-ui` para interface e `--fonte-num` para números. A separação existe porque
número em coluna precisa alinhar, e fonte proporcional não alinha.

| Papel           | Token                               | Peso | Onde                        |
| --------------- | ----------------------------------- | ---- | --------------------------- |
| Valor           | `--t-valor` (1,9 rem)               | 700  | Placa de indicador          |
| Título de tela  | `--t-titulo` (1,55 rem)             | 650  | Saudação, título de página  |
| Título de bloco | `--t-bloco` (1,05 rem)              | 650  | Cartão, seção               |
| Corpo           | `--t-corpo` (0,95 rem)              | 400  | Texto e listas              |
| Apoio           | `--t-apoio` (0,82 rem)              | 400  | Descrição, meta             |
| Rótulo          | `--t-rotulo` (0,68 rem, caixa alta) | 700  | Cabeçalho de campo e coluna |

**Regras:**

- Texto corrido não passa de 68 caracteres.
- Todo título recebe `text-wrap: balance`.
- Todo número em coluna ou comparação recebe `font-variant-numeric: tabular-nums` (classe `.num`).
- Reticências são `…`, não três pontos. Estado de espera termina com elas: `Salvando…`
- Aspas curvas. Marca e identificador levam `translate="no"`.
- Contagem em algarismo: "3 vendas", não "três vendas".

---

## 6. Espaço e densidade

Escala de 4 px (`--e1` a `--e8`), sem valores fora dela. **Espaçamento é responsabilidade do
contêiner** — `gap` em flex ou grid, nunca margem por elemento, que colapsa e dobra em silêncio.

| Densidade     | Onde                                     | Como                        |
| ------------- | ---------------------------------------- | --------------------------- |
| `confortavel` | `/app` — consultor, no celular           | Padrão                      |
| `compacta`    | `/gestor` e `/admin` — tabela em desktop | `data-densidade="compacta"` |

A compacta **encolhe o espaço, nunca o alvo de toque**: em telas de toque o mínimo permanece
44 px.

---

## 7. Movimento

Só onde explica uma mudança de estado. Nada decorativo, nada ambiente.

- Duas durações: `--duracao-1` (120 ms) para resposta de toque, `--duracao-2` (200 ms) para entrada
  e saída. Não há uma terceira.
- Uma curva: `--curva`.
- Anima-se apenas `transform` e `opacity`. **Nunca `transition: all`** — ele pega propriedades que
  não se pretendia animar.
- Toda animação é interrompível.
- `prefers-reduced-motion` corta tudo. É respeito a quem sente enjoo, não preferência estética.

---

## 8. Componentes base

Em [`src/componentes/base/`](src/componentes/base). Todos com teste.

### Botão

Quatro variantes: `primario`, `secundario` (padrão), `discreto`, `perigo`.

```tsx
<Botao variante="primario" largo enviando={enviando}>
  {enviando ? 'Salvando…' : 'Salvar Cotação'}
</Botao>
```

- **Uma ação primária por tela.** Duas competindo é erro de layout.
- **O botão de envio não desabilita**: ele troca para o estado `enviando`. Desabilitar antes da
  requisição começar esconde o erro de validação de quem precisa vê-lo, e some com o alvo debaixo
  do dedo no meio do toque.
- O rótulo diz o que acontece: "Salvar Cotação", nunca "Continuar". Title Case.
- Ação destrutiva pede confirmação ou oferece desfazer. Nunca executa direto.
- Foco por `:focus-visible`, para não desenhar anel em quem clicou com o mouse.

### Campo

```tsx
<Campo
  id="cep"
  rotulo="CEP de pernoite"
  name="cep"
  inputMode="numeric"
  autoComplete="postal-code"
  dica="Só números."
  erro={erro}
/>
```

- Rótulo sempre visível e clicável. Placeholder é exemplo de formato, terminado em `…` — nunca
  substitui o rótulo.
- `type` e `inputMode` corretos abrem o teclado certo no celular. Em CEP e placa isso economiza
  toques em toda cotação.
- `autoComplete` significativo; `spellCheck={false}` em e-mail, código e placa.
- **Colar nunca é bloqueado.**
- Erro ao lado do campo, com `aria-describedby` e `role="alert"`. O primeiro erro recebe foco ao
  enviar.
- O erro diz **como corrigir**: "CEP tem 8 dígitos. Confira o número — faltou um algarismo.", não
  "CEP inválido."

### Placa de indicador

```tsx
<Placa valor="3" descricao="clientes quentes" tom="quente" />
```

O tom só muda quando o número exige ação — colorir tudo faz nada se destacar. Valor em tabular.

### Aviso

`role="alert"` no tom crítico (o leitor de tela precisa anunciar a falha assim que ela aparece);
`role="status"` no neutro, que informa sem interromper a leitura.

### Faixa de modo de dados

Nunca discreta, nunca escondida. Existe para impedir que alguém trate registro de produção como
descartável (blueprint §18).

### Seletor de tema

O rótulo nomeia o tema **em vigor**, não um destino. Nomear o destino exigiria saber o que o sistema
operacional está mostrando — e um botão que promete "Claro" com a tela já clara anuncia algo que não
acontece.

---

## 9. Estado — marcador, não pílula

**Não use cápsulas coloridas arredondadas para estado.** Elas viram enfeite, competem com a ação
primária e são o padrão mais batido de interface gerada por IA.

O estado é **um marcador geométrico e o texto**, sem fundo e sem borda arredondada. A forma carrega
o significado junto com a cor:

| Tom       | Marcador       | Usa para                   |
| --------- | -------------- | -------------------------- |
| `bom`     | círculo cheio  | Concluído, dentro do prazo |
| `atencao` | triângulo      | Pendência, prazo próximo   |
| `critico` | losango        | Falha, perda, vencido      |
| `neutro`  | círculo vazado | Aguardando, não iniciado   |

```html
<span class="estado" data-tom="atencao">Confirmar CEP</span>
```

**Cor nunca sozinha.** Cerca de 8% dos homens não distingue verde de vermelho, e a operação inteira
depende de ler estado de relance. Por isso: marcador com forma própria **e** texto.

O texto nomeia o estado, não a categoria: "Confirmar CEP", não "Pendência".

---

## 10. Componentes do domínio

Ainda não implementados — entram junto com as telas que os consomem (fatia 6 do plano). A
especificação abaixo é vinculante quando isso acontecer.

### Cartão de oportunidade

O consultor nunca recebe "novo lead". Recebe contexto suficiente para abrir a conversa sabendo o que
dizer: cliente, veículo, intenção, maior preocupação, cotação, plano, pendência e tempo na fila.

A temperatura **não é uma pílula**. Ela é um medidor de três traços — fria, morna, quente — que
enche conforme a intenção, com a palavra ao lado. Nível, forma e cor, três codificações para o mesmo
dado.

```tsx
<CartaoOportunidade temperatura="QUENTE" tempoNaFila={4}>
  <CartaoOportunidade.Cliente nome="João Silva" veiculo="Tracker Premier 2024" />
  <CartaoOportunidade.Fatos>
    <Fato rotulo="Intenção">Quer contratar hoje</Fato>
    <Fato rotulo="Pendência">
      <Estado tom="atencao">Confirmar CEP</Estado>
    </Fato>
  </CartaoOportunidade.Fatos>
  <CartaoOportunidade.Acao>Atender Cliente</CartaoOportunidade.Acao>
</CartaoOportunidade>
```

O componente recebe DTO montado no servidor, **nunca a linha do banco** (blueprint §4.3).

---

## 11. Vazio, erro e espera

Os três estados que times esquecem e usuários encontram. **Toda lista e toda requisição precisa dos
três desenhados.**

- **Vazio** diz o que vai preencher aquilo e oferece a próxima ação: "Nenhum cliente aguardando.
  Assim que um lead for qualificado, ele aparece aqui."
- **Erro** traz a saída: "A seguradora não respondeu. Tentamos de novo em 2 minutos — você não
  precisa refazer nada."
- **Espera** é esqueleto com a forma final, para a tela não pular quando o dado chega.

---

## 12. Dados

Regras de leitura, não de enfeite. Ver a skill `dataviz` para o método completo.

**Primeiro: é gráfico mesmo?** Um número só é um número — vira placa de indicador. Gráfico entra
quando há comparação, sequência ou proporção para ler.

### Funil — sequência, um matiz

As etapas do funil são uma **ordem**, não categorias soltas. Codifica-se com um matiz só,
escurecendo. Seis cores diferentes sugeririam que as etapas não têm relação entre si.

### Paleta categórica — verificada, não escolhida a olho

Para séries sem ordem (origem do lead, consultor, seguradora). **Ordem fixa**: a primeira série
sempre recebe o primeiro matiz, e um filtro que remove séries não repinta as que sobraram.

```
#2E9DB8  #D8613C  #5C74D6  #B0862A  #B84A93  #2F9B6B
```

Validada contra a superfície real com `scripts/validate_palette.js` da skill `dataviz`:

```
[PASS] Banda de luminosidade      6 dentro de L 0.48–0.67
[PASS] Piso de croma              6 >= 0.1
[WARN] Separação para daltonismo  pior par 7.8 (deutan) · 10.2 (tritan)
[PASS] Piso de visão normal       pior par 22.8
[PASS] Contraste na superfície    6 >= 3:1
```

O aviso **não é ignorável**: verde e magenta caem na faixa mínima para deutanopia. Isso torna
obrigatório o rótulo direto ou a legenda ao lado — **cor sozinha nunca identifica série**.

**Regras fixas:**

- Uma escala por eixo. Nunca dois eixos verticais no mesmo gráfico.
- Linha de 2 px, marcador de no mínimo 8 px, 2 px de respiro entre áreas.
- Grade e eixos recuam; o dado é que tem contraste.
- Texto usa cor de texto, nunca a cor da série.
- Todo gráfico tem equivalente em tabela.

---

## 13. Acessibilidade

Não é ajuste posterior; é critério de aceite.

- Todo controle tem rótulo ou `aria-label`. Ícone sozinho sempre com `aria-label`.
- `<button>` para ação, `<a>` para navegação. Nunca `<div onClick>`.
- Foco visível em tudo que é interativo, via `:focus-visible`.
- Hierarquia de títulos sem pular nível.
- Atualização assíncrona anuncia com `aria-live` ou `role="alert"`.
- Alvo de toque mínimo de 44 px.
- `touch-action: manipulation` para tirar o atraso do toque duplo.
- Área cheia respeita `env(safe-area-inset-*)`.
- Contêiner de texto trata conteúdo longo com truncamento ou quebra; filho de flex leva
  `min-width: 0`.

---

## 14. Voz

Palavra é material de design. O vocabulário do domínio está fixado em [`AGENTS.md`](AGENTS.md).

| Não escreva             | Escreva                                                    | Porque                              |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------- |
| Pipeline, deal          | Cotações, oportunidades                                    | O corretor não fala a língua do CRM |
| Continuar               | Salvar Cotação                                             | O rótulo diz o que vai acontecer    |
| Ocorreu um erro         | A seguradora não respondeu. Tentamos de novo em 2 minutos. | Erro traz a saída                   |
| O lead será distribuído | Você recebe o próximo cliente da fila                      | Voz ativa, segunda pessoa           |
| três vendas             | 3 vendas                                                   | Contagem em algarismo               |

---

## 15. Como escrever componente novo

### Composição, não bandeira booleana

Um componente que cresce por `props` booleanas vira um emaranhado de combinações que ninguém testa.

```tsx
/* Não */ <Botao primario perigo pequeno carregando />
/* Sim */ <Botao variante="primario" enviando>Salvar Cotação</Botao>
```

### Dependência por parâmetro, não por import

Componente que importa Server Action ou variável de ambiente deixa de ser testável sem subir
aplicação. Passe por parâmetro ou por slot:

```tsx
/* A moldura não conhece o seletor de tema; ela reserva o lugar dele. */
<MolduraArea seletorTema={<SeletorTema tema={tema} aoAlternar={alternarTema} />}>
```

### Onde os arquivos moram

```
src/
├── design/
│   ├── tokens.css      ← camadas 1 e 2. Único lugar com hexadecimal.
│   ├── base.css        ← componentes em CSS
│   ├── tema.ts         ← lógica pura do tema
│   └── acoes.ts        ← Server Action que persiste a escolha
├── componentes/
│   ├── base/           ← Botao, Campo, Placa, Aviso, FaixaModo, SeletorTema
│   └── ...             ← MolduraArea e, adiante, componentes do domínio
└── app/                ← telas: só compõem, não estilizam
```

---

## 16. Checklist para colar no PR de interface

```
[ ] Nenhum hexadecimal fora de tokens.css
[ ] Nenhum espaçamento fora da escala --e1..--e8
[ ] Tela não define cor nem espaçamento próprios
[ ] Uma ação primária por tela
[ ] Rótulo de botão diz o que acontece
[ ] Campo com rótulo clicável, type e inputMode corretos
[ ] Erro diz como corrigir
[ ] Estado usa marcador com forma, nunca cápsula colorida
[ ] Cor nunca sozinha: sempre com forma ou texto
[ ] Vazio, erro e espera desenhados
[ ] Alvo de toque >= 44 px
[ ] Foco visível; hierarquia de títulos correta
[ ] Funciona nos dois temas
[ ] Sem transition: all; prefers-reduced-motion respeitado
[ ] Componente novo recebe dependência por parâmetro e tem teste
```
