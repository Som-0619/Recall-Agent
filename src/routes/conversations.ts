import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createConversation,
  getConversation,
  listConversations,
  updateConversation,
  deleteConversation,
} from '../memory/conversation';
import { saveMessage, getMessages, getRecentMessages } from '../memory/messages';
import { saveMemory, getMemories, MemoryType } from '../memory/memories';
import { chat } from '../agent/chat';

// Validation schemas
const createConversationSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
});

const updateConversationSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
});

const saveMessageSchema = z.object({
  role: z.enum(['user', 'assistant'], {
    errorMap: () => ({ message: "Role must be either 'user' or 'assistant'" }),
  }),
  content: z.string().min(1, 'Content cannot be empty'),
});

const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
});

const saveMemorySchema = z.object({
  type: z.enum(['fact', 'decision', 'preference', 'constraint'], {
    errorMap: () => ({
      message: "Type must be 'fact', 'decision', 'preference', or 'constraint'",
    }),
  }),
  subject: z.string().min(1, 'Subject cannot be empty'),
  content: z.string().min(1, 'Content cannot be empty'),
  source_message_id: z.string().optional().nullable(),
});

const chatBodySchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
});

export const conversationRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // POST /conversations - Create conversation
  server.post('/conversations', async (request, reply) => {
    const parseResult = createConversationSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    const conversation = createConversation(parseResult.data.title);
    return reply.status(201).send(conversation);
  });

  // GET /conversations - List all conversations
  server.get('/conversations', async () => {
    return listConversations();
  });

  // GET /conversations/:id - Get conversation by ID
  server.get<{ Params: { id: string } }>('/conversations/:id', async (request, reply) => {
    const conversation = getConversation(request.params.id);
    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }
    return conversation;
  });

  // PATCH /conversations/:id - Update conversation title
  server.patch<{ Params: { id: string } }>('/conversations/:id', async (request, reply) => {
    const parseResult = updateConversationSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    const updated = updateConversation(request.params.id, parseResult.data.title);
    if (!updated) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    return updated;
  });

  // DELETE /conversations/:id - Delete conversation and its messages/memories
  server.delete<{ Params: { id: string } }>('/conversations/:id', async (request, reply) => {
    const success = deleteConversation(request.params.id);
    if (!success) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    return reply.status(200).send({ message: 'Conversation deleted successfully' });
  });

  // POST /conversations/:id/messages - Save message to a conversation
  server.post<{ Params: { id: string } }>(
    '/conversations/:id/messages',
    async (request, reply) => {
      const conversation = getConversation(request.params.id);
      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      const parseResult = saveMessageSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parseResult.error.issues,
        });
      }

      const message = saveMessage(
        request.params.id,
        parseResult.data.role,
        parseResult.data.content
      );

      return reply.status(201).send(message);
    }
  );

  // GET /conversations/:id/messages - Retrieve messages for a conversation
  server.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/conversations/:id/messages',
    async (request, reply) => {
      const conversation = getConversation(request.params.id);
      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      const queryParse = listMessagesQuerySchema.safeParse(request.query);
      if (!queryParse.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          details: queryParse.error.issues,
        });
      }

      const limit = queryParse.data.limit;
      const messages = limit
        ? getRecentMessages(request.params.id, limit)
        : getMessages(request.params.id);

      return messages;
    }
  );

  // POST /conversations/:id/memories - Save structured memory
  server.post<{ Params: { id: string } }>(
    '/conversations/:id/memories',
    async (request, reply) => {
      const conversation = getConversation(request.params.id);
      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      const parseResult = saveMemorySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parseResult.error.issues,
        });
      }

      const memory = saveMemory({
        conversation_id: request.params.id,
        type: parseResult.data.type as MemoryType,
        subject: parseResult.data.subject,
        content: parseResult.data.content,
        source_message_id: parseResult.data.source_message_id,
      });

      return reply.status(201).send(memory);
    }
  );

  // GET /conversations/:id/memories - List memories for conversation
  server.get<{ Params: { id: string } }>(
    '/conversations/:id/memories',
    async (request, reply) => {
      const conversation = getConversation(request.params.id);
      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      return getMemories(request.params.id);
    }
  );

  // POST /conversations/:id/chat - Chat with Gemini, persist messages, and extract memories
  server.post<{ Params: { id: string } }>(
    '/conversations/:id/chat',
    async (request, reply) => {
      const conversation = getConversation(request.params.id);
      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      const parseResult = chatBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parseResult.error.issues,
        });
      }

      try {
        const result = await chat(request.params.id, parseResult.data.message);
        return reply.status(200).send(result);
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({
          error: error?.message || 'Failed to generate chat response',
        });
      }
    }
  );
};
