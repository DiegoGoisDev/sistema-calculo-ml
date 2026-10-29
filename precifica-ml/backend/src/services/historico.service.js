import { randomUUID } from 'crypto';
import db from '../config/database.js';

const LIMITE = 300;

/** Registra uma alteração dentro de uma transação já aberta (draft). */
export function registrar(draft, descricao) {
  draft.historico.unshift({ id: randomUUID(), data: new Date().toISOString(), descricao });
  draft.historico = draft.historico.slice(0, LIMITE);
}

export async function listar({ limite = 100 } = {}) {
  const dados = await db.read();
  return dados.historico.slice(0, limite);
}
