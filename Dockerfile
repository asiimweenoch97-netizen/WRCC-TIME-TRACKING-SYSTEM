# Multi-stage Dockerfile for WRCC Time Tracking System

# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package manifests first for efficient caching
COPY package.json package-lock.json* ./
COPY tsconfig.json vite.config.ts ./

# Copy source files
COPY server.ts ./
COPY index.html ./
COPY src ./src
COPY assets ./assets

# Install all deps (dev + prod) to run the build
RUN npm ci

# Build frontend and bundle server
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy production artifacts
COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production

# Create data directory for the app (mounted as a volume by hosts)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

# Start the bundled server
CMD ["node", "dist/server.cjs"]
