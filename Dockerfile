# Stage 1: Build TypeScript application
FROM node:20-slim AS builder

WORKDIR /app

# Install build tools required by better-sqlite3 native bindings
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./

# Install all dependencies including devDependencies for compilation
RUN npm install

COPY src/ ./src/

# Compile TypeScript to dist/
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-slim AS runner

WORKDIR /app

# Install build tools for native SQLite module in production
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist

# Create data directory for persistent SQLite database
RUN mkdir -p /app/data

ENV PORT=3000
ENV DATABASE_PATH=/app/data/recall.db
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/server.js"]

