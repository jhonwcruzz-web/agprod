# AGPROD

**Gestão inteligente da pequena propriedade.** Controle sua propriedade, entenda seus
números, produza melhor.

SaaS web, mobile-first, para o pequeno produtor de uva e manga. O produto responde as
perguntas que o produtor não consegue responder com caderno e planilha: quanto produzi,
quanto gastei, quanto vendi, quanto tenho a receber, qual meu custo por quilo e qual
talhão está dando resultado.

---

## Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Linguagem | TypeScript, modo estrito |
| Estilo | Tailwind CSS v4 (configuração CSS-first em `globals.css`) |
| Banco | Supabase / PostgreSQL com Row Level Security |
| Autenticação | Supabase Auth via `@supabase/ssr` |
| Ícones | Phosphor Icons |
| Tipografia | Geist Sans + Geist Mono |
| IA | Anthropic Claude (opcional) com motor local de fallback |

---

## Começando

### 1. Variáveis de ambiente

O arquivo `.env` (ignorado pelo git) precisa de:

```bash
SUPABASE_PROJECT_REF=            # ref do projeto
SUPABASE_URL=                    # https://SEU_REF.supabase.co
SUPABASE_ANON_KEY=               # chave pública
SUPABASE_SERVICE_ROLE_KEY=       # apenas para scripts de manutenção
SUPABASE_DB_URL=                 # postgresql://... (migrações e geração de tipos)

# Expostas ao browser. Nunca coloque a service_role aqui.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Opcional — habilita as respostas em linguagem natural do assistente.
ANTHROPIC_API_KEY=
```

### 2. Banco de dados

```bash
npm run db:apply     # aplica supabase/migrations em ordem
npm run db:types     # gera src/lib/types/database.ts por introspecção
```

### 3. Rodar

```bash
npm install
npm run dev          # http://localhost:3000
```

Crie a conta em `/criar-conta`. O onboarding leva ao cadastro da propriedade e do
primeiro talhão.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | Checagem de tipos |
| `npm run db:apply` | Aplica as migrações SQL |
| `npm run db:types` | Regera os tipos a partir do banco |
| `node tools/verify.js` | Teste ponta a ponta: números, estoque e isolamento por RLS |
| `node tools/smoke-ui.js` | Teste de fumaça autenticado das páginas (exige servidor rodando) |
| `node tools/submit-forms.js` | Envia os formulários de verdade, inclusive com campos condicionais escondidos (exige servidor rodando) |
| `node tools/seed-demo.js <farm_id> [--reset]` | Dados fictícios de demonstração (inclui máquinas) |
| `node tools/seed-machines.js <farm_id> [--reset]` | Só máquinas e implementos fictícios |

Rode `db:types` depois de **toda** migração que mexa em tabelas, colunas, views ou enums.

---

## Modelo de dados

28 tabelas e 7 views, todas com RLS. O desenho gira em torno de três eixos:
**propriedade → talhão → safra**.

```
farms ──┬── farm_users            (quem acessa e com que papel)
        ├── seasons               (safras)
        ├── plots ── crop_cycles  (talhão × safra, com a previsão em t/ha)
        ├── production_records    (colheitas)
        ├── applications          (fitossanidade)
        ├── fertilizations        (adubação)
        ├── irrigation_records    (irrigação)
        ├── products ── inventory_movements
        ├── expenses              (livro único de custos)
        ├── buyers ── sales ── revenues
        ├── machines ── machine_logs  (máquinas, implementos, manutenção, combustível)
        ├── activities, alerts, media
        ├── ai_conversations ── ai_messages
        └── audit_logs
```

### Views de indicadores

| View | Entrega |
|---|---|
| `v_plot_performance` | Produção, custo, custo/kg, kg/ha, receita e resultado por talhão |
| `v_plot_cost_breakdown` | Custo por talhão quebrado em categoria |
| `v_farm_overview` | Panorama da propriedade por safra |
| `v_stock_status` | Estoque com semáforo normal / baixo / crítico |
| `v_buyer_prices` | Preço médio por comprador |
| `v_forecast` | Previsto x realizado por talhão e safra (volume = t/ha × área) |
| `v_machine_status` | Por máquina: custo de manutenção e combustível, próxima revisão, semáforo |

Todas usam `security_invoker = true` — sem isso a view rodaria com os privilégios de
quem a criou e furaria o RLS das tabelas de base.

---

## As duas regras que fazem os números fecharem

O princípio do produto é **confiável: os números devem fechar**. Duas regras sustentam
isso, e ambas estão no banco, não na interface.

### 1. `expenses` é o único livro de custos

Aplicação, adubação e irrigação lançam sua despesa automaticamente em `expenses`, já
atribuída ao talhão, por trigger. Não existe soma paralela: o custo do talhão é a soma
de `expenses`, e ponto.

### 2. Comprar insumo não é custo de produção

A compra para estoque também entra em `expenses` — é saída de caixa real — mas com
`is_production_cost = false`. O custo de produção só é reconhecido quando o insumo é
**aplicado no talhão**.

