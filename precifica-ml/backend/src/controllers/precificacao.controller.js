import * as service from '../services/precificacao.service.js';

export const simular = async (req, res) => res.json(await service.simular(req.body));
