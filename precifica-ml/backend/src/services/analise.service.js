import db from '../config/database.js';
import AppError from '../utils/AppError.js';
import { numero } from '../utils/validators.js';
import { calcular, avaliarPreco, impostoEfetivo, statusMargem } from './calculo.service.js';
import { contexto } from './precificacao.service.js';
import { comPrecoAtual } from './produtos.service.js';
import { metasDe } from './config.service.js';

/**
 * Análises sobre os produtos salvos — só leitura, nada é gravado.
 * Todas usam as mesmas regras de calculo.service.js com o cenário ativo (ou com cada cenário, na comparação).
 */

const arred = (v) => Math.round(v * 100) / 100;
const soma = (lista, f) => lista.reduce((s, x) => s + f(x), 0);
const media = (lista, f) => (lista.length ? soma(lista, f) / lista.length : null);
const viavel = (p) => p.atual && p.atual.preco !== undefined;

const FAIXAS_MARGEM = [
  { rotulo: 'Até 10%', ate: 0.1 },
  { rotulo: '10% a 20%', ate: 0.2 },
  { rotulo: '20% a 30%', ate: 0.3 },
  { rotulo: 'Acima de 30%', ate: Infinity },
];
const DESCONTOS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3];

function resumoProduto(p) {
  return {
    id: p.id, nome: p.nome, tipo: p.tipo, status: p.status, volumeMensal: p.volumeMensal || 0,
    preco: p.atual.preco, lucro: p.atual.lucro, margem: p.atual.margem, custo: p.atual.custo,
  };
}

/** Curva ABC pelo lucro mensal (lucro por venda × vendas por mês): A = 80% do lucro, B = próximos 15%, C = resto. */
export function curvaAbc(itens) {
  const comLucro = itens.filter((x) => x.lucroMensal > 0).sort((a, b) => b.lucroMensal - a.lucroMensal);
  const total = soma(comLucro, (x) => x.lucroMensal);
  let acumulado = 0;
  return comLucro.map((x) => {
    const antes = acumulado / total;
    acumulado += x.lucroMensal;
    return { ...x, participacao: x.lucroMensal / total, acumulado: acumulado / total, classe: antes < 0.8 ? 'A' : antes < 0.95 ? 'B' : 'C' };
  });
}

/** Painel geral: totais, semáforo, distribuição de margens, ranking, projeção mensal e curva ABC. */
export async function resumo() {
  const dados = await db.read();
  const metas = metasDe(dados.config);
  const lista = dados.produtos.map((p) => comPrecoAtual(p, dados));
  const viaveis = lista.filter(viavel).map(resumoProduto);

  const status = { saudavel: 0, atencao: 0, critico: 0 };
  lista.forEach((p) => { status[p.status] += 1; });

  const distribuicao = FAIXAS_MARGEM.map((f, i) => ({
    rotulo: f.rotulo,
    quantidade: viaveis.filter((p) => p.margem < f.ate && (i === 0 || p.margem >= FAIXAS_MARGEM[i - 1].ate)).length,
  }));
  distribuicao.unshift({ rotulo: 'Inviável', quantidade: lista.length - viaveis.length });

  const porMargem = [...viaveis].sort((a, b) => b.margem - a.margem);
  const comVolume = viaveis.filter((p) => p.volumeMensal > 0).map((p) => ({ ...p, lucroMensal: arred(p.lucro * p.volumeMensal) }));
  const faturamento = soma(comVolume, (p) => p.preco * p.volumeMensal);
  const custo = soma(comVolume, (p) => p.custo * p.volumeMensal);
  const lucro = soma(comVolume, (p) => p.lucroMensal);
  const cenario = dados.cenarios.find((c) => c.id === dados.cenarioAtivoId) || dados.cenarios[0];

  return {
    cenario: { id: cenario.id, nome: cenario.nome },
    metas,
    totais: {
      produtos: lista.length,
      viaveis: viaveis.length,
      inviaveis: lista.length - viaveis.length,
      margemMedia: media(viaveis, (p) => p.margem),
      lucroMedio: media(viaveis, (p) => p.lucro),
      precoMedio: media(viaveis, (p) => p.preco),
    },
    status,
    distribuicao,
    melhores: porMargem.slice(0, 5),
    piores: porMargem.slice(-5).reverse(),
    projecao: {
      produtos: comVolume.length,
      unidades: soma(comVolume, (p) => p.volumeMensal),
      faturamento: arred(faturamento),
      custo: arred(custo),
      tarifasImpostos: arred(faturamento - custo - lucro),
      lucro: arred(lucro),
      margem: faturamento ? lucro / faturamento : null,
    },
    abc: curvaAbc(comVolume),
  };
}

