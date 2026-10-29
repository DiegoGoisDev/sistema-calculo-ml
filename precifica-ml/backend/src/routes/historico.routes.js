import { Router } from 'express';
import h from '../utils/asyncHandler.js';
import * as c from '../controllers/historico.controller.js';

const router = Router();

router.get('/', h(c.listar));

export default router;
