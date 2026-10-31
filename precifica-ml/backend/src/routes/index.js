import { Router } from 'express';
import tipos from './tipos.routes.js';
import cenarios from './cenarios.routes.js';
import config from './config.routes.js';
import produtos from './produtos.routes.js';
import precificacao from './precificacao.routes.js';
import historico from './historico.routes.js';
import analise from './analise.routes.js';

const router = Router();

router.get('/health', async (req, res) => res.json({ status: 'ok', horario: new Date().toISOString() }));

router.use('/tipos', tipos);
router.use('/cenarios', cenarios);
router.use('/config', config);
router.use('/produtos', produtos);
router.use('/precificacao', precificacao);
router.use('/historico', historico);
router.use('/analise', analise);

export default router;