Por quê: se a compra e a aplicação contassem as duas, um saco de adubo comprado e
aplicado na mesma safra apareceria duas vezes e o custo por quilo mentiria.

Consequência prática:

- **Financeiro** usa todas as linhas → mostra o caixa de verdade.
- **Custo/kg** usa só `is_production_cost = true` → mostra o custo de produzir.

### Normalização de unidades

Colheita e venda aceitam caixa, tonelada e unidade, mas tudo é convertido para kg em
`quantity_kg` por trigger. Quando a unidade não é massa, o peso unitário é obrigatório —
sem ele o custo por quilo não teria como fechar.

---

### Qual safra cada tela mostra

O seletor de safra no topo governa os números. A regra:

| Mostra a **safra escolhida** | Mostra **todas as safras** |
|---|---|
| Painel, Talhões e a página de cada talhão | Financeiro (saldo, a pagar, a receber) |
| Produção, Custos, Aplicações, Adubação, Irrigação | "A receber" da Comercialização |
| Vendas e preço por comprador | Histórico do talhão |
| Assistente de IA | Custos de máquina (patrimônio, vida útil) |

Dinheiro devido não some quando a safra muda — por isso contas em aberto ignoram o
seletor. A página Safras compara uma safra com a outra.

**Totais sempre somados no banco.** As listas das telas têm limite de linhas; os totais
vêm das views de resumo (`v_expense_summary`, `v_revenue_summary`, `v_sales_summary`,
`v_plot_season_performance`), que não têm. Antes, Custos e Financeiro somavam a lista
exibida e subcontavam quando havia mais de 400 lançamentos.

### Previsão x realizado

A previsão é informada em **t/ha por talhão** na safra ativa (Produção → Previsão x
realizado) e fica no ciclo de cultivo (`crop_cycles.expected_t_ha`). O volume previsto
**não é gravado**: é sempre t/ha × área do talhão, para nunca divergir se a área mudar.

Como cada talhão tem a sua variedade, a previsão soma sozinha por variedade. O percentual
atingido considera só o realizado dos talhões **que têm previsão** — um talhão sem meta
não infla o número.

Toda a tela de Produção é filtrada pela safra ativa, para que previsto e realizado sejam da
mesma safra.

### Destinos da colheita

Lista suspensa com opções padrão (Packing house, Venda direta, Mercado interno…) mais as
que o produtor cria pelo botão **+**, que ficam só na fazenda dele. O mesmo componente
(`CreatableSelect`) serve para qualquer lista que precise crescer assim.

### Máquinas e implementos

O diário da máquina (`machine_logs`) registra manutenção preventiva, conserto, revisão e
abastecimento. Cada registro, por trigger:

- lança o valor em `expenses` — manutenção em **máquinas**, abastecimento em
  **combustível**; sem talhão informado, entra como custo geral da propriedade;
- avança o horímetro/odômetro da máquina, que **nunca volta**: um lançamento antigo
  digitado depois não reduz a leitura atual.

A próxima manutenção pode ser por data, por uso (horas/km) ou ambos — vale o que vencer
primeiro. Manutenção vencida aparece no painel "O que precisa da minha atenção".

Um implemento só pode ser acoplado a uma máquina **da mesma propriedade**; o banco recusa
o contrário, mesmo que alguém envie o id de uma máquina alheia.

---

## Segurança

O isolamento entre propriedades é responsabilidade do **banco**, não do frontend.
`tools/verify.js` testa isso a cada execução.

- **RLS em todas as 25 tabelas**, com `force row level security`.
- Toda policy usa `to authenticated` **combinado com um predicado de posse**. `to
  authenticated` sozinho seria autenticação sem autorização (BOLA/IDOR).
- Toda policy de `UPDATE` tem `USING` **e** `WITH CHECK` — sem o segundo, um usuário
  poderia reatribuir a linha para outra propriedade.
- Os helpers `SECURITY DEFINER` vivem no schema `private`, fora da Data API, e checam
  `auth.uid()` internamente.
- `auth.uid()` sempre encapsulado em `(select …)`: avalia uma vez por query em vez de
  uma vez por linha.
- O `farm_id` de toda escrita vem do servidor, nunca do formulário.
- O cookie de propriedade ativa é validado contra a lista que o RLS devolve — trocá-lo à
  mão não dá acesso a nada.
- `user_metadata` nunca é usado em decisão de autorização: é editável pelo próprio
  usuário. Os papéis vivem em `farm_users`.
- A `service_role` nunca recebe o prefixo `NEXT_PUBLIC_`.
- Cabeçalhos de segurança em `next.config.ts`; sessão renovada em `src/proxy.ts`.

### Sessão resiliente

`resolveUser` separa "não há sessão" de "o servidor de login não respondeu". No primeiro
caso o usuário vai para o login; no segundo, tenta de novo por ~4s e, se continuar sem
resposta, mostra "Tentar de novo" (`app/error.tsx`) em vez de deslogar. Token inválido ou
forjado continua indo para o login.

