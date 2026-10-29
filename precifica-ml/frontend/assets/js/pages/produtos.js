import { API_URL, lerResposta } from '../api.js';
import { $, fmt, esc, toast, debounce, confirmarClique, montarLayout, urlPagina } from '../ui.js';

montarLayout('produtos');
$('#btnExportar').href = `${API_URL}/produtos/exportar`;

function badge(p) {
  if (!p.atual || p.atual.preco === undefined) return '<span class="badge up">inviável</span>';
  const d = p.atual.variacao;
  if (Math.abs(d) < 0.005) return '<span class="badge">igual</span>';
  return `<span class="badge ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${fmt.brl(Math.abs(d))}</span>`;
}

function linha(p) {
  const a = p.atual && p.atual.preco !== undefined ? p.atual : null;
  return `<tr data-id="${p.id}">
    <td><b>${esc(p.nome)}</b><div class="hint">${p.anuncio === 'premium' ? 'Premium' : 'Clássico'} · ${p.logistica === 'flex' ? 'Flex/próprio' : 'Mercado Envios'}</div></td>
    <td>${esc(p.tipo || 'Tipo removido')}</td>
    <td>${p.origem === 'internacional' ? 'Internacional' : 'Nacional'}</td>
    <td class="n">${a ? fmt.brl(a.custo) : '—'}</td>
    <td class="n">${fmt.input(p.lucro * 100, 1)}%</td>
    <td class="n">${fmt.brl(p.precoSalvo)}</td>
    <td class="n"><b>${a ? fmt.brl(a.preco) : '—'}</b></td>
    <td class="n">${badge(p)}</td>
    <td class="n">${a ? fmt.brl(a.lucro) : '—'}</td>
    <td class="n"><a class="btn ghost sm" href="${urlPagina(`index.html?produto=${p.id}`)}">Editar</a><button class="btn ghost sm" data-remover type="button" aria-label="Remover ${esc(p.nome)}">✕</button></td>
  </tr>`;
}

async function carregar() {
  try {
    const lista = await lerResposta(fetch(`${API_URL}/produtos?busca=${encodeURIComponent($('#busca').value.trim())}`));
    $('#lista').innerHTML = lista.length
      ? lista.map(linha).join('')
      : `<tr><td colspan="10" class="empty">${$('#busca').value ? 'Nenhum produto encontrado.' : `Nenhum produto salvo ainda. Calcule um preço na <a href="${urlPagina('index.html')}">Calculadora</a> e toque em Salvar.`}</td></tr>`;
  } catch (e) {
    toast(e.message, true);
  }
}

$('#busca').addEventListener('input', debounce(carregar, 250));

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
