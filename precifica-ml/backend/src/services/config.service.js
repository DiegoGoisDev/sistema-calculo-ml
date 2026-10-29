import db from '../config/database.js';
import AppError from '../utils/AppError.js';
import { fracao } from '../utils/validators.js';
import * as historico from './historico.service.js';

const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export async function obter() {
  const dados = await db.read();
  return dados.config;
}

export async function atualizar(dados) {
  return db.update(async (draft) => {
    const atual = draft.config;
    const novo = {
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
