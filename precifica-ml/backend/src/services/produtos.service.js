import { randomUUID } from 'crypto';
import db from '../config/database.js';
import AppError from '../utils/AppError.js';
import * as historico from './historico.service.js';
import { normalizarEntrada, calcularProduto } from './precificacao.service.js';

/** Junta o produto salvo com o preço recalculado pelo cenário ativo. */
function comPrecoAtual(produto, dados) {
  const tipo = dados.tipos.find((t) => t.id === produto.tipoId);
  if (!tipo) return { ...produto, tipo: null, atual: null };
  const r = calcularProduto(produto, { dados });
  return {
    ...produto,
    tipo: tipo.nome,
    atual: r.viavel
      ? { preco: r.preco, lucro: r.lucro, margem: r.margem, custo: r.custo.total, variacao: Math.round((r.preco - produto.precoSalvo) * 100) / 100 }
      : { viavel: false, motivo: r.motivo },
  };
}

export async function listar({ busca } = {}) {
  const dados = await db.read();
  let lista = dados.produtos;
  if (busca) {
    const q = busca.toLowerCase();
    lista = lista.filter((p) => p.nome.toLowerCase().includes(q));
  }
  return lista.map((p) => comPrecoAtual(p, dados));
}

export async function buscar(id) {
  const dados = await db.read();
  const p = dados.produtos.find((x) => x.id === id);
  if (!p) throw new AppError('Produto não encontrado.', 404);
  return comPrecoAtual(p, dados);
}

function precoOuErro(entrada, dados) {
  const r = calcularProduto(entrada, { dados });
  if (!r.viavel) throw new AppError(r.motivo, 422);
  return r.preco;
}

export async function criar(body) {
  const entrada = normalizarEntrada(body);
  return db.update(async (draft) => {
    const agora = new Date().toISOString();
    const produto = {
      id: randomUUID(),
      ...entrada,
      nome: entrada.nome || draft.tipos.find((t) => t.id === entrada.tipoId)?.nome || 'Produto',
      precoSalvo: precoOuErro(entrada, draft),
      criadoEm: agora,
      atualizadoEm: agora,
    };
    draft.produtos.unshift(produto);
    historico.registrar(draft, `Produto "${produto.nome}" salvo por R$ ${produto.precoSalvo.toFixed(2).replace('.', ',')}.`);
    return comPrecoAtual(produto, draft);
  });
}

export async function atualizar(id, body) {
  return db.update(async (draft) => {
    const i = draft.produtos.findIndex((p) => p.id === id);
    if (i < 0) throw new AppError('Produto não encontrado.', 404);
    const atual = draft.produtos[i];
    const entrada = normalizarEntrada({ ...atual, ...body });
    const produto = {
      ...atual,
      ...entrada,
      nome: entrada.nome || atual.nome,
      precoSalvo: body.manterPrecoSalvo ? atual.precoSalvo : precoOuErro(entrada, draft),
      atualizadoEm: new Date().toISOString(),
    };
    draft.produtos[i] = produto;
    historico.registrar(draft, `Produto "${produto.nome}" atualizado.`);
    return comPrecoAtual(produto, draft);
  });
}

/** Grava o preço atual (cenário ativo) como novo preço salvo de todos os produtos. */
export async function atualizarPrecosSalvos() {
  return db.update(async (draft) => {
    let n = 0;
    draft.produtos.forEach((p) => {
      const r = calcularProduto(p, { dados: draft });
      if (r.viavel && r.preco !== p.precoSalvo) { p.precoSalvo = r.preco; p.atualizadoEm = new Date().toISOString(); n += 1; }
    });
    if (n) historico.registrar(draft, `${n} preço(s) salvo(s) atualizado(s) para o cenário ativo.`);
    return { atualizados: n };
  });
}

export async function remover(id) {
  return db.update(async (draft) => {
    const p = draft.produtos.find((x) => x.id === id);
    if (!p) throw new AppError('Produto não encontrado.', 404);
    draft.produtos = draft.produtos.filter((x) => x.id !== id);
    historico.registrar(draft, `Produto "${p.nome}" removido.`);
  });
}

export async function exportarCsv() {
  const linhas = [['Produto', 'Tipo', 'Origem', 'Anúncio', 'Logística', 'Valor de compra', 'Frete compra', 'Frete envio', 'Lucro %', 'Custo total', 'Preço salvo', 'Preço atual', 'Lucro R$']];
  const produtos = await listar();
  produtos.forEach((p) => {
    const a = p.atual && p.atual.preco !== undefined ? p.atual : null;
    linhas.push([
      p.nome, p.tipo || '', p.origem === 'internacional' ? 'Internacional' : 'Nacional',
      p.anuncio === 'premium' ? 'Premium' : 'Clássico', p.logistica === 'flex' ? 'Flex/próprio' : 'Mercado Envios',
      p.valorCompra, p.freteCompra, p.freteEnvio, +(p.lucro * 100).toFixed(1),
      a ? a.custo : '', p.precoSalvo, a ? a.preco : '', a ? a.lucro : '',
    ]);
  });
  const celula = (v) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${linhas.map((l) => l.map(celula).join(';')).join('\n')}`;
}
