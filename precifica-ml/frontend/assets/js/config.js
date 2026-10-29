// Endereço da API.
// - Página servida pela própria API (Render ou http://localhost:3000): usa '/api'.
// - Página aberta por outro servidor local (ex.: Live Server na porta 5500) ou como arquivo: usa a API local na porta 3000.
// - Página hospedada em qualquer outro lugar: usa a API publicada no Render.
const API_PUBLICADA = 'https://sistema-calculo-ml.onrender.com';
const API_LOCAL_PORTA = '3000';

const local = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
const servidaPelaApi = location.origin === API_PUBLICADA || (local && location.port === API_LOCAL_PORTA);

let apiUrl = `${API_PUBLICADA}/api`;
if (servidaPelaApi) apiUrl = '/api';
else if (local) apiUrl = `http://localhost:${API_LOCAL_PORTA}/api`;

window.PRECIFICA_CONFIG = {
  API_URL: apiUrl,
};