/** Análise de um produto: composição, Clássico × Premium, preços-limite, descontos e cada cenário de impostos. */
export async function produto(id, { preco } = {}) {
  const dados = await db.read();
  const p = dados.produtos.find((x) => x.id === id);
  if (!p) throw new AppError('Produto não encontrado.', 404);
  const metas = metasDe(dados.config);
  const ctx = contexto(dados, p.tipoId);
  const atual = calcular({ entrada: p, ...ctx });

  const anuncios = ['classico', 'premium'].map((anuncio) => {
    const r = calcular({ entrada: { ...p, anuncio }, ...ctx });
    return { anuncio, tarifa: r.percentuais.tarifa, viavel: r.viavel, preco: r.preco, lucro: r.lucro, margem: r.margem, motivo: r.motivo };
  });

  const precoCom = (lucro) => {
    const r = calcular({ entrada: { ...p, lucro }, ...ctx });
    return r.viavel ? r.preco : null;
  };
  const avaliar = (valor) => {
    const r = avaliarPreco({ entrada: p, ...ctx }, valor);
    return { ...r, status: statusMargem(r.margem, metas) };
  };

  const cenarios = dados.cenarios.map((c) => {
    const r = calcular({ entrada: p, tipo: ctx.tipo, cenario: c, config: ctx.config });
    const mantendo = atual.viavel ? avaliarPreco({ entrada: p, tipo: ctx.tipo, cenario: c, config: ctx.config }, atual.preco) : null;
    return {
      id: c.id, nome: c.nome, ativo: c.id === ctx.cenario.id, impostos: impostoEfetivo(ctx.tipo, c),
      viavel: r.viavel, preco: r.preco, lucro: r.lucro, margem: r.margem,
      variacao: r.viavel && atual.viavel ? arred(r.preco - atual.preco) : null,
      lucroMantendoPreco: mantendo ? mantendo.lucro : null,
    };
  });

  let simulacao = null;
  if (preco !== undefined && preco !== '') simulacao = avaliar(numero(preco, 'preco', { min: 0.01 }));

  return {
    produto: comPrecoAtual(p, dados),
    metas,
    resultado: atual,
    anuncios,
    precos: { equilibrio: precoCom(0), minimo: precoCom(metas.margemMinima), alvo: precoCom(metas.margemAlvo) },
    descontos: atual.viavel ? DESCONTOS.map((d) => ({ desconto: d, ...avaliar(atual.preco * (1 - d)) })) : [],
    cenarios,
    simulacao,
  };
}

/** Preço e lucro de cada produto em cada cenário de impostos, com o impacto de não reajustar. */
export async function cenarios() {
  const dados = await db.read();
  const metas = metasDe(dados.config);
  const ativoId = (dados.cenarios.find((c) => c.id === dados.cenarioAtivoId) || dados.cenarios[0]).id;

  const linhas = dados.produtos
    .filter((p) => dados.tipos.some((t) => t.id === p.tipoId))
    .map((p) => {
      const ctxAtivo = contexto(dados, p.tipoId);
      const atual = calcular({ entrada: p, ...ctxAtivo });
      return {
        id: p.id,
        nome: p.nome,
        tipo: ctxAtivo.tipo.nome,
        valores: dados.cenarios.map((c) => {
          const ctx = { ...ctxAtivo, cenario: c };
          const r = calcular({ entrada: p, ...ctx });
          const mantendo = atual.viavel ? avaliarPreco({ entrada: p, ...ctx }, atual.preco) : null;
          return {
            cenarioId: c.id,
            viavel: r.viavel,
            preco: r.preco ?? null,
            lucro: r.lucro ?? null,
            margem: r.margem ?? null,
            status: statusMargem(r.viavel ? r.margem : NaN, metas),
            variacao: r.viavel && atual.viavel ? arred(r.preco - atual.preco) : null,
            lucroMantendoPreco: mantendo ? mantendo.lucro : null,
          };
        }),
      };
    });

  const resumoCenarios = dados.cenarios.map((c, i) => {
    const valores = linhas.map((l) => l.valores[i]);
    const comparaveis = valores.filter((v) => v.variacao !== null);
    return {
      id: c.id,
      nome: c.nome,
      ativo: c.id === ativoId,
      inviaveis: valores.filter((v) => !v.viavel).length,
      precoMedio: media(valores.filter((v) => v.viavel), (v) => v.preco),
      variacaoMedia: media(comparaveis, (v) => v.variacao),
      prejuizoSemReajuste: valores.filter((v) => v.lucroMantendoPreco !== null && v.lucroMantendoPreco < 0).length,
    };
  });

  return { metas, cenarios: resumoCenarios, produtos: linhas };
}

