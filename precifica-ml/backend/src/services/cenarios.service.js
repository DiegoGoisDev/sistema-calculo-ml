import { randomUUID } from 'crypto';
import db from '../config/database.js';
import AppError from '../utils/AppError.js';
import { fracao, texto, booleano } from '../utils/validators.js';
import * as historico from './historico.service.js';

const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}%`;
const totalAtivo = (c) => c.tributos.filter((t) => t.ativo).reduce((s, t) => s + t.aliquota, 0);

function normalizarTributos(lista) {
  if (!Array.isArray(lista)) throw new AppError('Envie "tributos" como uma lista.');
  return lista.map((t, i) => ({
    id: t.id || randomUUID(),
    nome: texto(t.nome, `tributos[${i}].nome`, { max: 60 }),
    aliquota: fracao(t.aliquota, `tributos[${i}].aliquota`),
    reforma: booleano(t.reforma),
    ativo: booleano(t.ativo, true),
  }));
}

function resumo(c, ativoId) {
  return { ...c, ativo: c.id === ativoId, total: totalAtivo(c) };
}

export async function listar() {
  const d = await db.read();
  return d.cenarios.map((c) => resumo(c, d.cenarioAtivoId));
}

export async function buscar(id) {
  const d = await db.read();
  const c = d.cenarios.find((x) => x.id === id);
  if (!c) throw new AppError('Cenário não encontrado.', 404);
  return resumo(c, d.cenarioAtivoId);
}

export async function ativo() {
  const d = await db.read();
  return resumo(d.cenarios.find((c) => c.id === d.cenarioAtivoId) || d.cenarios[0], d.cenarioAtivoId);
}

export async function criar(dados) {
  const cenario = {
    id: randomUUID(),
    nome: texto(dados.nome, 'nome', { max: 60 }),
    observacao: texto(dados.observacao, 'observacao', { obrigatorio: false, max: 160 }),
    tributos: normalizarTributos(dados.tributos || []),
  };
  return db.update(async (draft) => {
    draft.cenarios.push(cenario);
    historico.registrar(draft, `Cenário "${cenario.nome}" criado (${pct(totalAtivo(cenario))}).`);
    return resumo(cenario, draft.cenarioAtivoId);
  });
}

function descreverMudancas(antes, depois) {
  const mudancas = [];
  depois.tributos.forEach((t) => {
    const a = antes.tributos.find((x) => x.id === t.id);
    if (!a) mudancas.push(`+ ${t.nome} ${pct(t.aliquota)}`);
    else if (a.aliquota !== t.aliquota) mudancas.push(`${t.nome} ${pct(a.aliquota)} → ${pct(t.aliquota)}`);
    else if (a.ativo !== t.ativo) mudancas.push(`${t.nome} ${t.ativo ? 'ligado' : 'desligado'}`);
  });
  antes.tributos.filter((a) => !depois.tributos.some((t) => t.id === a.id)).forEach((a) => mudancas.push(`− ${a.nome}`));
  return mudancas.join('; ');
}

export async function atualizar(id, dados) {
  return db.update(async (draft) => {
    const i = draft.cenarios.findIndex((c) => c.id === id);
    if (i < 0) throw new AppError('Cenário não encontrado.', 404);
    const antes = draft.cenarios[i];
    const depois = {
      id,
      nome: dados.nome !== undefined ? texto(dados.nome, 'nome', { max: 60 }) : antes.nome,
      observacao: dados.observacao !== undefined ? texto(dados.observacao, 'observacao', { obrigatorio: false, max: 160 }) : antes.observacao,
      tributos: dados.tributos !== undefined ? normalizarTributos(dados.tributos) : antes.tributos,
    };
    draft.cenarios[i] = depois;
    const mudancas = descreverMudancas(antes, depois);
    historico.registrar(draft, `Cenário "${depois.nome}" atualizado${mudancas ? `: ${mudancas}` : ''}.`);
    return resumo(depois, draft.cenarioAtivoId);
  });
}

export async function ativar(id) {
  return db.update(async (draft) => {
    const c = draft.cenarios.find((x) => x.id === id);
    if (!c) throw new AppError('Cenário não encontrado.', 404);
    draft.cenarioAtivoId = id;
    historico.registrar(draft, `Cenário "${c.nome}" ativado (${pct(totalAtivo(c))}). Preços recalculados.`);
    return resumo(c, id);
  });
}

export async function duplicar(id) {
  return db.update(async (draft) => {
    const c = draft.cenarios.find((x) => x.id === id);
    if (!c) throw new AppError('Cenário não encontrado.', 404);
    const copia = { ...structuredClone(c), id: randomUUID(), nome: `${c.nome} (cópia)`.slice(0, 60) };
    copia.tributos.forEach((t) => { t.id = randomUUID(); });
    draft.cenarios.push(copia);
    historico.registrar(draft, `Cenário "${c.nome}" duplicado.`);
    return resumo(copia, draft.cenarioAtivoId);
  });
}

export async function remover(id) {
  return db.update(async (draft) => {
    const c = draft.cenarios.find((x) => x.id === id);
    if (!c) throw new AppError('Cenário não encontrado.', 404);
    if (draft.cenarioAtivoId === id) throw new AppError('Ative outro cenário antes de excluir este.', 409);
    draft.cenarios = draft.cenarios.filter((x) => x.id !== id);
    historico.registrar(draft, `Cenário "${c.nome}" excluído.`);
  });
}
