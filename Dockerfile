# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat bash

# ---- Dependencias (sin postinstall) ----
FROM base AS deps
COPY package.json package-lock.json* ./
# Evita ejecutar "postinstall" (prisma generate) aquí, porque aún no hemos copiado /prisma
RUN npm ci --no-audit --no-fund --ignore-scripts

# ---- Dev ----
FROM base AS dev
ENV NODE_ENV=development
# node_modules listos
COPY --from=deps /app/node_modules ./node_modules
# copiamos el código (el volumen del compose lo montará encima en runtime)
COPY . .
EXPOSE 3000
CMD ["npm","run","dev"]
