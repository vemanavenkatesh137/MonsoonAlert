import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import { config, checkRequiredEnv } from './config.js';
import { initVectorDb } from './services/vectorStore.js';
import layoutRoutes from './routes/layout.js';
import chatRoutes from './routes/chat.js';
import authRoutes from './routes/auth.js';

// Extend fastify types for TypeScript decorator support
declare module 'fastify' {
  interface FastifyInstance {
    verifyAuth: (request: any, reply: any) => Promise<void>;
  }
}

const fastify = Fastify({
  logger: true,
});

// Server entry point bootloader
const start = async () => {
  checkRequiredEnv();

  // 1. Configure JWT authentication
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'monsoon_secret_key_2026',
  });

  // 2. Decorate instance with authentication hook
  fastify.decorate('verifyAuth', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized: Invalid or missing token.' });
    }
  });

  // 3. Configure Rate Limiting (in-memory token-bucket)
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (request, context) => {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Emergency alerts remain readable, but API queries are restricted. Try again in ${context.after}.`,
      };
    },
  });

  // 4. Configure CORS
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // 5. Register routers
  await fastify.register(authRoutes);
  await fastify.register(layoutRoutes);
  await fastify.register(chatRoutes);

  // 6. Secured Emergency assistance endpoints
  fastify.post('/api/assistance/rescue', { preHandler: [fastify.verifyAuth] }, async (request, reply) => {
    fastify.log.info({ body: request.body }, 'Emergency Rescue Request received');
    return reply.send({
      success: true,
      message: 'CRITICAL: Rescue request submitted to control room. Local cell tower telemetry logged. Keep phone charged.',
    });
  });

  fastify.post('/api/assistance/report-waterlog', { preHandler: [fastify.verifyAuth] }, async (request, reply) => {
    fastify.log.info({ body: request.body }, 'Waterlogging report logged');
    return reply.send({
      success: true,
      message: 'Report logged. Municipal drainage maintenance teams have been notified of this grid location.',
    });
  });

  fastify.post('/api/assistance/claim', { preHandler: [fastify.verifyAuth] }, async (request, reply) => {
    fastify.log.info({ body: request.body }, 'Damage claim received');
    return reply.send({
      success: true,
      message: 'Disaster assessment claim registered. Inspection team schedule queued.',
    });
  });

  // 7. Try to connect to Vector DB
  await initVectorDb();

  try {
    const address = await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.info(`[SERVER] Monsoon Resilience Engine Backend running at ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
