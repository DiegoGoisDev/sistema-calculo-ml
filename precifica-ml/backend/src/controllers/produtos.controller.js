import * as service from '../services/produtos.service.js';

export const listar = async (req, res) => res.json(await service.listar({ busca: req.query.busca }));
export const buscar = async (req, res) => res.json(await service.buscar(req.params.id));
export const criar = async (req, res) => res.status(201).json(await service.criar(req.body));
export const atualizar = async (req, res) => res.json(await service.atualizar(req.params.id, req.body));
export const atualizarPrecosSalvos = async (req, res) => res.json(await service.atualizarPrecosSalvos());
export const remover = async (req, res) => {
  await service.remover(req.params.id);
  res.status(204).end();
};
export const exportar = async (req, res) => {
  const csv = await service.exportarCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="meus-produtos-ml.csv"');
  res.send(csv);
};
