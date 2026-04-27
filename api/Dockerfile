# =====================================================================
# Dockerfile del API — alternativa a deploy directo a App Service Linux.
# Usar con Azure Container Apps, Container Registry + App Service Container,
# o cualquier orquestador compatible con OCI.
#
# Build context: el ROOT del monorepo (no api/), porque necesitamos los
# workspaces para que npm install resuelva @formularios-web/api.
#
# Build:
#   docker build -f api/Dockerfile -t formularios-api .
# Run:
#   docker run --rm -p 8080:8080 \
#     -e DATABASE_URL=... \
#     -e BDADN_USER=... \
#     -e BDADN_PASSWORD=... \
#     -e AZURE_AD_TENANT_ID=... \
#     -e AZURE_AD_CLIENT_ID=... \
#     -e AZURE_AD_AUDIENCE=... \
#     -e CORS_ORIGINS=https://formularios.adnenergia.com \
#     -e NODE_ENV=production \
#     formularios-api
# =====================================================================

# ---------- Stage 1: deps + build ------------------------------------
FROM node:22-alpine AS builder

# openssl es requerido por Prisma para generar el client.
RUN apk add --no-cache openssl

WORKDIR /repo

# Manifests primero para aprovechar cache de layers.
COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY web/package.json ./web/

# Instalamos solo el workspace api (omitimos web para acelerar).
RUN npm ci --workspace api --include-workspace-root

# Copiamos solo lo necesario para compilar el API.
COPY api/tsconfig.json ./api/
COPY api/prisma ./api/prisma/
COPY api/src ./api/src/

# Generamos el client de Prisma con el schema de produccion y compilamos.
RUN npm run build:prod --workspace api

# ---------- Stage 2: runtime mínimo ----------------------------------
FROM node:22-alpine AS runtime

RUN apk add --no-cache openssl tini && \
    addgroup -S app && adduser -S app -G app

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copiamos node_modules (incluye @prisma/client ya generado), el dist,
# el package.json para resolver "main", y prisma/ para que migrate deploy
# este disponible si se quiere correr al startup.
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/api/node_modules ./api/node_modules
COPY --from=builder /repo/api/dist ./dist
COPY --from=builder /repo/api/prisma ./prisma
COPY --from=builder /repo/api/package.json ./package.json

# Permisos del directorio del usuario no-root.
RUN chown -R app:app /app

USER app

EXPOSE 8080

# Healthcheck: el endpoint /api/health es publico y no toca BD.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# tini como PID 1 propaga senales correctamente (SIGTERM al detenerlo).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
