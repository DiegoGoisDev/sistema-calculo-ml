// Utilitários de interface compartilhados: layout, formatação, toast.
import { API_URL, lerResposta } from './api.js';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmt = {
  brl: (v) => (Number.isFinite(v) ? BRL.format(v) : '—'),
  pct: (v, casas = 1) => (Number.isFinite(v) ? `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%` : '—'),
  /** Número para preencher um input (sem zeros sobrando). */
  input: (v, casas = 2) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas, useGrouping: false }),
  data: (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
};

/** Lê "1.234,56", "1234.56" ou "12,5" e devolve número. */
export function num(valor) {
  let s = String(valor ?? '').trim().replace(/\s/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

let toastTimer;
export function toast(msg, erro = false) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('erro', erro);
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), erro ? 4000 : 2400);
}

/** Botão que pede um segundo clique para confirmar (sem diálogos do navegador). */
export function confirmarClique(btn, acao, textoConfirmar = 'Confirmar?') {
  if (btn.dataset.armado) return acao();
  const original = btn.textContent;
  btn.dataset.armado = '1';
  btn.textContent = textoConfirmar;
  setTimeout(() => {
    if (btn.isConnected) { delete btn.dataset.armado; btn.textContent = original; }
  }, 3000);
  return undefined;
}

const ICONES = {
  calculadora: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
  produtos: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  tipos: '<path d="M3 6l9-3 9 3-9 3-9-3z"/><path d="M3 12l9 3 9-3M3 18l9 3 9-3"/>',
  impostos: '<path d="M5 19L19 5"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
};
// Raiz do frontend, a partir deste arquivo (assets/js/ui.js): os links funcionam tanto em index.html quanto em pages/*.html
const RAIZ = new URL('../../', import.meta.url);

/** Endereço de uma página a partir da raiz do frontend, ex.: urlPagina('pages/produtos.html'). */
export const urlPagina = (caminho) => new URL(caminho, RAIZ).href;

const PAGINAS = [
  ['calculadora', 'index.html', 'Calculadora'],
  ['produtos', 'pages/produtos.html', 'Meus produtos'],
  ['tipos', 'pages/tipos.html', 'Tipos de produto'],
  ['impostos', 'pages/impostos.html', 'Impostos'],
];

/** Monta o menu lateral e o indicador de cenário ativo. */
export function montarLayout(paginaAtual) {
  const aside = $('#sidebar');
  aside.innerHTML = `
    <a class="brand" href="${urlPagina('index.html')}"><span class="brand-mark">R$</span><span class="t">Precifica ML</span></a>
    <nav>${PAGINAS.map(([id, href, nome]) => `
      <a href="${urlPagina(href)}" ${id === paginaAtual ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ICONES[id]}</svg><span>${nome}</span>
      </a>`).join('')}
    </nav>
    <div class="side-foot">
      <a class="scen-pill" href="${urlPagina('pages/impostos.html')}">Cenário de impostos ativo<b id="sideScen">—</b></a>
      <div class="api-state" id="apiState"><i></i><span>Conectando…</span></div>
    </div>`;
  atualizarCenarioLateral();
}

export async function atualizarCenarioLateral() {
  const estado = $('#apiState');
  try {
    const c = await lerResposta(fetch(`${API_URL}/cenarios/ativo`));
    $('#sideScen').textContent = `${c.nome} · ${fmt.pct(c.total, 2)}`;
    estado.className = 'api-state on';
    estado.querySelector('span').textContent = 'API conectada';
  } catch (e) {
    estado.className = 'api-state off';
    estado.querySelector('span').textContent = 'API desconectada';
    toast(e.message, true);
  }
}

export function setSeg(container, valor) {
  $$('button', container).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === valor)));
}
