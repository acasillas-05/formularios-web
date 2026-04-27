# =====================================================================
# Dockerfile del frontend — alternativa a Azure Static Web Apps.
# Sirve el bundle de Vite con nginx detras. Util si quieres hostear
# ambos servicios en App Service Container o un VPS.
#
# Build context: el ROOT del monorepo.
#
# Build:
#   docker build -f web/Dockerfile -t formularios-web .
# Run (proxy /api hacia el host del API):
#   docker run --rm -p 80:80 \
#     -e API_UPSTREAM=http://api:3001 \
#     formularios-web
#
# IMPORTANTE: las VITE_* se inyectan en BUILD time. Si necesitas cambiarlas
# por entorno (dev/staging/prod), construye imagenes diferentes con
# --build-arg VITE_AZURE_TENANT_ID=... etc.
# =====================================================================

# ---------- Stage 1: build ------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /repo

ARG VITE_API_BASE_URL=""
ARG VITE_AZURE_TENANT_ID=""
ARG VITE_AZURE_CLIENT_ID=""
ARG VITE_AZURE_REDIRECT_URI=""

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AZURE_TENANT_ID=$VITE_AZURE_TENANT_ID
ENV VITE_AZURE_CLIENT_ID=$VITE_AZURE_CLIENT_ID
ENV VITE_AZURE_REDIRECT_URI=$VITE_AZURE_REDIRECT_URI

COPY package.json package-lock.json ./
COPY web/package.json ./web/
COPY api/package.json ./api/

RUN npm ci --workspace web --include-workspace-root

COPY web/tsconfig.json web/tsconfig.app.json web/tsconfig.node.json ./web/
COPY web/vite.config.ts web/index.html ./web/
COPY web/public ./web/public/
COPY web/src ./web/src/

RUN npm run build --workspace web

# ---------- Stage 2: nginx --------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Sustituye API_UPSTREAM en el template al startup (envsubst).
COPY web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /repo/web/dist /usr/share/nginx/html

ENV API_UPSTREAM=http://api:3001

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
