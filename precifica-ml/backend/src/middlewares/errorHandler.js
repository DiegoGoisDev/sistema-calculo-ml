import AppError from '../utils/AppError.js';

// eslint-disable-next-line no-unused-vars
export default (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.message, detalhes: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'O corpo da requisição não é um JSON válido.' });
  }
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno no servidor.' });
};
