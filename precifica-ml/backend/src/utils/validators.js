import AppError from './AppError.js';

export function numero(valor, campo, { min = -Infinity, max = Infinity, padrao } = {}) {
  if ((valor === undefined || valor === null || valor === '') && padrao !== undefined) return padrao;
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : Number(valor);
  if (!Number.isFinite(n)) throw new AppError(`O campo "${campo}" precisa ser um número.`);
  if (n < min || n > max) throw new AppError(`O campo "${campo}" precisa estar entre ${min} e ${max}.`);
  return n;
}

/** Percentual guardado como fração: 0.15 = 15%. */
export function fracao(valor, campo, opts = {}) {
  return numero(valor, campo, { min: 0, max: 0.99, ...opts });
}

export function texto(valor, campo, { obrigatorio = true, max = 120 } = {}) {
  const s = String(valor ?? '').trim();
  if (obrigatorio && !s) throw new AppError(`Informe o campo "${campo}".`);
  if (s.length > max) throw new AppError(`O campo "${campo}" aceita até ${max} caracteres.`);
  return s;
}

export function opcao(valor, campo, opcoes, padrao) {
  if ((valor === undefined || valor === null || valor === '') && padrao !== undefined) return padrao;
  if (!opcoes.includes(valor)) throw new AppError(`O campo "${campo}" aceita: ${opcoes.join(', ')}.`);
  return valor;
}

export function booleano(valor, padrao = false) {
  if (valor === undefined || valor === null) return padrao;
  return valor === true || valor === 'true';
}
