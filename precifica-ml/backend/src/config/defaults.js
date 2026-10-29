import { randomUUID } from 'crypto';

/**
 * Dados iniciais gravados na primeira execução (mesma base da planilha Precificacao_Mercado_Livre.xlsx).
 * Tarifas: médias por categoria do Mercado Livre conferidas em 13/10/2026 (Priceva).
 * Cenários de 2027 e 2033 são estimativas até a resolução do Senado.
 */
const CATEGORIAS = [
  ['Acessórios para Veículos', 12, 17], ['Agro', 11.5, 16.5], ['Alimentos e Bebidas', 14, 19],
  ['Antiguidades e Coleções', 11.5, 16.5], ['Arte, Papelaria e Armarinho', 11.5, 16.5], ['Bebês', 14, 19],
  ['Beleza e Cuidado Pessoal', 14, 19], ['Brinquedos e Hobbies', 11.5, 16.5], ['Calçados, Roupas e Bolsas', 14, 19],
  ['Câmeras e Acessórios', 11, 16], ['Casa, Móveis e Decoração', 11.5, 16.5], ['Celulares e Telefones', 11, 16],
  ['Construção', 11.5, 16.5], ['Eletrodomésticos', 11, 16], ['Eletrônicos, Áudio e Vídeo', 13, 18],
  ['Esportes e Fitness', 14, 19], ['Festas e Lembrancinhas', 11.5, 16.5], ['Games', 13, 18],
  ['Indústria e Comércio', 12, 17], ['Informática', 11, 16], ['Instrumentos Musicais', 11.5, 16.5],
  ['Joias e Relógios', 12.5, 17.5], ['Livros, Revistas e Comics', 12, 17], ['Música, Filmes e Seriados', 12, 17],
  ['Pet Shop', 12.5, 17.5], ['Saúde', 12, 17],
];

const tributo = (nome, aliquota, reforma = false, ativo = true) => ({ id: randomUUID(), nome, aliquota, reforma, ativo });

export function criarDadosIniciais() {
  const tipos = CATEGORIAS.map(([nome, classico, premium]) => ({
    id: randomUUID(),
    nome,
    tarifaClassico: classico / 100,
    tarifaPremium: premium / 100,
    impostoVenda: null,
    reducaoReforma: 0,
    impostoImportacao: 0.3,
    icmsImportacao: 0.2,
    embalagem: 2,
  }));

  const cenarios = [
    { id: randomUUID(), nome: 'Simples Nacional', observacao: 'Alíquota efetiva do DAS — ajuste à sua faixa',
      tributos: [tributo('DAS (alíquota efetiva)', 0.06)] },
    { id: randomUUID(), nome: 'Regime regular 2026', observacao: 'Lucro Presumido; CBS/IBS de teste são compensáveis',
      tributos: [tributo('PIS/Cofins', 0.0365), tributo('ICMS', 0.18), tributo('CBS (teste)', 0.009, true, false), tributo('IBS (teste)', 0.001, true, false)] },
    { id: randomUUID(), nome: 'Reforma 2027 (estimativa)', observacao: 'CBS cheia estimada; PIS/Cofins extintos',
      tributos: [tributo('CBS', 0.088, true), tributo('IBS (teste)', 0.001, true, false), tributo('ICMS', 0.18)] },
    { id: randomUUID(), nome: 'Reforma 2033 (estimativa)', observacao: 'Só CBS + IBS; total de referência ≈ 26,5%',
      tributos: [tributo('CBS', 0.088, true), tributo('IBS', 0.177, true)] },
  ];

  return {
    versao: 1,
    tipos,
    cenarios,
    cenarioAtivoId: cenarios[0].id,
    config: { mercadoAds: 0, devolucoes: 0.02, opcoesLucro: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6] },
    produtos: [],
    historico: [{ id: randomUUID(), data: new Date().toISOString(), descricao: 'Sistema criado com valores de referência (out/2026).' }],
  };
}
