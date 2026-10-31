import { API_URL, JSON_HEADERS, lerResposta } from '../api.js';
import { $, $$, fmt, num, esc, toast, debounce, montarLayout, urlPagina, seloStatus } from '../ui.js';

montarLayout('analise');

const params = new URLSearchParams(location.search);
const carregado = {}; // abas já carregadas nesta visita
let produtoId = params.get('produto');

const kpi = (rotulo, valor, cls = '') => `<div class="kpi ${cls}"><span class="lbl">${rotulo}</span><b>${valor}</b></div>`;
const sinal = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const brlSinal = (v) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt.brl(Math.abs(v))}`);
const vazio = (colunas, texto) => `<tr><td colspan="${colunas}" class="empty">${texto}</td></tr>`;

// Abas
function abrirAba(aba) {
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
  $$('[data-painel]').forEach((p) => { p.hidden = p.dataset.painel !== aba; });
  const url = new URL(location.href);
  url.searchParams.set('aba', aba);
  history.replaceState(null, '', url);
  if (!carregado[aba]) {
    carregado[aba] = true;
    ({ geral: carregarGeral, produto: carregarProdutos, cenarios: carregarCenarios, sensibilidade: simular })[aba]();
  }
}
$('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-aba]');
  if (b) abrirAba(b.dataset.aba);
});

// Visão geral
function linhaRanking(p) {
  return `<tr><td><a href="?aba=produto&produto=${p.id}">${esc(p.nome)}</a><div class="hint">${esc(p.tipo)}</div></td>
    <td class="n">${fmt.brl(p.preco)}</td><td class="n">${fmt.brl(p.lucro)}</td><td class="n">${seloStatus(p.status, true)} ${fmt.pct(p.margem)}</td></tr>`;
}

async function carregarGeral() {
  try {
    const r = await lerResposta(fetch(`${API_URL}/analise/resumo`));
    const t = r.totais;
    $('#cenarioGeral').textContent = `Cenário: ${r.cenario.nome}`;
    $('#kpis').innerHTML = [
      kpi('Produtos', t.produtos),
      kpi('Margem média', fmt.pct(t.margemMedia)),
      kpi('Lucro médio por venda', fmt.brl(t.lucroMedio)),
      kpi('Saudáveis', r.status.saudavel, 'ok'),
      kpi('Atenção', r.status.atencao, 'warn'),
      kpi('Críticos ou inviáveis', r.status.critico, 'bad'),
    ].join('');

    const maior = Math.max(1, ...r.distribuicao.map((d) => d.quantidade));
    $('#distribuicao').innerHTML = r.distribuicao.map((d, i) => `
      <div class="hbar"><span>${d.rotulo}</span><span class="track"><i class="${i === 0 ? 'bad' : ''}" style="width:${(d.quantidade / maior) * 100}%"></i></span><span>${d.quantidade}</span></div>`).join('');

    $('#margemMinima').value = fmt.input(r.metas.margemMinima * 100, 1);
    $('#margemAlvo').value = fmt.input(r.metas.margemAlvo * 100, 1);

    const semProdutos = vazio(4, `Nenhum produto salvo. Calcule um preço na <a href="${urlPagina('index.html')}">Calculadora</a>.`);
    $('#melhores').innerHTML = r.melhores.length ? r.melhores.map(linhaRanking).join('') : semProdutos;
    $('#piores').innerHTML = r.piores.length ? r.piores.map(linhaRanking).join('') : semProdutos;

    const pj = r.projecao;
    $('#projecao').innerHTML = pj.produtos
      ? [
        kpi('Unidades/mês', pj.unidades.toLocaleString('pt-BR')),
        kpi('Faturamento', fmt.brl(pj.faturamento)),
        kpi('Custo dos produtos', fmt.brl(pj.custo)),
        kpi('Tarifas, impostos e outros', fmt.brl(pj.tarifasImpostos)),
        kpi('Lucro do mês', fmt.brl(pj.lucro), 'ok'),
        kpi('Margem', fmt.pct(pj.margem)),
      ].join('')
      : '<p class="hint" style="margin:0">Informe as vendas por mês nos produtos (Calculadora → Vendas por mês) para ver a projeção.</p>';

    $('#abc').innerHTML = r.abc.length
      ? r.abc.map((x) => `<tr><td><span class="badge ${x.classe === 'A' ? 'ok' : x.classe === 'B' ? 'warn' : ''}">${x.classe}</span></td>
          <td><a href="?aba=produto&produto=${x.id}">${esc(x.nome)}</a></td><td class="n">${x.volumeMensal}</td>
          <td class="n">${fmt.brl(x.lucro)}</td><td class="n">${fmt.brl(x.lucroMensal)}</td>
          <td class="n">${fmt.pct(x.participacao)}</td><td class="n">${fmt.pct(x.acumulado)}</td></tr>`).join('')
      : vazio(7, 'Sem vendas por mês informadas.');
  } catch (e) { toast(e.message, true); }
}

$('#formMetas').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await lerResposta(fetch(`${API_URL}/config/metas`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ margemMinima: num($('#margemMinima').value) / 100, margemAlvo: num($('#margemAlvo').value) / 100 }),
    }));
    toast('Metas salvas');
    Object.keys(carregado).forEach((k) => { carregado[k] = false; });
    carregado.geral = true;
    carregarGeral();
  } catch (err) { toast(err.message, true); }
});

// Por produto
async function carregarProdutos() {
  try {
    const lista = await lerResposta(fetch(`${API_URL}/produtos`));
    $('#produtoVazio').hidden = lista.length > 0;
    $('#produtoDetalhe').hidden = !lista.length;
    $('#btnEditarProduto').hidden = !lista.length;
    if (!lista.length) return;
    $('#produtoSel').innerHTML = lista.map((p) => `<option value="${p.id}">${esc(p.nome)}${p.tipo ? ` · ${esc(p.tipo)}` : ''}</option>`).join('');
    if (!lista.some((p) => p.id === produtoId)) produtoId = lista[0].id;
    $('#produtoSel').value = produtoId;
    await carregarProduto();
  } catch (e) { toast(e.message, true); }
}

async function carregarProduto(preco) {
  const consulta = preco ? `?preco=${encodeURIComponent(preco)}` : '';
  const r = await lerResposta(fetch(`${API_URL}/analise/produtos/${produtoId}${consulta}`));
  $('#btnEditarProduto').href = urlPagina(`index.html?produto=${produtoId}`);
  if (preco) return r.simulacao;

  const res = r.resultado;
  $('#produtoKpis').innerHTML = res.viavel
    ? [
      kpi('Preço atual', fmt.brl(res.preco)),
      kpi('Lucro por venda', fmt.brl(res.lucro)),
      kpi('Margem', `${fmt.pct(res.margem)}`, { saudavel: 'ok', atencao: 'warn', critico: 'bad' }[r.produto.status]),
      kpi('Custo total', fmt.brl(res.custo.total)),
      kpi('Status', seloStatus(r.produto.status)),
    ].join('')
    : kpi('Inviável', esc(res.motivo), 'bad');

  if (res.viavel) {
    const partes = [
      ['Custo do produto', res.custo.total, '--seg-custo'],
      ['Mercado Livre', res.valores.mercadoLivre, '--seg-ml'],
      [`Impostos (${fmt.pct(res.percentuais.impostos)})`, res.valores.impostos, '--seg-imp'],
      ['Ads + devoluções', res.valores.outros, '--seg-extra'],
      ['Lucro', res.lucro, '--seg-lucro'],
    ];
    $('#produtoBarra').innerHTML = partes.map(([n, v, c]) => `<i style="width:${Math.max(0, (v / res.preco) * 100)}%;background:var(${c})" title="${n}"></i>`).join('');
    $('#produtoLegenda').innerHTML = partes.map(([n, v, c]) => `<div><em style="background:var(${c})"></em>${n}<span>${fmt.brl(v)} · ${fmt.pct(v / res.preco, 0)}</span></div>`).join('');
  } else {
    $('#produtoBarra').innerHTML = '';
    $('#produtoLegenda').innerHTML = '';
  }

  $('#precosLimite').innerHTML = [
    kpi('Equilíbrio (lucro zero)', fmt.brl(r.precos.equilibrio), 'bad'),
    kpi(`Margem mínima (${fmt.pct(r.metas.margemMinima, 0)})`, fmt.brl(r.precos.minimo), 'warn'),
    kpi(`Margem alvo (${fmt.pct(r.metas.margemAlvo, 0)})`, fmt.brl(r.precos.alvo), 'ok'),
  ].join('');

  $('#anuncios').innerHTML = r.anuncios.map((a) => `<tr class="${a.anuncio === r.produto.anuncio ? 'sel' : ''}">
    <td>${a.anuncio === 'premium' ? 'Premium' : 'Clássico'}${a.anuncio === r.produto.anuncio ? ' (atual)' : ''}</td>
    <td class="n">${fmt.pct(a.tarifa)}</td><td class="n">${a.viavel ? fmt.brl(a.preco) : '—'}</td>
    <td class="n">${a.viavel ? fmt.brl(a.lucro) : '—'}</td><td class="n">${a.viavel ? fmt.pct(a.margem) : esc(a.motivo)}</td></tr>`).join('');

  $('#descontos').innerHTML = r.descontos.length
    ? r.descontos.map((d) => `<tr><td>${fmt.pct(d.desconto, 0)}</td><td class="n">${fmt.brl(d.preco)}</td>
        <td class="n ${sinal(d.lucro)}">${fmt.brl(d.lucro)}</td><td class="n">${fmt.pct(d.margem)}</td><td class="n">${seloStatus(d.status)}</td></tr>`).join('')
    : vazio(5, 'Produto inviável com o lucro escolhido.');
  $('#precoTeste').value = '';
  $('#precoTesteRes').textContent = '';

  $('#produtoCenarios').innerHTML = r.cenarios.map((c) => `<tr class="${c.ativo ? 'sel' : ''}">
    <td>${esc(c.nome)}${c.ativo ? ' <span class="badge active">ativo</span>' : ''}</td><td class="n">${fmt.pct(c.impostos, 2)}</td>
    <td class="n">${c.viavel ? fmt.brl(c.preco) : '—'}</td><td class="n ${sinal(-c.variacao)}">${c.ativo ? '' : brlSinal(c.variacao)}</td>
    <td class="n">${c.viavel ? fmt.brl(c.lucro) : '—'}</td><td class="n ${sinal(c.lucroMantendoPreco)}">${c.lucroMantendoPreco == null ? '—' : fmt.brl(c.lucroMantendoPreco)}</td></tr>`).join('');
  return null;
}

$('#produtoSel').addEventListener('change', async () => {
  produtoId = $('#produtoSel').value;
  const url = new URL(location.href);
  url.searchParams.set('produto', produtoId);
  history.replaceState(null, '', url);
  try { await carregarProduto(); } catch (e) { toast(e.message, true); }
});

$('#precoTeste').addEventListener('input', debounce(async () => {
  const preco = num($('#precoTeste').value);
  if (!preco) { $('#precoTesteRes').textContent = ''; return; }
  try {
    const s = await carregarProduto(preco);
    $('#precoTesteRes').innerHTML = `Lucro <b class="${sinal(s.lucro)}">${fmt.brl(s.lucro)}</b> · margem ${fmt.pct(s.margem)} ${seloStatus(s.status)}`;
  } catch (e) { toast(e.message, true); }
}, 300));

// Cenários
async function carregarCenarios() {
  try {
    const r = await lerResposta(fetch(`${API_URL}/analise/cenarios`));
    $('#cenariosResumo').innerHTML = r.cenarios.map((c) => `
      <div class="scen" aria-pressed="${c.ativo}" style="cursor:default">
        <div class="row between" style="width:100%"><b>${esc(c.nome)}</b>${c.ativo ? '<span class="badge active">ativo</span>' : ''}</div>
        <span class="hint">Preço médio <b>${fmt.brl(c.precoMedio)}</b>${c.ativo ? '' : ` · variação média ${brlSinal(c.variacaoMedia)}`}</span>
        <span class="hint">${c.inviaveis} inviável(is)${c.ativo ? '' : ` · ${c.prejuizoSemReajuste} no prejuízo sem reajustar`}</span>
      </div>`).join('');

    $('#matrizHead').innerHTML = `<tr><th>Produto</th>${r.cenarios.map((c) => `<th class="n">${esc(c.nome)}</th>`).join('')}</tr>`;
    $('#matriz').innerHTML = r.produtos.length
      ? r.produtos.map((p) => `<tr><td><a href="?aba=produto&produto=${p.id}">${esc(p.nome)}</a><div class="hint">${esc(p.tipo)}</div></td>
          ${p.valores.map((v, i) => {
            if (!v.viavel) return '<td class="n"><span class="badge up">inviável</span></td>';
            const variacao = r.cenarios[i].ativo || v.variacao == null ? '' : `<div class="hint ${sinal(-v.variacao)}">${brlSinal(v.variacao)}</div>`;
            return `<td class="n">${seloStatus(v.status, true)} ${fmt.brl(v.preco)}${variacao}</td>`;
          }).join('')}</tr>`).join('')
      : vazio(r.cenarios.length + 1, 'Nenhum produto salvo.');
  } catch (e) { toast(e.message, true); }
}

// E se...
async function simular() {
  try {
    const corpo = {
      custo: num($('#sCusto').value) / 100,
      cambio: num($('#sCambio').value) / 100,
      frete: num($('#sFrete').value) / 100,
      tarifa: num($('#sTarifa').value) / 100,
      impostos: num($('#sImpostos').value) / 100,
    };
    const r = await lerResposta(fetch(`${API_URL}/analise/sensibilidade`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(corpo) }));
    const t = r.totais;
    $('#sensKpis').innerHTML = [
      kpi('Produtos analisados', t.produtos),
      kpi('Ficam no prejuízo', t.prejuizo, t.prejuizo ? 'bad' : ''),
      kpi('Abaixo da margem mínima', t.abaixoMinima, t.abaixoMinima ? 'warn' : ''),
      kpi('Lucro médio por venda', `${fmt.brl(t.lucroMedioAntes)} → ${fmt.brl(t.lucroMedioDepois)}`),
      ...(t.lucroMensalAntes ? [kpi('Lucro do mês', `${fmt.brl(t.lucroMensalAntes)} → ${fmt.brl(t.lucroMensalDepois)}`)] : []),
    ].join('');
    $('#sensLista').innerHTML = r.produtos.length
      ? r.produtos.map((p) => `<tr><td><a href="?aba=produto&produto=${p.id}">${esc(p.nome)}</a></td>
          <td class="n">${fmt.brl(p.preco)}</td><td class="n">${fmt.brl(p.lucroAntes)}</td>
          <td class="n ${sinal(p.lucroDepois)}">${fmt.brl(p.lucroDepois)}</td><td class="n">${fmt.pct(p.margemDepois)}</td>
          <td class="n">${seloStatus(p.status)}</td>
          <td class="n">${p.precoReajustado ? `${fmt.brl(p.precoReajustado)} <span class="hint">(${brlSinal(p.reajuste)})</span>` : '—'}</td></tr>`).join('')
      : vazio(7, 'Nenhum produto viável salvo.');
  } catch (e) { toast(e.message, true); }
}
$('#formSens').addEventListener('submit', (e) => { e.preventDefault(); simular(); });

abrirAba(params.get('aba') || (produtoId ? 'produto' : 'geral'));
