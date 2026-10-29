import { API_URL, JSON_HEADERS, lerResposta } from '../api.js';
import { $, $$, fmt, num, esc, toast, confirmarClique, montarLayout } from '../ui.js';

montarLayout('tipos');

// [campo, é percentual?, opcional (vazio = null)?]
const CAMPOS = [
  ['tarifaClassico', true], ['tarifaPremium', true], ['impostoVenda', true, true], ['reducaoReforma', true],
  ['impostoImportacao', true], ['icmsImportacao', true], ['embalagem', false],
];

function linha(t) {
  return `<tr data-id="${t.id}">
    <td><input data-k="nome" value="${esc(t.nome)}" style="min-width:210px" aria-label="Nome do tipo"></td>
    ${CAMPOS.map(([k, p, opcional]) => {
      const vazio = opcional && t[k] == null;
      const valor = vazio ? '' : fmt.input(p ? t[k] * 100 : t[k]);
      return `<td class="n"><input class="num" data-k="${k}" data-p="${p ? 1 : ''}" data-opcional="${opcional ? 1 : ''}" inputmode="decimal" value="${valor}"${opcional ? ' placeholder="cenário"' : ''} aria-label="${k}"></td>`;
    }).join('')}
    <td class="n" data-ef>${fmt.pct(t.impostoEfetivo, 2)}</td>
    <td class="n"><button class="btn ghost sm" data-remover type="button" aria-label="Remover tipo">✕</button></td>
  </tr>`;
}

async function carregar() {
  try {
    const tipos = await lerResposta(fetch(`${API_URL}/tipos`));
    $('#lista').innerHTML = tipos.map(linha).join('');
  } catch (e) { toast(e.message, true); }
}

function dadosDaLinha(tr) {
  const dados = {};
  $$('input', tr).forEach((i) => {
    if (i.dataset.k === 'nome') dados.nome = i.value;
    else if (i.dataset.opcional && !i.value.trim()) dados[i.dataset.k] = null;
    else dados[i.dataset.k] = i.dataset.p ? num(i.value) / 100 : num(i.value);
  });
  return dados;
}

$('#lista').addEventListener('change', async (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  try {
    const t = await lerResposta(fetch(`${API_URL}/tipos/${tr.dataset.id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(dadosDaLinha(tr)) }));
    const lista = await lerResposta(fetch(`${API_URL}/tipos`));
    const atual = lista.find((x) => x.id === t.id);
    if (atual) $('[data-ef]', tr).textContent = fmt.pct(atual.impostoEfetivo, 2);
    toast(`"${t.nome}" salvo`);
  } catch (err) {
    toast(err.message, true);
    carregar();
  }
});

$('#lista').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remover]');
  if (!btn) return;
  confirmarClique(btn, async () => {
    try {
      await lerResposta(fetch(`${API_URL}/tipos/${btn.closest('tr').dataset.id}`, { method: 'DELETE' }));
      toast('Tipo removido');
      carregar();
    } catch (err) { toast(err.message, true); }
  }, 'Remover?');
});

$('#btnNovo').addEventListener('click', async () => {
  try {
    const nomes = new Set($$('input[data-k="nome"]').map((i) => i.value.toLowerCase()));
    let nome = 'Novo tipo';
    for (let n = 2; nomes.has(nome.toLowerCase()); n += 1) nome = `Novo tipo ${n}`;
    await lerResposta(fetch(`${API_URL}/tipos`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ nome, tarifaClassico: 0.12, tarifaPremium: 0.17, embalagem: 2 }),
    }));
    await carregar();
    const inputs = $$('input[data-k="nome"]');
    const novo = inputs[inputs.length - 1];
    novo.scrollIntoView({ block: 'center' });
    novo.select();
  } catch (e) { toast(e.message, true); }
});

carregar();
