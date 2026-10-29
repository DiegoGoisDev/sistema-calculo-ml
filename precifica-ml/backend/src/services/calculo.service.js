/**
 * Regras de cálculo de preço — funções puras, sem acesso ao banco.
 *
 * Preço = Custo total ÷ (1 − tarifa ML − impostos − Ads − devoluções − lucro)
 * Custo total = custo do produto (com importação, se houver) + embalagem + frete de envio
 * Abaixo de R$ 79 em Flex/envio próprio o ML cobra custo fixo por unidade.
 * O preço final é arredondado para cima até o próximo ",90".
 * Mesmas fórmulas da planilha Precificacao_Mercado_Livre.xlsx (aba Calculadora).
 */

const LIMITE_FRETE_GRATIS = 79;
const FAIXAS_CUSTO_FIXO = [
  { aPartirDe: 50, valor: 6.75 },
  { aPartirDe: 29, valor: 6.5 },
  { aPartirDe: 12.5, valor: 6.25 },
];
const PERCENTUAL_ABAIXO_12_50 = 0.5;

const arred = (v) => Math.round(v * 100) / 100;

/** Imposto sobre a venda: o do tipo, se informado; senão, o total do cenário (com redução da reforma). */
export function impostoEfetivo(tipo, cenario) {
  if (tipo?.impostoVenda != null) return tipo.impostoVenda;
  return (cenario?.tributos || [])
    .filter((t) => t.ativo)
    .reduce((soma, t) => soma + t.aliquota * (t.reforma ? 1 - (tipo?.reducaoReforma || 0) : 1), 0);
}

export function custoFixoML(preco, logistica) {
  if (logistica === 'mercado_envios' || preco >= LIMITE_FRETE_GRATIS) return 0;
  const faixa = FAIXAS_CUSTO_FIXO.find((f) => preco >= f.aPartirDe);
  return faixa ? faixa.valor : preco * PERCENTUAL_ABAIXO_12_50;
}

function custoProduto(entrada, tipo) {
  const base = (entrada.valorCompra || 0) + (entrada.freteCompra || 0);
  if (entrada.origem !== 'internacional') return { base, comImportacao: base, impostosImportacao: 0 };
  const comImportacao = (base * (1 + tipo.impostoImportacao)) / (1 - tipo.icmsImportacao);
  return { base, comImportacao, impostosImportacao: comImportacao - base };
}

function precoBruto(custo, divisor, logistica) {
  let preco = custo / divisor;
  if (logistica === 'mercado_envios' || preco >= LIMITE_FRETE_GRATIS) return preco;
  for (const faixa of FAIXAS_CUSTO_FIXO) {
    const candidato = (custo + faixa.valor) / divisor;
    if (faixa === FAIXAS_CUSTO_FIXO[0] && candidato >= LIMITE_FRETE_GRATIS) return LIMITE_FRETE_GRATIS;
    if (candidato >= faixa.aPartirDe) return candidato;
  }
  return divisor > PERCENTUAL_ABAIXO_12_50 ? custo / (divisor - PERCENTUAL_ABAIXO_12_50) : NaN;
}

const arredondarNoventa = (preco) => arred(Math.ceil(preco + 0.1 - 1e-9) - 0.1);

/**
 * @param {object} p
 * @param {object} p.entrada  { valorCompra, freteCompra, freteEnvio, origem, anuncio, logistica, lucro }
 * @param {object} p.tipo     tipo de produto da base
 * @param {object} p.cenario  cenário de impostos
 * @param {object} p.config   { mercadoAds, devolucoes }
 */
export function calcular({ entrada, tipo, cenario, config }) {
  const tarifa = entrada.anuncio === 'premium' ? tipo.tarifaPremium : tipo.tarifaClassico;
  const impostos = impostoEfetivo(tipo, cenario);
  const outros = (config.mercadoAds || 0) + (config.devolucoes || 0);
  const produto = custoProduto(entrada, tipo);
  const custoTotal = produto.comImportacao + (tipo.embalagem || 0) + (entrada.freteEnvio || 0);
  const percentuais = { tarifa, impostos, outros, lucro: entrada.lucro, total: tarifa + impostos + outros };
  const divisor = 1 - percentuais.total - entrada.lucro;

  const base = {
    custo: { produto: arred(produto.base), impostosImportacao: arred(produto.impostosImportacao), embalagem: tipo.embalagem || 0, freteEnvio: entrada.freteEnvio || 0, total: arred(custoTotal) },
    percentuais,
  };

  if (custoTotal <= 0) return { ...base, viavel: false, motivo: 'Informe o valor de compra.' };
  const bruto = divisor > 0 ? precoBruto(custoTotal, divisor, entrada.logistica) : NaN;
  if (!Number.isFinite(bruto)) {
    return { ...base, viavel: false, motivo: 'Lucro + tarifas + impostos passam de 100% do preço. Escolha um lucro menor.' };
  }

  const preco = arredondarNoventa(bruto);
  const custoFixo = custoFixoML(preco, entrada.logistica);
  const valores = {
    mercadoLivre: arred(preco * tarifa + custoFixo),
    custoFixo,
    impostos: arred(preco * impostos),
    outros: arred(preco * outros),
  };
  // Como na planilha: preço × (1 − percentuais) − custo, arredondado só no fim
  const lucro = arred(preco * (1 - percentuais.total) - custoFixo - custoTotal);

  return { ...base, viavel: true, preco, valores, lucro, margem: lucro / preco, alertas: alertas(preco, entrada) };
}

function alertas(preco, entrada) {
  const lista = [];
  if (preco >= 70 && preco < LIMITE_FRETE_GRATIS) {
    lista.push('Preço perto de R$ 79: a partir desse valor o frete grátis é obrigatório. Compare os dois lados no Simulador de Custos do ML.');
  }
  if (entrada.logistica === 'mercado_envios' && preco >= LIMITE_FRETE_GRATIS && !entrada.freteEnvio) {
    lista.push('Acima de R$ 79 você paga parte do frete grátis. Informe o frete de envio para um preço preciso.');
  }
  return lista;
}
