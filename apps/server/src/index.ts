import './loadEnv.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMergeRoutes } from './routes/merge.js';
import { registerIgCheckRoutes } from './routes/igCheck.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  logger: {
    redact: ['req.headers.cookie', 'req.headers.authorization'],
  },
  bodyLimit: 1024 * 1024,
});

await app.register(cookie);
await app.register(cors, {
  origin: config.isProd ? config.publicOrigin : true,
  credentials: true,
});

await registerAuthRoutes(app);
await registerMergeRoutes(app);
await registerIgCheckRoutes(app);

const webDist = path.resolve(__dirname, '../../web/dist');
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist, prefix: '/' });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/auth') || req.url.startsWith('/merge') || req.url.startsWith('/ig-check')) {
      reply.code(404).send({ error: 'not_found' });
      return;
    }
    reply.sendFile('index.html');
  });
}

app.get('/healthz', async () => ({ ok: true }));

app
  .listen({ port: config.port, host: '0.0.0.0' })
  .then(() => app.log.info(`server listening on :${config.port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
