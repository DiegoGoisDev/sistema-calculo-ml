// Endereço da API.
// - Página servida pela própria API (http://localhost:3000): usa '/api'.
// - Página aberta por outro servidor local (ex.: Live Server na porta 5500) ou como arquivo: usa a API na porta 3000.
// - Frontend hospedado em outro lugar: troque por a URL completa, ex.: 'https://api.seudominio.com/api'.
const API_PORTA = '3000';
const abertaFora = location.protocol === 'file:'
  || (['localhost', '127.0.0.1'].includes(location.hostname) && location.port !== API_PORTA);

window.PRECIFICA_CONFIG = {
  API_URL: abertaFora ? `http://localhost:${API_PORTA}/api` : '/api',
};
