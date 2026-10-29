import { Router } from 'express';
import h from '../utils/asyncHandler.js';
import * as c from '../controllers/cenarios.controller.js';

const router = Router();

router.get('/', h(c.listar));
router.post('/', h(c.criar));
router.get('/ativo', h(c.ativo));
router.get('/:id', h(c.buscar));
router.put('/:id', h(c.atualizar));
router.delete('/:id', h(c.remover));
router.post('/:id/ativar', h(c.ativar));
router.post('/:id/duplicar', h(c.duplicar));

export default router;
