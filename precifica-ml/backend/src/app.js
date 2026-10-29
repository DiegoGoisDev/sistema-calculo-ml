import express from 'express';
import cors from 'cors';
import env from './config/env.js';
import routes from './routes/index.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', routes);
app.use('/api', notFound);

// Entrega o frontend (pasta ../frontend) quando SERVE_FRONTEND=true
if (env.serveFrontend) {
  app.use(express.static(env.frontendDir)); // "/" entrega frontend/index.html
}

app.use(notFound);
app.use(errorHandler);

export default app;
