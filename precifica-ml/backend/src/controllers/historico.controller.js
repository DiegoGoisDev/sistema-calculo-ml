import * as service from '../services/historico.service.js';

export const listar = async (req, res) => res.json(await service.listar({ limite: Math.min(Number(req.query.limite) || 100, 300) }));
