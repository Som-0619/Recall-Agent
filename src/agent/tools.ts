import { Type } from '@google/genai';

/**
 * Declaration for the web_search tool exposed to Gemini.
 */
export const webSearchDeclaration = {
  name: 'web_search',
  description:
    'Search the internet for current information, recent announcements, pricing changes, product updates, release notes, or to verify whether previous answers or assumptions are still correct.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'The search query to look up on the web.',
      },
    },
    required: ['query'],
  },
};

export const geminiTools = [
  {
    functionDeclarations: [webSearchDeclaration],
  },
];

