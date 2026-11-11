import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { searchMessages } from '../memory/messages';

const searchQuerySchema = z.object({
  q: z.string().optional().default(''),
  limit: z.coerce.number().int().positive().optional().default(20),
});

export const searchRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // GET /search?q=keyword
  server.get<{ Querystring: { q?: string; limit?: string } }>('/search', async (request, reply) => {
    const parseResult = searchQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parseResult.error.issues,
      });
    }

    const { q, limit } = parseResult.data;
    const results = searchMessages(q, limit);
    return results;
  });
};

