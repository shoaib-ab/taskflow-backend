# ── Development stage 
# docker compose up --build
#──────────────────────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

# Install dependencies first so this layer is cached unless package*.json changes
COPY package*.json ./
RUN npm install

# Copy source code (node_modules excluded via .dockerignore)
COPY . .

EXPOSE 5000

# Default: production-safe start. docker-compose overrides this to "npm run dev"
CMD ["node", "server.js"]

# ── Production stage 
# docker build --target production
# docker build --target production -t taskflow-backend:prod . (build production image with tag)
#────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5000
CMD ["node", "server.js"]