FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Copy source code (внимание: .dockerignore может исключать некоторые файлы)
# Явно копируем всё, что нужно для работы приложения
COPY src/ /app/src/
COPY prisma/ /app/prisma/
COPY public/ /app/public/
COPY scripts/ /app/scripts/
COPY .env /app/.env
COPY next.config.mjs /app/next.config.mjs
COPY tsconfig.json /app/tsconfig.json
COPY middleware.ts /app/middleware.ts

# Production build is baked into the image so container startup is instant
# (no `next build` at runtime => no deploy downtime window).
# Local dev still works: docker-compose overrides CMD with `npm run dev`.
RUN npx prisma generate && npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm start"]