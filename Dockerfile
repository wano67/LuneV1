########
# Multi-stage Dockerfile for Lune v2
# Targets:
#  - backend-build: compiles TypeScript backend
#  - backend: production backend image (Node 20)
#  - web-build: builds Next.js frontend
#  - web: production frontend image (Node 20)
########

########
# Build backend (TypeScript compile)
FROM node:20 AS backend-build
WORKDIR /app

# Copy package.json & install dev deps required for build (tsc)
COPY package.json package-lock.json* tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
RUN npm ci

# Compile TypeScript to /app/dist
RUN npx tsc --project tsconfig.json --outDir dist


########
# Final backend image
FROM node:20-alpine AS backend
WORKDIR /app

# Production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --production

# Copy compiled files and prisma schema (if needed at runtime)
COPY --from=backend-build /app/dist ./dist
COPY prisma ./prisma

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Run the compiled server entry
CMD ["node", "dist/api/server.js"]


########
# Build frontend (Next.js)
FROM node:20 AS web-build
WORKDIR /app/web

# Copy frontend package and install build deps
COPY apps/web/package.json apps/web/package-lock.json* ./
COPY apps/web/tsconfig.json ./
COPY apps/web/next.config.js ./
COPY apps/web ./
RUN npm ci

# Build the Next.js app
RUN npm run build


########
# Final frontend image
FROM node:20-alpine AS web
WORKDIR /app/web

# Minimal runtime environment
ENV NODE_ENV=production
ENV PORT=3000

# Install tini for signal handling (optional)
RUN apk add --no-cache tini

# Copy production assets from build stage
COPY --from=web-build /app/web/.next ./.next
COPY --from=web-build /app/web/public ./public
COPY --from=web-build /app/web/package.json ./package.json
COPY --from=web-build /app/web/package-lock.json ./package-lock.json

# Install production deps for Next.js (use --omit=dev for npm@9+ compatibility)
RUN npm ci --omit=dev

EXPOSE 3000

# Start Next.js
CMD ["/sbin/tini", "--", "npm", "run", "start"]
