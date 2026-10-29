import { API_URL, JSON_HEADERS, lerResposta } from '../api.js';
import { $, $$, fmt, num, esc, toast, confirmarClique, montarLayout, atualizarCenarioLateral } from '../ui.js';

montarLayout('impostos');

let cenarios = [];
let selecionadoId = null;
let rascunho = []; // tributos do cenário em edição (ainda não salvos)
const novoId = () => `novo-${Math.random().toString(36).slice(2, 8)}`;

const selecionado = () => cenarios.find((c) => c.id === selecionadoId);

function renderLista() {
  $('#cenarios').innerHTML = cenarios.map((c) => `
    <button type="button" class="scen" data-id="${c.id}" aria-pressed="${c.id === selecionadoId}">
      <div class="row between" style="width:100%"><b>${esc(c.nome)}</b>${c.ativo ? '<span class="badge active">ativo</span>' : ''}</div>
      <span class="tot">${fmt.pct(c.total, 2)}</span>
      <span class="hint">${esc(c.observacao || '')}</span>
    </button>`).join('');
}

function renderEditor() {
  const c = selecionado();
  if (!c) return;
  $('#tituloEditor').textContent = c.ativo ? 'Cenário ativo' : 'Editar cenário';
  $('#btnAtivar').hidden = c.ativo;
  $('#cNome').value = c.nome;
  $('#cObs').value = c.observacao || '';
  rascunho = structuredClone(c.tributos);
  renderTributos();
}

function renderTributos() {
  $('#tributos').innerHTML = rascunho.length ? rascunho.map((t) => `
    <div class="comp-row" data-id="${t.id}">
      <label class="switch" title="Incluir no cálculo"><input type="checkbox" data-k="ativo" ${t.ativo ? 'checked' : ''} aria-label="Incluir ${esc(t.nome)}"></label>
      <input data-k="nome" value="${esc(t.nome)}" aria-label="Nome do tributo">
      <div class="pct"><input data-k="aliquota" inputmode="decimal" value="${fmt.input(t.aliquota * 100, 3)}" aria-label="Alíquota"><span>%</span></div>
      <label class="switch reforma"><input type="checkbox" data-k="reforma" ${t.reforma ? 'checked' : ''}>CBS/IBS</label>
      <button class="btn ghost sm" data-remover type="button" aria-label="Remover tributo">✕</button>
    </div>`).join('') : '<p class="hint">Nenhum tributo. Adicione um.</p>';
}

async function carregarCenarios(manterId) {
  cenarios = await lerResposta(fetch(`${API_URL}/cenarios`));
  selecionadoId = manterId && cenarios.some((c) => c.id === manterId) ? manterId : (cenarios.find((c) => c.ativo) || cenarios[0]).id;
  renderLista();
  renderEditor();
}

async function carregarHistorico() {
  const h = await lerResposta(fetch(`${API_URL}/historico?limite=100`));
  $('#historico').innerHTML = h.map((x) => `<div><time>${fmt.data(x.data)}</time><span>${esc(x.descricao)}</span></div>`).join('');
}

async function carregarConfig() {
  const c = await lerResposta(fetch(`${API_URL}/config`));
  $('#ads').value = fmt.input(c.mercadoAds * 100);
  $('#dev').value = fmt.input(c.devolucoes * 100);
  $('#lucros').value = c.opcoesLucro.map((l) => fmt.input(l * 100, 1)).join('; ');
}

async function atualizarTudo(id) {
  await Promise.all([carregarCenarios(id), carregarHistorico()]);
  atualizarCenarioLateral();
}

// Lista de cenários
$('#cenarios').addEventListener('click', (e) => {
  const b = e.target.closest('.scen');
  if (!b) return;
  selecionadoId = b.dataset.id;
  renderLista();
  renderEditor();
});

// Edição de tributos (rascunho local até salvar)
$('#tributos').addEventListener('input', (e) => {
  const row = e.target.closest('.comp-row');
  if (!row) return;
  const t = rascunho.find((x) => x.id === row.dataset.id);
  const k = e.target.dataset.k;
  if (k === 'nome') t.nome = e.target.value;
  else if (k === 'aliquota') t.aliquota = num(e.target.value) / 100;
  else t[k] = e.target.checked;
});
$('#tributos').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remover]');
  if (!btn) return;
  rascunho = rascunho.filter((t) => t.id !== btn.closest('.comp-row').dataset.id);
  renderTributos();
});
$('#btnNovoTributo').addEventListener('click', () => {
  rascunho.push({ id: novoId(), nome: 'Novo tributo', aliquota: 0, reforma: false, ativo: true });
  renderTributos();
  const nomes = $$('#tributos input[data-k="nome"]');
  nomes[nomes.length - 1].select();
});

$('#formCenario').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const tributos = rascunho.map(({ id, ...t }) => (id.startsWith('novo-') ? t : { id, ...t }));
    await lerResposta(fetch(`${API_URL}/cenarios/${selecionadoId}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ nome: $('#cNome').value, observacao: $('#cObs').value, tributos }),
    }));
    toast(selecionado()?.ativo ? 'Cenário salvo. Preços recalculados.' : 'Cenário salvo');
    await atualizarTudo(selecionadoId);
  } catch (err) { toast(err.message, true); }
});

$('#btnAtivar').addEventListener('click', async () => {
  try {
    await lerResposta(fetch(`${API_URL}/cenarios/${selecionadoId}/ativar`, { method: 'POST' }));
    toast('Cenário ativado. Preços recalculados.');
    await atualizarTudo(selecionadoId);
  } catch (err) { toast(err.message, true); }
});

$('#btnDuplicar').addEventListener('click', async () => {
  try {
    const c = await lerResposta(fetch(`${API_URL}/cenarios/${selecionadoId}/duplicar`, { method: 'POST' }));
    toast('Cenário duplicado');
    await atualizarTudo(c.id);
    $('#cNome').select();
  } catch (err) { toast(err.message, true); }
});

$('#btnNovoCenario').addEventListener('click', async () => {
  try {
    const c = await lerResposta(fetch(`${API_URL}/cenarios`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ nome: 'Novo cenário', observacao: '', tributos: [{ nome: 'Imposto', aliquota: 0, reforma: false, ativo: true }] }),
    }));
    await atualizarTudo(c.id);
    $('#cNome').select();
  } catch (err) { toast(err.message, true); }
});

$('#btnExcluir').addEventListener('click', (e) => {
  confirmarClique(e.currentTarget, async () => {
    try {
      await lerResposta(fetch(`${API_URL}/cenarios/${selecionadoId}`, { method: 'DELETE' }));
      toast('Cenário excluído');
      await atualizarTudo();
    } catch (err) { toast(err.message, true); }
  }, 'Excluir mesmo?');
});

// Configurações gerais
$('#formConfig').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const opcoesLucro = $('#lucros').value.split(/[;|]+/).map((x) => num(x) / 100).filter((x) => x > 0 && x < 1);
    await lerResposta(fetch(`${API_URL}/config`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ mercadoAds: num($('#ads').value) / 100, devolucoes: num($('#dev').value) / 100, opcoesLucro }),
    }));
    toast('Configurações salvas');
    await Promise.all([carregarConfig(), carregarHistorico()]);
  } catch (err) { toast(err.message, true); }
});

Promise.all([carregarCenarios(), carregarConfig(), carregarHistorico()]).catch((e) => toast(e.message, true));
