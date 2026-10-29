import { Router } from 'express';
import h from '../utils/asyncHandler.js';
import * as c from '../controllers/precificacao.controller.js';

const router = Router();

router.post('/simular', h(c.simular));

export default router;
