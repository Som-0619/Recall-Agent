import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

// Define validation schema for environment variables
const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  GEMINI_API_KEY: z.string().optional().default(''),
  MODEL_NAME: z.string().default('gemini-2.5-flash'),
  TAVILY_API_KEY: z.string().optional().default(''),
  DATABASE_PATH: z.string().default('./data/recall.db'),
});

// Validate process.env against schema
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Environment validation error:');
  for (const issue of parseResult.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parseResult.data;