### Papéis

| Papel | Pode |
|---|---|
| `owner` | Tudo, incluindo excluir a propriedade |
| `admin` | Tudo menos excluir a propriedade |
| `operator` | Lançar e editar registros |
| `viewer` | Somente leitura |

---

## O assistente

Duas capacidades, conforme o escopo: responder perguntas sobre os dados e transformar
texto livre em lançamento.

**A IA nunca faz conta.** `src/lib/ai/snapshot.ts` monta um retrato numérico da
propriedade com tudo já calculado pelo Postgres; o modelo apenas lê e explica. É isso que
garante que a resposta do assistente bate com a tela.

Quando o produtor descreve um fato — *"hoje colhi 900 kg de Vitória no P-03"* — o modelo
chama a ferramenta `propor_lancamento` e a interface mostra um cartão de conferência.
**Nada é gravado sem confirmação.**

Sem `ANTHROPIC_API_KEY`, um motor local (`src/lib/ai/local-answers.ts`) responde as
perguntas do dia a dia a partir do mesmo snapshot. O recurso nunca fica indisponível, e
uma falha de rede também cai para ele.

O assistente organiza, interpreta, calcula, compara e alerta. Ele **não** prescreve
manejo agronômico; ao encostar nesse terreno, marca a resposta como sujeita à validação
do responsável técnico.

---

## Interface

Decisões que valem registrar, porque contrariam o padrão de dashboard SaaS:

- **Abas em vez de telas.** Cada módulo e cada talhão concentram tudo em uma página com
  abas na query string (`?aba=`) — URL própria, funciona com o botão voltar.
- **Sem excesso de cards.** Agrupamento por régua (`border-t`, `divide-y`) e espaço
  negativo. Caixa só quando a elevação significa alguma coisa.
- **Números em monoespaçada tabular.** Colunas alinham e os valores não dançam quando
  mudam.
- **Paleta de terra com um único acento.** Neutros quentes (areia) e verde de vinhedo
  dessaturado. Sem roxo, sem glow, sem preto puro.
- **Mobile é barra inferior**, não sidebar espremida: Início · Fazenda · Lançar · IA ·
  Mais, com o botão de lançamento ao alcance do polegar.
- **O painel mostra problemas, não gráficos.** A seção "O que precisa da minha atenção"
  vem antes de qualquer número bonito, e cada item leva para onde se resolve.

---

## Estrutura

```
src/
├── app/
│   ├── (auth)/            entrar, criar-conta
│   ├── (app)/             área logada: painel, talhões, módulos, assistente
│   ├── primeiros-passos/  onboarding
│   └── auth/callback/     troca do código OAuth por sessão
├── components/
│   ├── ui/                Button, Field, Layout, Tabs
│   ├── shell/             Sidebar, BottomNav, ContextBar
│   └── forms/             formulários de lançamento
├── lib/
│   ├── supabase/          clientes browser e servidor
│   ├── actions/           Server Actions (toda escrita)
│   ├── queries/           leituras compostas
│   ├── ai/                snapshot, assistente, motor local
│   ├── farm.ts            resolução de propriedade e safra ativas
│   └── format.ts          formatadores pt-BR
├── proxy.ts               renovação de sessão e guarda de rotas
supabase/migrations/       SQL versionado
tools/                     migrações, geração de tipos, testes
```

---

## Performance em desenvolvimento

O disco desta máquina é lento para muitas escritas pequenas (o próprio Next avisa
"Slow filesystem detected") — típico de antivírus escaneando cada arquivo. Duas
configurações em `next.config.ts` atacam isso:

| Ajuste | Por quê | Efeito medido |
|---|---|---|
| `turbopackFileSystemCacheForDev: false` | O cache persistente (752 MB) fazia "compactações" que travavam o servidor por minutos | Servidor pronto em 1,6s (era 42s) |
| `optimizePackageImports` com o Phosphor | O barril de ícones reexporta 1.513 módulos; sem isso, cada página compilava todos | 1ª página em ~16s (era 44–59s); demais em 1–3s |

**O maior ganho restante depende do Windows:** excluir a pasta do projeto do escaneamento
em tempo real do Windows Defender. Em um PowerShell **como administrador**:

```powershell
Add-MpPreference -ExclusionPath "C:\Projetos\producao-pp"
```

Só faça isso se a pasta tiver apenas código seu e dependências do npm.

---

## O que ainda não existe

Fora do MVP por decisão de escopo: visão computacional, sensores, previsão avançada,
marketplace, contabilidade, folha de pagamento.

Preparados na arquitetura, mas não implementados:

- **WhatsApp.** O fluxo texto → interpretação → confirmação → banco já existe no
  assistente; falta o webhook.
- **Offline.** As tabelas `media` e `documents` e a estrutura de Server Actions
  comportam uma fila de sincronização, mas o service worker não foi escrito.
- **Fotos e documentos.** A tabela `media` existe; falta o bucket do Supabase Storage e
  a tela de upload.
