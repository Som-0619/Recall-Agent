import Fastify, { FastifyInstance } from 'fastify';
import { env } from './config/env';
import { initDatabase } from './database/db';
import { conversationRoutes } from './routes/conversations';
import { searchRoutes } from './routes/search';

/**
 * Builds and configures the Fastify server instance.
 */
export function buildServer(options: { logger?: boolean } = { logger: true }): FastifyInstance {
  const server = Fastify({
    logger: options.logger,
  });

  // Health check endpoint (from Phase 1)
  server.get('/health', async () => {
    return { status: 'ok', app: 'Recall' };
  });

  // Register Phase 2 routes
  server.register(conversationRoutes);
  server.register(searchRoutes);

  return server;
}

export const server = buildServer();

const start = async () => {
  try {
    // Initialize SQLite database and tables
    initDatabase();

    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 Recall server running on http://localhost:${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Start server if executed directly
if (require.main === module) {
  start();
}
