import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcular, avaliarPreco, statusMargem } from '../services/calculo.service.js';
import { curvaAbc } from '../services/analise.service.js';

const tipo = { tarifaClassico: 0.13, tarifaPremium: 0.18, impostoVenda: null, reducaoReforma: 0, impostoImportacao: 0.3, icmsImportacao: 0.2, embalagem: 2 };
const cenario = { tributos: [{ aliquota: 0.06, reforma: false, ativo: true }] };
const config = { mercadoAds: 0, devolucoes: 0.02 };
const entrada = { valorCompra: 45, freteCompra: 5, freteEnvio: 0, origem: 'nacional', anuncio: 'classico', logistica: 'mercado_envios', lucro: 0.2 };
const ctx = { entrada, tipo, cenario, config };

test('calcular mantém o resultado da planilha', () => {
  const r = calcular(ctx);
  assert.equal(r.viavel, true);
  assert.equal(r.preco, 88.9);
  assert.equal(r.lucro, 18.23);
});

test('avaliarPreco no preço sugerido dá o mesmo lucro do cálculo', () => {
  const r = calcular(ctx);
  assert.equal(avaliarPreco(ctx, r.preco).lucro, r.lucro);
});

test('avaliarPreco com desconto reduz o lucro e soma o custo fixo abaixo de R$ 79 no Flex', () => {
  const flex = { ...ctx, entrada: { ...entrada, logistica: 'flex' } };
  const r = avaliarPreco(flex, 60);
  assert.equal(r.custoFixo, 6.75);
  assert.equal(r.lucro, Math.round((60 * 0.79 - 6.75 - 52) * 100) / 100);
});

test('statusMargem classifica pelo piso e pelo alvo', () => {
  const metas = { margemMinima: 0.1, margemAlvo: 0.2 };
  assert.equal(statusMargem(0.25, metas), 'saudavel');
  assert.equal(statusMargem(0.2, metas), 'saudavel');
  assert.equal(statusMargem(0.15, metas), 'atencao');
  assert.equal(statusMargem(0.05, metas), 'critico');
  assert.equal(statusMargem(NaN, metas), 'critico');
});

test('curvaAbc separa 80% / 15% / 5% do lucro mensal', () => {
  const r = curvaAbc([
    { id: 'a', lucroMensal: 700 }, { id: 'b', lucroMensal: 150 }, { id: 'c', lucroMensal: 100 },
    { id: 'd', lucroMensal: 50 }, { id: 'zero', lucroMensal: 0 },
  ]);
  assert.deepEqual(r.map((x) => [x.id, x.classe]), [['a', 'A'], ['b', 'A'], ['c', 'B'], ['d', 'C']]);
});
