import { API_URL, lerResposta } from '../api.js';
import { $, $$, fmt, esc, toast, debounce, confirmarClique, montarLayout, urlPagina, seloStatus } from '../ui.js';

montarLayout('produtos');
$('#btnExportar').href = `${API_URL}/produtos/exportar`;

let produtos = [];
const ordem = { campo: null, direcao: 1 };

// Valor usado para ordenar cada coluna (inviáveis vão para o fim)
const VALOR = {
  nome: (p) => p.nome.toLowerCase(),
  tipo: (p) => (p.tipo || '').toLowerCase(),
  origem: (p) => p.origem,
  custo: (p) => p.atual?.custo,
  lucroPct: (p) => p.lucro,
  precoSalvo: (p) => p.precoSalvo,
  preco: (p) => p.atual?.preco,
  variacao: (p) => p.atual?.variacao,
  lucro: (p) => p.atual?.lucro,
  margem: (p) => p.atual?.margem,
};

function badge(p) {
  if (!p.atual || p.atual.preco === undefined) return '<span class="badge up">inviável</span>';
  const d = p.atual.variacao;
  if (Math.abs(d) < 0.005) return '<span class="badge">igual</span>';
  return `<span class="badge ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${fmt.brl(Math.abs(d))}</span>`;
}

function linha(p) {
  const a = p.atual && p.atual.preco !== undefined ? p.atual : null;
  return `<tr data-id="${p.id}">
    <td><b>${esc(p.nome)}</b><div class="hint">${p.anuncio === 'premium' ? 'Premium' : 'Clássico'} · ${p.logistica === 'flex' ? 'Flex/próprio' : 'Mercado Envios'}${p.volumeMensal ? ` · ${p.volumeMensal}/mês` : ''}</div></td>
    <td>${esc(p.tipo || 'Tipo removido')}</td>
    <td>${p.origem === 'internacional' ? 'Internacional' : 'Nacional'}</td>
    <td class="n">${a ? fmt.brl(a.custo) : '—'}</td>
    <td class="n">${fmt.input(p.lucro * 100, 1)}%</td>
    <td class="n">${fmt.brl(p.precoSalvo)}</td>
    <td class="n"><b>${a ? fmt.brl(a.preco) : '—'}</b></td>
    <td class="n">${badge(p)}</td>
    <td class="n">${a ? fmt.brl(a.lucro) : '—'}</td>
    <td class="n">${seloStatus(p.status, true)} ${a ? fmt.pct(a.margem) : '—'}</td>
    <td class="n"><a class="btn ghost sm" href="${urlPagina(`pages/analise.html?aba=produto&produto=${p.id}`)}">Analisar</a><a class="btn ghost sm" href="${urlPagina(`index.html?produto=${p.id}`)}">Editar</a><button class="btn ghost sm" data-remover type="button" aria-label="Remover ${esc(p.nome)}">✕</button></td>
  </tr>`;
}

function filtrados() {
  const f = { tipo: $('#fTipo').value, status: $('#fStatus').value, origem: $('#fOrigem').value, anuncio: $('#fAnuncio').value };
  let lista = produtos.filter((p) => (!f.tipo || p.tipoId === f.tipo)
    && (!f.status || p.status === f.status)
    && (!f.origem || p.origem === f.origem)
    && (!f.anuncio || p.anuncio === f.anuncio));
  if (ordem.campo) {
    const v = VALOR[ordem.campo];
    lista = [...lista].sort((a, b) => {
      const x = v(a); const y = v(b);
      if (x == null) return y == null ? 0 : 1;
      if (y == null) return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * ordem.direcao;
    });
  }
  return lista;
}

function render() {
  const lista = filtrados();
  const filtrando = $('#busca').value || lista.length !== produtos.length;
  $('#contagem').textContent = produtos.length ? `${lista.length} de ${produtos.length} produto(s)` : '';
  $$('th[data-ordem]').forEach((th) => {
    if (th.dataset.ordem === ordem.campo) th.setAttribute('aria-sort', ordem.direcao > 0 ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
  });
  $('#lista').innerHTML = lista.length
    ? lista.map(linha).join('')
    : `<tr><td colspan="11" class="empty">${filtrando ? 'Nenhum produto encontrado.' : `Nenhum produto salvo ainda. Calcule um preço na <a href="${urlPagina('index.html')}">Calculadora</a> e toque em Salvar.`}</td></tr>`;
}

function preencherTipos() {
  const atual = $('#fTipo').value;
  const tipos = [...new Map(produtos.filter((p) => p.tipo).map((p) => [p.tipoId, p.tipo])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  $('#fTipo').innerHTML = `<option value="">Todos os tipos</option>${tipos.map(([id, nome]) => `<option value="${id}">${esc(nome)}</option>`).join('')}`;
  if (tipos.some(([id]) => id === atual)) $('#fTipo').value = atual;
}

async function carregar() {
  try {
    produtos = await lerResposta(fetch(`${API_URL}/produtos?busca=${encodeURIComponent($('#busca').value.trim())}`));
    preencherTipos();
    render();
  } catch (e) {
    toast(e.message, true);
  }
}

$('#busca').addEventListener('input', debounce(carregar, 250));
['#fTipo', '#fStatus', '#fOrigem', '#fAnuncio'].forEach((s) => $(s).addEventListener('change', render));

$('thead').addEventListener('click', (e) => {
  const th = e.target.closest('th[data-ordem]');
  if (!th) return;
  ordem.direcao = ordem.campo === th.dataset.ordem ? -ordem.direcao : 1;
  ordem.campo = th.dataset.ordem;
  render();
});

$('#lista').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remover]');
  if (!btn) return;
  confirmarClique(btn, async () => {
    try {
      await lerResposta(fetch(`${API_URL}/produtos/${btn.closest('tr').dataset.id}`, { method: 'DELETE' }));
      toast('Produto removido');
      carregar();
    } catch (err) { toast(err.message, true); }
  }, 'Remover?');
});

$('#btnAtualizar').addEventListener('click', (e) => {
  confirmarClique(e.currentTarget, async () => {
    try {
      const { atualizados } = await lerResposta(fetch(`${API_URL}/produtos/atualizar-precos`, { method: 'POST' }));
      toast(atualizados ? `${atualizados} preço(s) gravado(s)` : 'Todos os preços já estão em dia');
      carregar();
    } catch (err) { toast(err.message, true); }
  }, 'Gravar todos?');
});

carregar();
