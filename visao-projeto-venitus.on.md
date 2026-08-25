# 1. Visão do projeto

Criar uma _plataforma comercial pronta para corretores de seguros_, especialmente corretores com baixa maturidade digital.

A proposta não é entregar apenas um CRM para o corretor configurar.

A proposta é entregar uma _operação de vendas pronta para uso_, com:

_Captação → Qualificação → Priorização → Distribuição → Cotação → Negociação → Proposta → Vistoria/Pendências → Emissão → Pós-venda_

A jornada tem como referência o processo já desenhado no HubSpot por uma corretora, que contempla entrada de lead, validação de dados, cotação, follow-up, transferência para consultor, proposta e emissão. fileciteturn0file0L356-L460

---

# 2. Premissa principal

> _A complexidade fica na plataforma. A simplicidade fica para o corretor._

O corretor não deve precisar entender:

- CRM
- pipeline
- workflows
- APIs
- integrações
- automações
- webhooks
- regras de distribuição

Ele deve entrar e enxergar simplesmente:

- Clientes para atender
- Leads prioritários
- Cotações
- Propostas
- Pendências
- Apólices
- Carteira
- Resultados

---

# 3. Modelo de negócio da plataforma

A solução será _multi-corretora_.

Cada corretora funciona como uma empresa independente dentro da plataforma.

text
PLATAFORMA
│
├── CORRETORA A
│ ├── Gestor
│ ├── Consultores
│ ├── Leads
│ ├── Clientes
│ ├── Oportunidades
│ ├── Cotações
│ └── Apólices
│
├── CORRETORA B
│ ├── Gestor
│ ├── Consultores
│ ├── Leads
│ ├── Clientes
│ ├── Oportunidades
│ ├── Cotações
│ └── Apólices
│
└── CORRETORA C
└── ...

Nenhuma corretora pode visualizar informações de outra.

A _corretora é o tenant do sistema_.

---

# 4. Ownership

Teremos três níveis diferentes de responsabilidade.

### Dono institucional

_Corretora_

Desde que o lead entra, ele pertence à corretora.

### Dono operacional

_Plataforma / automação_

Enquanto estiver em validação, enriquecimento, qualificação e automação.

### Dono comercial

_Consultor_

O consultor somente passa a ser responsável quando o lead entra na fila humana e é efetivamente distribuído.

---

# 5. Arquitetura em camadas

text
┌─────────────────────────────────────────┐
│ EXPERIÊNCIA DO CORRETOR │
│ Leads | Atendimentos | Cotações | Venda │
└─────────────────────┬───────────────────┘
│
┌─────────────────────▼───────────────────┐
│ INTELIGÊNCIA COMERCIAL │
│ Qualificação | Intenção | Prioridade │
│ Distribuição | Próxima melhor ação │
└─────────────────────┬───────────────────┘
│
┌─────────────────────▼───────────────────┐
│ AUTOMAÇÃO E COMUNICAÇÃO │
│ WhatsApp | Chatbot | Follow-ups │
│ Templates | Recuperação de abandono │
└─────────────────────┬───────────────────┘
│
┌─────────────────────▼───────────────────┐
│ HUBSPOT │
│ Contato | Oportunidade | Pipeline │
│ Histórico | Tasks | Gestão comercial │
└─────────────────────┬───────────────────┘
│
┌─────────────────────▼───────────────────┐
│ SEGUROS │
│ Cotação | Proposta | Vistoria │
│ Rastreador | Emissão | Apólice │
└─────────────────────┬───────────────────┘
│
┌─────────────────────▼───────────────────┐
│ BANCO / INFRAESTRUTURA │
│ Corretoras | Usuários | Configurações │
│ Integrações | Logs | Auditoria │
└─────────────────────────────────────────┘

---

# 6. Papel do HubSpot

O HubSpot será utilizado como _motor de CRM_, não necessariamente como a principal interface utilizada pelo corretor.

Responsabilidades previstas:

- Contatos
- Negócios/oportunidades
- Pipeline
- Consultor responsável
- Histórico comercial
- Tarefas
- Estágios da oportunidade
- Informações comerciais
- Parte das automações

A plataforma própria ficará responsável por simplificar essa experiência.

---

# 7. Modelo de dados conceitual

text
CORRETORA
│
├── USUÁRIOS
│ ├── Gestores
│ └── Consultores
│
├── CONTATOS
│ │
│ └── OPORTUNIDADES
│ │
│ ├── COTAÇÕES
│ ├── INTERAÇÕES
│ ├── DOCUMENTOS
│ ├── PROPOSTAS
│ └── APÓLICES
│
├── INTEGRAÇÕES
│
└── CONFIGURAÇÕES

### Regra importante

_Contato não duplica. Oportunidade pode se repetir._

Exemplo:

text
João da Silva

