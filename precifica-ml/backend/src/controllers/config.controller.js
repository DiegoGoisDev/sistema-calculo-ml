import * as service from '../services/config.service.js';

export const obter = async (req, res) => res.json(await service.obter());
export const atualizar = async (req, res) => res.json(await service.atualizar(req.body));
export const atualizarMetas = async (req, res) => res.json(await service.atualizarMetas(req.body));
