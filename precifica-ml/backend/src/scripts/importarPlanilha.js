/**
 * Importa a base da planilha para o banco.
 * Uso: npm run importar-planilha -- "C:\caminho\Precificacao_Mercado_Livre.xlsx"
 */
import path from 'path';
import env from '../config/env.js';
import db from '../config/database.js';
import { lerPlanilha, importar } from '../services/planilha.service.js';

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo) throw new Error('Informe o caminho da planilha: npm run importar-planilha -- "arquivo.xlsx"');

  await db.init();
  const base = await lerPlanilha(path.resolve(arquivo));
  const r = await importar(base);

  console.log(`Planilha: ${path.resolve(arquivo)}`);
  console.log(`Banco:    ${env.dataFile}`);
  console.log(`Tipos atualizados: ${r.atualizados.length} | criados: ${r.criados.length}${r.criados.length ? ` (${r.criados.join(', ')})` : ''}`);
  console.log(r.impostoProprio.length
    ? `Com imposto sobre a venda próprio: ${r.impostoProprio.join(', ')}`
    : 'Imposto sobre a venda igual ao cenário ativo em todos os tipos: seguem o cenário.');
  console.log(`Ads ${base.config.mercadoAds * 100}% | devoluções ${base.config.devolucoes * 100}% | lucros ${base.config.opcoesLucro.map((v) => `${+(v * 100).toFixed(2)}%`).join(', ')}`);
  console.log('Se o servidor estiver rodando, reinicie-o para carregar os dados importados.');
}

main().catch((err) => {
  console.error('Falha ao importar:', err.message);
  process.exit(1);
});