├── Seguro Tracker 2025 → Perdida
├── Seguro Moto 2026 → Vendida
└── Seguro Tracker 2026 → Em negociação

Mesmo CPF/telefone + mesma intenção ativa:

→ atualizar oportunidade existente.

Mesmo CPF/telefone + nova intenção:

→ nova oportunidade.

O processo original prevê tratamento de duplicidade, mas essa regra será evoluída para preservar histórico e novas oportunidades comerciais. fileciteturn0file0L740-L753

---

# 8. Entrada dos leads

A plataforma deverá aceitar leads de:

- Meta Ads
- Google
- Landing Page
- WhatsApp
- Indicação
- Cadastro manual
- Carteira existente
- Futuras integrações

Todo lead será associado automaticamente à corretora correspondente.

---

# 9. Jornada do lead

text
LEAD
↓
IDENTIFICAÇÃO
↓
CONTATABILIDADE
↓
VALIDAÇÃO / ENRIQUECIMENTO
↓
QUALIFICAÇÃO
↓
IDENTIFICAÇÃO DE INTENÇÃO
↓
COTAÇÃO
↓
APRESENTAÇÃO DA OFERTA
↓
PRIORIZAÇÃO
↓
FILA COMERCIAL
↓
DISTRIBUIÇÃO
↓
CONSULTOR
↓
NEGOCIAÇÃO
↓
PROPOSTA
↓
VISTORIA / PENDÊNCIAS
↓
EMISSÃO
↓
APÓLICE
↓
PÓS-VENDA

A jornada de referência já contempla validações de CPF, telefone, CEP e placa e coleta de informações para cotação. fileciteturn0file0L645-L675

---

# 10. Qualificação

A qualificação não será simplesmente:

_Lead bom / Lead ruim._

Teremos três dimensões independentes.

### Contatabilidade

- Contatável
- Não contatável

### Completude

- Completo
- Pendente

### Intenção

- Fria
- Morna
- Quente

Isso permite, por exemplo:

> Cliente com WhatsApp válido, quer contratar hoje, mas informou CEP errado.

Resultado:

_Contatável + Pendente + Quente_

A pendência cadastral não transforma automaticamente um cliente interessado em lead frio.

---

# 11. Intenção comercial

A temperatura deverá considerar comportamento.

Possíveis sinais:

- respondeu à conversa;
- deseja cotar imediatamente;
- perguntou preço;
- perguntou parcelamento;
- selecionou cobertura;
- selecionou plano;
- enviou documentos;
- pediu contato humano;
- informou urgência;
- possui cotação concorrente;
- voltou diversas vezes para conversar.

A jornada original inclusive prevê identificação da principal preocupação do cliente e utilização disso durante a argumentação comercial. fileciteturn0file0L610-L639

---

# 12. Distribuição

Princípio:

> _Qualificação determina prioridade, não exclusão._

Não queremos entregar somente leads perfeitos para o comercial.

Isso poderia:

- desperdiçar investimento em aquisição;
- aumentar artificialmente o custo por lead utilizável;
- esconder oportunidades;
- criar dependência excessiva de mídia muito qualificada.

A prioridade deverá considerar:

text
INTENÇÃO +
TEMPO DE ESPERA +
CONTEXTO COMERCIAL +
CAPACIDADE DO CONSULTOR

Lead quente sobe na fila.

Lead frio continua elegível.

Leads antigos ganham prioridade progressivamente para evitar abandono.

---

# 13. Momento da atribuição

O consultor _não será atribuído quando o lead entra_.

Fluxo:

text
Lead chega
↓
Corretora é identificada
↓
Automação trabalha
↓
Qualificação acontece
↓
Lead entra na fila
↓
Sistema prioriza
↓
Consultor recebe

Só nesse momento começa o ownership comercial e o SLA do consultor.

---

# 14. Cotação

A plataforma deverá utilizar integração com a seguradora para realizar a cotação.

Fluxo:

text
Dados suficientes?
│
NÃO ──→ solicitar apenas dado faltante
│
SIM
↓
Executar cotação
↓
Cotação retornou?
│
NÃO ──→ tratar exceção
│
SIM
↓
Apresentar opções

O processo de referência já possui essa lógica de verificar informações faltantes antes de apresentar planos. fileciteturn0file0L374-L397

---

# 15. Atendimento do consultor

O consultor não deverá receber simplesmente:

> “Novo Lead”

Ele deverá receber uma oportunidade contextualizada.

Exemplo:

text
🔥 LEAD QUENTE

Cliente:
João Silva

Veículo:
Tracker Premier 2024

Intenção:
Quer contratar hoje

Principal preocupação:
Roubo / Furto

Cotação:
Realizada

Plano de interesse:
Compreensiva

Pendência:
CEP para confirmar

Tempo na fila:
4 minutos

