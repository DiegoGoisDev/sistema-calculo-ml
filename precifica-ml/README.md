# Precifica ML

Sistema de precificação de produtos para o Mercado Livre. Calcula o preço de venda a partir do valor de compra e do frete, somando tarifas do ML, impostos (com cenários da reforma tributária), Mercado Ads, devoluções e o lucro desejado.

## Estrutura

```
precifica-ml/
├── backend/                 API em Node.js (Express)
│   ├── .env.example
│   └── src/
│       ├── package.json     dependências e scripts (npm roda daqui)
│       ├── data/            criado na 1ª execução (db.json com os dados)
│       ├── server.js        inicia o banco e sobe o servidor
│       ├── app.js           configura o Express (CORS, JSON, rotas, erros, frontend)
│       ├── config/
│       │   ├── env.js       variáveis de ambiente
│       │   ├── database.js  armazenamento em arquivo JSON (read/update)
│       │   └── defaults.js  dados iniciais (tipos, cenários, configurações)
│       ├── routes/          mapeia URL → controller
│       ├── controllers/     recebe a requisição e devolve a resposta
│       ├── services/        regras de negócio, cálculo e importação da planilha
│       ├── scripts/         importarPlanilha.js (npm run importar-planilha)
│       ├── middlewares/     tratamento de erros e rota não encontrada
│       └── utils/           validação, AppError, asyncHandler
└── frontend/                páginas em HTML, CSS e JavaScript puro
    ├── index.html           Calculadora (página inicial)
    ├── pages/
    │   ├── produtos.html    Meus produtos
    │   ├── tipos.html       Tipos de produto (base de tarifas e impostos)
    │   └── impostos.html    Cenários de impostos e reforma tributária
    └── assets/
        ├── css/styles.css
        └── js/
            ├── config.js    URL da API
            ├── api.js       cliente HTTP
            ├── ui.js        layout, formatação e utilitários
            └── pages/       um script por página
```

## Como rodar

Requisito: Node.js 18 ou superior.

```bash
cd backend
cp .env.example .env
cd src
npm install
npm start
```

Abra http://localhost:3000. A API também entrega o frontend.

Para desenvolver com recarga automática: `npm run dev` (também em `backend/src`).

### Importar a planilha

O cálculo segue as mesmas fórmulas da planilha `Precificacao_Mercado_Livre.xlsx`. Para trazer a aba **Base de Produtos** (tipos, tarifas, imposto sobre a venda, importação, embalagem, Ads, devoluções e opções de lucro) para o sistema:

```bash
cd backend/src
npm run importar-planilha -- "C:\caminho\Precificacao_Mercado_Livre.xlsx"
```

Os tipos são atualizados pelo nome (os que não existem são criados). O imposto sobre a venda da planilha só vira imposto próprio do tipo quando difere do cenário ativo; se for igual, o tipo continua seguindo o cenário de impostos. Reinicie o servidor depois de importar.

### Frontend separado da API

Abrindo as páginas por outro servidor local (ex.: Live Server do VS Code na porta 5500), o frontend já usa a API em `http://localhost:3000/api` — basta deixar o backend rodando.

Se for hospedar o frontend em outro servidor, edite `frontend/assets/js/config.js` com a URL da API, ajuste `CORS_ORIGIN` no `.env` e use `SERVE_FRONTEND=false`.

## Endpoints da API

Percentuais são enviados e recebidos como fração: `0.15` = 15%.

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/health` | Status da API |
| POST | `/api/precificacao/simular` | Calcula preço, detalhamento e tabela por % de lucro |
| GET, POST | `/api/produtos` | Lista (com preço recalculado) / cria produto |
| GET, PUT, DELETE | `/api/produtos/:id` | Busca / atualiza / remove |
| POST | `/api/produtos/atualizar-precos` | Grava o preço atual como preço salvo de todos |
| GET | `/api/produtos/exportar` | Baixa CSV |
| GET, POST | `/api/tipos` | Lista / cria tipo de produto |
| GET, PUT, DELETE | `/api/tipos/:id` | Busca / atualiza / remove |
| GET, POST | `/api/cenarios` | Lista / cria cenário de impostos |
| GET | `/api/cenarios/ativo` | Cenário em uso |
| GET, PUT, DELETE | `/api/cenarios/:id` | Busca / atualiza / remove |
| POST | `/api/cenarios/:id/ativar` | Ativa e recalcula os preços |
| POST | `/api/cenarios/:id/duplicar` | Cria uma cópia |
| GET, PUT | `/api/config` | Mercado Ads, devoluções e opções de lucro |
| GET | `/api/historico` | Registro de alterações |

Exemplo de simulação:

```bash
curl -X POST http://localhost:3000/api/precificacao/simular \
  -H "Content-Type: application/json" \
  -d '{"tipoId":"<id do tipo>","valorCompra":45,"freteCompra":5,"lucro":0.2,"anuncio":"classico"}'
```

## Regra de cálculo

```
Custo total = compra + frete (+ imposto de importação e ICMS, se internacional) + embalagem + frete de envio
Preço = Custo total ÷ (1 − tarifa ML − impostos − Ads − devoluções − lucro)
```

- Abaixo de R$ 79 em Flex/envio próprio, soma o custo fixo do ML (R$ 6,25 a R$ 6,75; 50% do preço abaixo de R$ 12,50).
- O preço é arredondado para cima até o próximo ",90".
- Impostos = soma dos tributos ligados no cenário ativo. Nos marcados como CBS/IBS, aplica a redução definida no tipo de produto.

A regra está em `backend/src/services/calculo.service.js`.

## Reforma tributária

Em **Impostos**, cada cenário é uma lista de tributos com alíquota editável. Quando a lei mudar, edite ou duplique um cenário e ative-o: todos os preços são recalculados e a mudança fica no histórico.

Os cenários iniciais são referências (out/2026). Os de 2027 e 2033 são estimativas até a resolução do Senado que fixará as alíquotas. Confirme as alíquotas do seu regime com o seu contador.

## Trocar o armazenamento por um banco de dados

`config/database.js` expõe `read()` e `update(fn)`. Para usar PostgreSQL, MongoDB etc., reimplemente essas duas funções ou troque os services para usar o banco diretamente; controllers e rotas não mudam.
