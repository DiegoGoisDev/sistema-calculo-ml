import { Router } from 'express';
import h from '../utils/asyncHandler.js';
import * as c from '../controllers/config.controller.js';

const router = Router();

router.get('/', h(c.obter));
router.put('/', h(c.atualizar));

export default router;