[ATENDER CLIENTE]

---

# 16. Fechamento

Após a seleção do plano:

text
Plano
↓
Pagamento
↓
Documentação
↓
Espelho da proposta
↓
Confirmação
↓
Transmissão
↓
Vistoria / Rastreador
↓
Análise
↓
Emissão
↓
Apólice

Essa sequência está presente no processo utilizado como referência. fileciteturn0file0L427-L460

---

# 17. Follow-up automático

O sistema terá um motor de follow-up transversal à jornada.

Exemplo:

text
Cliente parou de responder
↓
Automação identifica abandono
↓
Mensagem contextualizada
↓
Cliente respondeu?
↓
Sim → retoma jornada

Não → nova tentativa
↓
Régua de recuperação
↓
Encerramento

O desenho atual já prevê mensagens automáticas após períodos de inatividade e mensagens personalizadas conforme as últimas conversas. fileciteturn0file0L413-L426

---

# 18. Experiência do corretor

O objetivo não é reproduzir visualmente um CRM tradicional.

A home deve responder:

> _O que eu preciso fazer agora?_

Exemplo:

text
BOM DIA, JOÃO

🔥 3 clientes quentes
💬 6 clientes aguardando atendimento
📄 4 cotações em andamento
⚠️ 2 propostas com pendência
✅ 3 vendas hoje

[ATENDER PRÓXIMO CLIENTE]

Menu principal:

- Início
- Clientes
- Atendimentos
- Cotações
- Propostas
- Apólices
- Carteira

---

# 19. Experiência do gestor

O gestor da corretora precisa enxergar:

- leads recebidos;
- origem;
- contatabilidade;
- intenção;
- leads quentes;
- SLA;
- produtividade;
- cotações;
- conversão;
- propostas;
- vendas;
- desempenho por consultor;
- custo por lead;
- custo por oportunidade;
- custo por venda.

---

# 20. Administração da plataforma

A administração central deverá controlar:

- Corretoras
- Usuários
- Planos
- Integrações
- Produtos
- Regras de negócio
- Templates
- Automações
- Permissões
- Logs
- Auditoria
- Saúde das integrações

---

# 21. Arquitetura de produto

A plataforma deverá diferenciar claramente:

### CORE

Comum para todas as corretoras:

- jornada;
- CRM;
- qualificação;
- distribuição;
- dashboards;
- experiência;
- automações.

### CONFIGURAÇÃO POR CORRETORA

Personalizável:

- usuários;
- logo;
- WhatsApp;
- fontes de leads;
- regras de distribuição;
- horários;
- mensagens;
- integração HubSpot;
- credenciais;
- produtos disponíveis.

### INTEGRAÇÕES DE SEGURO

Plugáveis:

text
CORE
│
├── Suhai
│
├── Seguradora B
│
├── Seguradora C
│
└── futuras integrações

Isso permitirá no futuro evoluir de uma plataforma focada inicialmente na Suhai para um ambiente mais amplo de vendas de seguros.

---

# 22. O que devemos desenvolver

O objetivo não deve ser reconstruir tudo que já existe.

Para cada capacidade devemos decidir:

### APROVEITAR

Já existe e funciona bem.

### AJUSTAR

Existe, mas precisa adaptação.

### INTEGRAR

Outro sistema executará.

### DESENVOLVER

É diferencial da plataforma.

HubSpot, APIs de seguradoras, WhatsApp e demais serviços devem ser tratados como componentes da arquitetura, e não necessariamente reconstruídos.

---

# 23. MVP sugerido

O primeiro MVP deve provar uma única jornada completa:

text
Lead
→ WhatsApp
→ Qualificação
→ Cotação
→ Priorização
→ Distribuição
→ Consultor
→ Negociação
→ Proposta
→ Emissão
→ Venda

Inicialmente com:

- 1 seguradora;
- poucas corretoras piloto;
- uma jornada padronizada;
- distribuição básica;
- dashboard essencial.

Depois evoluímos.

---

# 24. Métricas do produto

A plataforma deverá acompanhar o funil completo:

text
LEADS
↓
CONTATÁVEIS
↓
QUALIFICADOS
↓
COTADOS
↓
LEADS QUENTES
↓
OPORTUNIDADES
↓
PROPOSTAS
↓
VENDAS

Indicadores:

- CPL
- custo por lead contatável
- custo por lead qualificado
- custo por oportunidade
- custo por venda
- taxa de contato
- taxa de cotação
- conversão
- SLA
- produtividade por consultor
- conversão por origem
- conversão por corretora

---

# 25. Princípio final

O produto não deve ser vendido como:

> _“Mais um CRM para corretor de seguros.”_

A visão é:

> _Uma operação comercial de seguros pronta para usar._

O corretor entra para vender.

A plataforma organiza, automatiza, prioriza e conduz todo o restante.
