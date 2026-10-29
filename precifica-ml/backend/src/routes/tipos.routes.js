import { Router } from 'express';
import h from '../utils/asyncHandler.js';
import * as c from '../controllers/tipos.controller.js';

const router = Router();

router.get('/', h(c.listar));
router.post('/', h(c.criar));
router.get('/:id', h(c.buscar));
router.put('/:id', h(c.atualizar));
router.delete('/:id', h(c.remover));

export default router;
