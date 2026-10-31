import * as service from '../services/analise.service.js';

export const resumo = async (req, res) => res.json(await service.resumo());
export const produto = async (req, res) => res.json(await service.produto(req.params.id, { preco: req.query.preco }));
export const cenarios = async (req, res) => res.json(await service.cenarios());
export const sensibilidade = async (req, res) => res.json(await service.sensibilidade(req.body));