/**
 * "E se...": aplica variações de custo e percentuais aos produtos e mostra o lucro mantendo o preço atual
 * e o novo preço necessário para manter o lucro escolhido.
 * custo, frete e cambio: variação relativa (0.1 = +10%). tarifa e impostos: pontos percentuais em fração (0.01 = +1 p.p.).
 */
export async function sensibilidade(body = {}) {
  const choque = {
    custo: numero(body.custo, 'custo', { min: -0.9, max: 5, padrao: 0 }),
    frete: numero(body.frete, 'frete', { min: -1, max: 5, padrao: 0 }),
    cambio: numero(body.cambio, 'cambio', { min: -0.9, max: 5, padrao: 0 }),
    tarifa: numero(body.tarifa, 'tarifa', { min: -0.3, max: 0.3, padrao: 0 }),
    impostos: numero(body.impostos, 'impostos', { min: -0.3, max: 0.3, padrao: 0 }),
  };
  const dados = await db.read();
  const metas = metasDe(dados.config);

  const produtos = dados.produtos
    .filter((p) => dados.tipos.some((t) => t.id === p.tipoId))
    .map((p) => {
      const ctx = contexto(dados, p.tipoId);
      const antes = calcular({ entrada: p, ...ctx });
      if (!antes.viavel) return null;

      const fatorCompra = (1 + choque.custo) * (p.origem === 'internacional' ? 1 + choque.cambio : 1);
      const entrada = {
        ...p,
        valorCompra: (p.valorCompra || 0) * fatorCompra,
        freteCompra: (p.freteCompra || 0) * fatorCompra,
        freteEnvio: (p.freteEnvio || 0) * (1 + choque.frete),
      };
      const tipo = {
        ...ctx.tipo,
        tarifaClassico: Math.max(0, ctx.tipo.tarifaClassico + choque.tarifa),
        tarifaPremium: Math.max(0, ctx.tipo.tarifaPremium + choque.tarifa),
        impostoVenda: choque.impostos ? Math.max(0, impostoEfetivo(ctx.tipo, ctx.cenario) + choque.impostos) : ctx.tipo.impostoVenda,
      };
      const novoCtx = { ...ctx, tipo };
      const mantendo = avaliarPreco({ entrada, ...novoCtx }, antes.preco);
      const reajustado = calcular({ entrada, ...novoCtx });

      return {
        id: p.id,
        nome: p.nome,
        volumeMensal: p.volumeMensal || 0,
        preco: antes.preco,
        lucroAntes: antes.lucro,
        margemAntes: antes.margem,
        lucroDepois: mantendo.lucro,
        margemDepois: mantendo.margem,
        status: statusMargem(mantendo.margem, metas),
        precoReajustado: reajustado.viavel ? reajustado.preco : null,
        reajuste: reajustado.viavel ? arred(reajustado.preco - antes.preco) : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.margemDepois - b.margemDepois);

  const mensal = (f) => arred(soma(produtos, (p) => f(p) * p.volumeMensal));
  return {
    choque,
    metas,
    totais: {
      produtos: produtos.length,
      prejuizo: produtos.filter((p) => p.lucroDepois < 0).length,
      abaixoMinima: produtos.filter((p) => p.status === 'critico').length,
      lucroMedioAntes: media(produtos, (p) => p.lucroAntes),
      lucroMedioDepois: media(produtos, (p) => p.lucroDepois),
      lucroMensalAntes: mensal((p) => p.lucroAntes),
      lucroMensalDepois: mensal((p) => p.lucroDepois),
    },
    produtos,
  };
}
