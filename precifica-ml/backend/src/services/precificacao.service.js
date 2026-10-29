import db from '../config/database.js';
import AppError from '../utils/AppError.js';
import { numero, fracao, opcao, texto } from '../utils/validators.js';
import { calcular } from './calculo.service.js';

const ORIGENS = ['nacional', 'internacional'];
const ANUNCIOS = ['classico', 'premium'];
const LOGISTICAS = ['mercado_envios', 'flex'];

/** Valida e normaliza os dados de um produto vindos do cliente. */
export function normalizarEntrada(dados) {
  return {
    nome: texto(dados.nome, 'nome', { obrigatorio: false }),
    tipoId: texto(dados.tipoId, 'tipoId'),
    origem: opcao(dados.origem, 'origem', ORIGENS, 'nacional'),
    anuncio: opcao(dados.anuncio, 'anuncio', ANUNCIOS, 'classico'),
    logistica: opcao(dados.logistica, 'logistica', LOGISTICAS, 'mercado_envios'),
    valorCompra: numero(dados.valorCompra, 'valorCompra', { min: 0 }),
    freteCompra: numero(dados.freteCompra, 'freteCompra', { min: 0, padrao: 0 }),
    freteEnvio: numero(dados.freteEnvio, 'freteEnvio', { min: 0, padrao: 0 }),
    lucro: fracao(dados.lucro, 'lucro', { padrao: 0.2 }),
  };
}

function contexto(dados, tipoId, cenarioId) {
  const tipo = dados.tipos.find((t) => t.id === tipoId);
  if (!tipo) throw new AppError('Tipo de produto não encontrado.', 404);
  const cenario = dados.cenarios.find((c) => c.id === (cenarioId || dados.cenarioAtivoId)) || dados.cenarios[0];
  return { tipo, cenario, config: dados.config };
}

/** Calcula com os dados informados (cenário ativo, a menos que outro seja informado). */
export function calcularProduto(entrada, { dados, cenarioId }) {
  return calcular({ entrada, ...contexto(dados, entrada.tipoId, cenarioId) });
}

/** Resultado completo da calculadora: preço escolhido + tabela comparativa por % de lucro. */
export async function simular(body) {
  const entrada = normalizarEntrada(body);
  const dados = await db.read();
  const ctx = contexto(dados, entrada.tipoId, body.cenarioId);
  const resultado = calcular({ entrada, ...ctx });

  const lucros = [...new Set([...dados.config.opcoesLucro, entrada.lucro])].sort((a, b) => a - b);
  const comparacao = lucros.map((lucro) => {
    const linha = (anuncio) => {
      const r = calcular({ entrada: { ...entrada, lucro, anuncio }, ...ctx });
      return r.viavel ? { preco: r.preco, lucro: r.lucro } : null;
    };
    return { lucro, selecionado: lucro === entrada.lucro, classico: linha('classico'), premium: linha('premium') };
  });

  return { entrada, tipo: ctx.tipo.nome, cenario: { id: ctx.cenario.id, nome: ctx.cenario.nome }, resultado, comparacao };
}
