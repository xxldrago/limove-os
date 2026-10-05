FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cache layer)
COPY /c/Users/Администратор/AppData/Local/hermes/cache/documents/doc_8d75a54dac83_limove-backup-902e29758592.json /app/google-svc-account.json
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Production build is baked into the image so container startup is instant
# (no `next build` at runtime => no deploy downtime window).
# Local dev still works: docker-compose overrides CMD with `npm run dev`.
RUN npx prisma generate && npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm start"]