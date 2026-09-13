FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Generate Prisma client at runtime (in docker-compose command)
# This is done at container startup

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npm run dev"]