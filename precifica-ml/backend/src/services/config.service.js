import db from '../config/database.js';
import AppError from '../utils/AppError.js';
import { fracao } from '../utils/validators.js';
import * as historico from './historico.service.js';

const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

/** Metas de margem usadas no semáforo dos produtos (bancos antigos não têm o campo). */
export const METAS_PADRAO = { margemMinima: 0.1, margemAlvo: 0.2 };
export const metasDe = (config) => ({ ...METAS_PADRAO, ...(config?.metas || {}) });

export async function obter() {
  const dados = await db.read();
  return { ...dados.config, metas: metasDe(dados.config) };
}

export async function atualizarMetas(dados) {
  return db.update(async (draft) => {
    const atual = metasDe(draft.config);
    const metas = {
      margemMinima: dados.margemMinima !== undefined ? fracao(dados.margemMinima, 'margemMinima') : atual.margemMinima,
      margemAlvo: dados.margemAlvo !== undefined ? fracao(dados.margemAlvo, 'margemAlvo') : atual.margemAlvo,
    };
    if (metas.margemAlvo < metas.margemMinima) throw new AppError('A margem alvo precisa ser maior ou igual à margem mínima.');
    draft.config = { ...draft.config, metas };
    historico.registrar(draft, `Metas de margem: mínima ${pct(metas.margemMinima)}, alvo ${pct(metas.margemAlvo)}.`);
    return metas;
  });
}

export async function atualizar(dados) {
  return db.update(async (draft) => {
    const atual = draft.config;
    const novo = {
      ...atual, // mantém campos que esta rota não edita (ex.: metas)
      mercadoAds: dados.mercadoAds !== undefined ? fracao(dados.mercadoAds, 'mercadoAds') : atual.mercadoAds,
      devolucoes: dados.devolucoes !== undefined ? fracao(dados.devolucoes, 'devolucoes') : atual.devolucoes,
      opcoesLucro: atual.opcoesLucro,
    };
    if (dados.opcoesLucro !== undefined) {
      if (!Array.isArray(dados.opcoesLucro) || !dados.opcoesLucro.length) throw new AppError('Envie "opcoesLucro" como uma lista com ao menos um valor.');
      novo.opcoesLucro = [...new Set(dados.opcoesLucro.map((v, i) => fracao(v, `opcoesLucro[${i}]`)))].sort((a, b) => a - b);
    }
    draft.config = novo;
    historico.registrar(draft, `Configurações: Ads ${pct(novo.mercadoAds)}, devoluções ${pct(novo.devolucoes)}, lucros ${novo.opcoesLucro.map(pct).join(', ')}.`);
    return novo;
  });
}
