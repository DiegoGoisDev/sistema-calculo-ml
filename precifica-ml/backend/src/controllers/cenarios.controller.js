import * as service from '../services/cenarios.service.js';

export const listar = async (req, res) => res.json(await service.listar());
export const ativo = async (req, res) => res.json(await service.ativo());
export const buscar = async (req, res) => res.json(await service.buscar(req.params.id));
export const criar = async (req, res) => res.status(201).json(await service.criar(req.body));
export const atualizar = async (req, res) => res.json(await service.atualizar(req.params.id, req.body));
export const ativar = async (req, res) => res.json(await service.ativar(req.params.id));
export const duplicar = async (req, res) => res.status(201).json(await service.duplicar(req.params.id));
export const remover = async (req, res) => {
  await service.remover(req.params.id);
  res.status(204).end();
};
