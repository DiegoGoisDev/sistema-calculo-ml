import app from './app.js';
import env from './config/env.js';
import db from './config/database.js';

async function start() {
  await db.init();
  const server = app.listen(env.port, () => {
    console.log(`Precifica ML rodando em http://localhost:${env.port}`);
    console.log(`API:  http://localhost:${env.port}/api/health`);
    console.log(`Dados: ${env.dataFile}`);
  });

  const encerrar = () => server.close(() => process.exit(0));
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

start().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
  process.exit(1);
});
