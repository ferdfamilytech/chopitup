# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json only (no lock file required)
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the production bundle
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
