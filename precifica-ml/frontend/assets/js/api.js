// Base das requisições à API. As páginas chamam as rotas direto com fetch:
//   const tipos = await lerResposta(fetch(`${API_URL}/tipos`));
//   await lerResposta(fetch(`${API_URL}/tipos/${id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(dados) }));
export const API_URL = (window.PRECIFICA_CONFIG && window.PRECIFICA_CONFIG.API_URL) || '/api';

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Aguarda o fetch e devolve o JSON da resposta; erros da API viram Error com a mensagem do backend. */
export async function lerResposta(requisicao) {
  let res;
  try {
    res = await requisicao;
  } catch {
    throw new Error('Não foi possível conectar à API. Verifique se o servidor está rodando.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
  return data;
}
