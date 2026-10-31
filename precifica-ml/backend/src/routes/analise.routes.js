import { Router } from 'express';
import h from '../utils/asyncHandler.js';
import * as c from '../controllers/analise.controller.js';

const router = Router();

router.get('/resumo', h(c.resumo));
router.get('/cenarios', h(c.cenarios));
router.post('/sensibilidade', h(c.sensibilidade));
router.get('/produtos/:id', h(c.produto));

export default router;
