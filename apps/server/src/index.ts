import Fastify from 'fastify';
import pg from 'pg';

const app = Fastify({ logger: true });
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 3000,
  query_timeout: 3000,
});
pool.on('error', (error) => app.log.error(error, 'Database pool error'));
app.get('/api/health', async (_request, reply) => {
  try {
    await pool.query('SELECT 1');
    return { status: 'ok', database: 'connected' };
  } catch (error) {
    app.log.error(error, 'Database health check failed');
    return reply.code(503).send({ status: 'unavailable', database: 'disconnected' });
  }
});
app.addHook('onClose', async () => { await pool.end(); });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    app.close().catch((error) => { app.log.error(error); process.exitCode = 1; });
  });
}
try { await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3000) }); }
catch (error) { app.log.error(error); await pool.end(); process.exitCode = 1; }
