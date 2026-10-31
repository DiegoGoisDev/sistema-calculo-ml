import { API_URL, JSON_HEADERS, lerResposta } from '../api.js';
import { $, $$, fmt, num, esc, toast, debounce, montarLayout, setSeg, urlPagina } from '../ui.js';

montarLayout('calculadora');

const estado = {
  origem: 'nacional',
  anuncio: 'classico',
  logistica: 'mercado_envios',
  lucro: 0.2,
  opcoesLucro: [],
  editandoId: new URLSearchParams(location.search).get('produto'),
  ultimo: null,
};

function entrada() {
  return {
    nome: $('#nome').value,
    tipoId: $('#tipoId').value,
    origem: estado.origem,
    anuncio: estado.anuncio,
    logistica: estado.logistica,
    valorCompra: num($('#valorCompra').value),
    freteCompra: num($('#freteCompra').value),
    freteEnvio: num($('#freteEnvio').value),
    lucro: estado.lucro,
    volumeMensal: Math.round(num($('#volumeMensal').value)),
  };
}

function renderChips() {
  $('#lucros').innerHTML = estado.opcoesLucro
    .map((l) => `<button type="button" class="chip" data-l="${l}" aria-pressed="${Math.abs(l - estado.lucro) < 1e-9}">${fmt.input(l * 100, 1)}%</button>`)
    .join('');
}

function renderResultado({ resultado: r, comparacao, cenario }) {
  $('#cenarioInfo').textContent = `Cenário: ${cenario.nome}`;
  const alertas = [];

  if (!r.viavel) {
    $('#preco').innerHTML = '<small>R$</small>—';
    ['#lucroR', '#margem'].forEach((s) => { $(s).textContent = '—'; });
    $('#custo').textContent = fmt.brl(r.custo.total);
    $('#barra').innerHTML = '';
    $('#legenda').innerHTML = '';
    alertas.push(['bad', r.motivo]);
  } else {
    $('#preco').innerHTML = `<small>R$</small>${r.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    $('#lucroR').textContent = fmt.brl(r.lucro);
    $('#margem').textContent = fmt.pct(r.margem);
    $('#custo').textContent = fmt.brl(r.custo.total);

    const partes = [
      ['Custo do produto', r.custo.total, '--seg-custo'],
      [`Mercado Livre${r.valores.custoFixo ? ' (+ custo fixo)' : ''}`, r.valores.mercadoLivre, '--seg-ml'],
      [`Impostos (${fmt.pct(r.percentuais.impostos)})`, r.valores.impostos, '--seg-imp'],
      ['Ads + devoluções', r.valores.outros, '--seg-extra'],
      ['Seu lucro', r.lucro, '--seg-lucro'],
    ];
    $('#barra').innerHTML = partes.map(([n, v, c]) => `<i style="width:${Math.max(0, (v / r.preco) * 100)}%;background:var(${c})" title="${n}"></i>`).join('');
    $('#legenda').innerHTML = partes.map(([n, v, c]) => `<div><em style="background:var(${c})"></em>${n}<span>${fmt.brl(v)}</span></div>`).join('');

    if (r.custo.impostosImportacao) {
      alertas.push(['', `Internacional: ${fmt.brl(r.custo.produto)} de compra + frete viram ${fmt.brl(r.custo.produto + r.custo.impostosImportacao)} com imposto de importação e ICMS.`]);
    }
    r.alertas.forEach((a) => alertas.push(['', a]));
  }
  $('#alertas').innerHTML = alertas.map(([cls, t]) => `<div class="alert ${cls}">${esc(t)}</div>`).join('');

  const celula = (x) => (x ? [fmt.brl(x.preco), fmt.brl(x.lucro)] : ['—', '—']);
  $('#comparacao').innerHTML = comparacao.map((l) => {
    const [cp, cl] = celula(l.classico);
    const [pp, pl] = celula(l.premium);
    return `<tr class="${l.selecionado ? 'sel' : ''}"><td>${fmt.input(l.lucro * 100, 1)}%</td><td class="n">${cp}</td><td class="n">${cl}</td><td class="n">${pp}</td><td class="n">${pl}</td></tr>`;
  }).join('');
}

const recalcular = debounce(async () => {
  const dados = entrada();
  if (!dados.tipoId) return;
  try {
    const resposta = await lerResposta(fetch(`${API_URL}/precificacao/simular`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(dados) }));
    estado.ultimo = resposta;
    renderResultado(resposta);
  } catch (e) {
    toast(e.message, true);
  }
}, 250);

async function carregar() {
  try {
    const [tipos, config] = await Promise.all([
      lerResposta(fetch(`${API_URL}/tipos`)),
      lerResposta(fetch(`${API_URL}/config`)),
    ]);
    $('#tipoId').innerHTML = tipos.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('');
    const padrao = tipos.find((t) => t.nome.startsWith('Eletrônicos'));
    if (padrao) $('#tipoId').value = padrao.id;
    estado.opcoesLucro = config.opcoesLucro;

    if (estado.editandoId) {
      const p = await lerResposta(fetch(`${API_URL}/produtos/${estado.editandoId}`));
      $('#nome').value = p.nome;
      $('#tipoId').value = p.tipoId;
      $('#valorCompra').value = fmt.input(p.valorCompra);
      $('#freteCompra').value = fmt.input(p.freteCompra);
      $('#freteEnvio').value = p.freteEnvio ? fmt.input(p.freteEnvio) : '';
      $('#volumeMensal').value = p.volumeMensal ? String(p.volumeMensal) : '';
      Object.assign(estado, { origem: p.origem, anuncio: p.anuncio, logistica: p.logistica, lucro: p.lucro });
      $('#lucro').value = fmt.input(p.lucro * 100, 1);
      $('#btnSalvar').textContent = 'Salvar alterações';
      $('#modoEdicao').innerHTML = `Editando <b>${esc(p.nome)}</b> · <a href="${urlPagina('index.html')}">novo cálculo</a>`;
    }
    setSeg($('#origem'), estado.origem);
    setSeg($('#anuncio'), estado.anuncio);
    setSeg($('#logistica'), estado.logistica);
    renderChips();
    recalcular();
  } catch (e) {
    toast(e.message, true);
  }
}

// Eventos
$('#formCalc').addEventListener('submit', (e) => e.preventDefault());
['#nome', '#tipoId', '#valorCompra', '#freteCompra', '#freteEnvio'].forEach((s) => $(s).addEventListener('input', recalcular));

$('#lucro').addEventListener('input', () => {
  estado.lucro = num($('#lucro').value) / 100;
  renderChips();
  recalcular();
});

$('#lucros').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  estado.lucro = Number(chip.dataset.l);
  $('#lucro').value = fmt.input(estado.lucro * 100, 1);
  renderChips();
  recalcular();
});

$$('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  estado[seg.id] = b.dataset.v;
  setSeg(seg, b.dataset.v);
  recalcular();
}));

$('#btnSalvar').addEventListener('click', async () => {
  const btn = $('#btnSalvar');
  btn.disabled = true;
  try {
    if (estado.editandoId) {
      await lerResposta(fetch(`${API_URL}/produtos/${estado.editandoId}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(entrada()) }));
      toast('Alterações salvas');
    } else {
      await lerResposta(fetch(`${API_URL}/produtos`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(entrada()) }));
      toast('Produto salvo em Meus produtos');
    }
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
  }
});

carregar();
