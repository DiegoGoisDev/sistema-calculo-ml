import { randomUUID } from 'crypto';
import db from '../config/database.js';
import AppError from '../utils/AppError.js';
import { fracao, numero, texto } from '../utils/validators.js';
import * as historico from './historico.service.js';
import { impostoEfetivo } from './calculo.service.js';

export function normalizar(dados, atual = {}) {
  const v = { ...atual, ...dados };
  return {
    nome: texto(v.nome, 'nome'),
    tarifaClassico: fracao(v.tarifaClassico, 'tarifaClassico', { padrao: 0.12 }),
    tarifaPremium: fracao(v.tarifaPremium, 'tarifaPremium', { padrao: 0.17 }),
    // Vazio = usa o cenário de impostos ativo
    impostoVenda: v.impostoVenda == null || v.impostoVenda === '' ? null : fracao(v.impostoVenda, 'impostoVenda'),
    reducaoReforma: numero(v.reducaoReforma, 'reducaoReforma', { min: 0, max: 1, padrao: 0 }),
    impostoImportacao: numero(v.impostoImportacao, 'impostoImportacao', { min: 0, max: 5, padrao: 0.3 }),
    icmsImportacao: fracao(v.icmsImportacao, 'icmsImportacao', { padrao: 0.2 }),
    embalagem: numero(v.embalagem, 'embalagem', { min: 0, padrao: 0 }),
  };
}

function comImpostoEfetivo(tipo, dados) {
  const cenario = dados.cenarios.find((c) => c.id === dados.cenarioAtivoId);
  return { ...tipo, impostoEfetivo: impostoEfetivo(tipo, cenario) };
}

export async function listar() {
  const dados = await db.read();
  return dados.tipos.map((t) => comImpostoEfetivo(t, dados));
}

export async function buscar(id) {
  const dados = await db.read();
  const tipo = dados.tipos.find((t) => t.id === id);
  if (!tipo) throw new AppError('Tipo de produto não encontrado.', 404);
  return comImpostoEfetivo(tipo, dados);
}

function nomeUnico(draft, nome, ignorarId) {
  if (draft.tipos.some((t) => t.id !== ignorarId && t.nome.toLowerCase() === nome.toLowerCase())) {
    throw new AppError(`Já existe um tipo chamado "${nome}".`, 409);
  }
}

export async function criar(dados) {
  const tipo = { id: randomUUID(), ...normalizar(dados) };
  return db.update(async (draft) => {
    nomeUnico(draft, tipo.nome);
    draft.tipos.push(tipo);
    historico.registrar(draft, `Tipo "${tipo.nome}" criado.`);
    return tipo;
  });
}

export async function atualizar(id, dados) {
  return db.update(async (draft) => {
    const i = draft.tipos.findIndex((t) => t.id === id);
    if (i < 0) throw new AppError('Tipo de produto não encontrado.', 404);
    const tipo = { id, ...normalizar(dados, draft.tipos[i]) };
    nomeUnico(draft, tipo.nome, id);
    draft.tipos[i] = tipo;
    historico.registrar(draft, `Tipo "${tipo.nome}" atualizado.`);
    return tipo;
  });
}

export async function remover(id) {
  return db.update(async (draft) => {
    const tipo = draft.tipos.find((t) => t.id === id);
    if (!tipo) throw new AppError('Tipo de produto não encontrado.', 404);
    const emUso = draft.produtos.filter((p) => p.tipoId === id).length;
    if (emUso) throw new AppError(`Há ${emUso} produto(s) usando "${tipo.nome}". Altere ou remova esses produtos antes.`, 409);
    if (draft.tipos.length === 1) throw new AppError('Mantenha ao menos um tipo de produto.', 409);
    draft.tipos = draft.tipos.filter((t) => t.id !== id);
    historico.registrar(draft, `Tipo "${tipo.nome}" removido.`);
  });
}
