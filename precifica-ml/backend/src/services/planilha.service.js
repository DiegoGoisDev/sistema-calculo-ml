import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import db from '../config/database.js';
import AppError from '../utils/AppError.js';
import { fracao } from '../utils/validators.js';
import * as historico from './historico.service.js';
import { normalizar } from './tipos.service.js';
import { impostoEfetivo } from './calculo.service.js';

/**
 * Importa a aba "Base de Produtos" da planilha Precificacao_Mercado_Livre.xlsx.
 * Layout esperado (o mesmo que as fórmulas da aba Calculadora usam):
 *   B6:H36  tipo | tarifa Clássico | tarifa Premium | imposto sobre a venda | imposto importação | ICMS importação | embalagem
 *   K6, K7  Mercado Ads e devoluções
 *   J11:J20 opções de lucro
 */
const ABA = 'Base de Produtos';
const LINHAS_TIPOS = [6, 36];
const LINHAS_LUCRO = [11, 20];

function valor(celula) {
  const v = celula.value;
  if (v && typeof v === 'object') {
    if ('result' in v) return v.result;
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
  }
  return v;
}

function intervalo([inicio, fim]) {
  return Array.from({ length: fim - inicio + 1 }, (_, i) => inicio + i);
}

/** Lê o arquivo e devolve { tipos, config } no formato do sistema (percentuais como fração). */
export async function lerPlanilha(arquivo) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);
  const ws = wb.getWorksheet(ABA);
  if (!ws) throw new AppError(`A planilha não tem a aba "${ABA}".`);
  const cel = (ref) => valor(ws.getCell(ref));

  const tipos = intervalo(LINHAS_TIPOS)
    .filter((l) => String(cel(`B${l}`) ?? '').trim())
    .map((l) => ({
      linha: l,
      nome: String(cel(`B${l}`)).trim(),
      tarifaClassico: cel(`C${l}`),
      tarifaPremium: cel(`D${l}`),
      impostoVenda: cel(`E${l}`),
      impostoImportacao: cel(`F${l}`),
      icmsImportacao: cel(`G${l}`),
      embalagem: cel(`H${l}`),
    }));
  if (!tipos.length) throw new AppError(`Nenhum tipo de produto em ${ABA}!B${LINHAS_TIPOS[0]}:B${LINHAS_TIPOS[1]}.`);

  const opcoesLucro = intervalo(LINHAS_LUCRO).map((l) => cel(`J${l}`)).filter((v) => typeof v === 'number');
  return {
    tipos,
    config: {
      mercadoAds: fracao(cel('K6') ?? 0, `${ABA}!K6`),
      devolucoes: fracao(cel('K7') ?? 0, `${ABA}!K7`),
      opcoesLucro: [...new Set(opcoesLucro.map((v, i) => fracao(v, `${ABA}!J${LINHAS_LUCRO[0] + i}`)))].sort((a, b) => a - b),
    },
  };
}

/**
 * Grava a base lida no banco: atualiza os tipos pelo nome (mantém id e redução da reforma),
 * cria os que faltam e substitui Ads, devoluções e opções de lucro.
 * O imposto sobre a venda só vira valor próprio do tipo quando difere do cenário ativo;
 * se for igual, o tipo continua seguindo o cenário (e as simulações da reforma).
 */
export async function importar({ tipos, config }) {
  return db.update(async (draft) => {
    const cenario = draft.cenarios.find((c) => c.id === draft.cenarioAtivoId);
    const resumo = { criados: [], atualizados: [], impostoProprio: [] };

    tipos.forEach((linha) => {
      const existente = draft.tipos.find((t) => t.nome.toLowerCase() === linha.nome.toLowerCase());
      let dados;
      try {
        dados = normalizar({ ...linha, linha: undefined }, existente);
      } catch (err) {
        throw new AppError(`${ABA}, linha ${linha.linha}: ${err.message}`);
      }
      const doCenario = impostoEfetivo({ ...dados, impostoVenda: null }, cenario);
      if (dados.impostoVenda != null && Math.abs(dados.impostoVenda - doCenario) < 1e-9) dados.impostoVenda = null;
      if (dados.impostoVenda != null) resumo.impostoProprio.push(dados.nome);

      if (existente) {
        Object.assign(existente, dados);
        resumo.atualizados.push(dados.nome);
      } else {
        draft.tipos.push({ id: randomUUID(), ...dados });
        resumo.criados.push(dados.nome);
      }
    });

    draft.config = config;
    historico.registrar(
      draft,
      `Base importada da planilha: ${resumo.atualizados.length} tipo(s) atualizado(s), ${resumo.criados.length} criado(s)`
        + `${resumo.impostoProprio.length ? `, ${resumo.impostoProprio.length} com imposto próprio` : ''}; Ads, devoluções e opções de lucro atualizados.`,
    );
    return resumo;
  });
}
