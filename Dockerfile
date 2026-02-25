# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (better layer caching)
COPY package.json package-lock.json ./

# Install all dependencies (including devDeps needed for build)
RUN npm ci

# Copy source code
COPY . .

# Build the production bundle
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install a lightweight static file server
RUN npm install -g serve

# Copy only the built output from the builder stage
COPY --from=builder /app/dist ./dist

# Back4App Containers expose port 80 by default
# 'serve' will serve on PORT env var if set, otherwise 3000
EXPOSE 3000

# Serve the Vite build output (dist folder)
CMD ["serve", "-s", "dist", "-l", "3000"]
