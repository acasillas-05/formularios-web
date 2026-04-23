# AdmonOps Platform — Technology Stack & Bootstrap Guide

> Documento de referencia técnica para **montar desde cero** un proyecto con el mismo
> stack que AdmonOpsPlatform. Úsalo en un proyecto nuevo para que Claude (o cualquier
> desarrollador) pueda reproducir la arquitectura completa.
>
> Este archivo complementa a `DESIGN_SYSTEM.md` (sistema visual).
> Aquí se describen **runtimes, librerías, configuración y pasos de bootstrap**.
>
> **Última actualización:** 2026-04-23
> **Versión del stack:** v1.0

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura general](#2-arquitectura-general)
3. [Stack Frontend](#3-stack-frontend)
4. [Stack Backend](#4-stack-backend)
5. [Base de datos](#5-base-de-datos)
6. [Autenticación y seguridad](#6-autenticacion-y-seguridad)
7. [Integraciones externas](#7-integraciones-externas)
8. [Estructura de monorepo](#8-estructura-de-monorepo)
9. [Variables de entorno](#9-variables-de-entorno)
10. [Configuraciones canónicas](#10-configuraciones-canonicas)
11. [Bootstrap desde cero — paso a paso](#11-bootstrap-desde-cero--paso-a-paso)
12. [Scripts de npm](#12-scripts-de-npm)
13. [Prisma — workflow completo](#13-prisma--workflow-completo)
14. [Producción y despliegue](#14-produccion-y-despliegue)
15. [Observabilidad y mantenimiento](#15-observabilidad-y-mantenimiento)
16. [Matriz de decisiones](#16-matriz-de-decisiones)

---

## 1. Resumen ejecutivo

AdmonOpsPlatform es una **aplicación web multi-tenant (multi-centro)** para gestión
operacional industrial. La arquitectura es un **monorepo con npm workspaces** que
aloja dos aplicaciones independientes pero coordinadas:

- **`api/`** — Servidor Express 5 con Prisma 6 y TypeScript ESM.
- **`web/`** — SPA React 19 con Vite 8, TailwindCSS 4 y TanStack React Query 5.

El sistema corre en **Node.js 22** y usa **SQLite en desarrollo / SQL Server Azure
en producción** vía el mismo schema Prisma (cambiando sólo el provider).

La autenticación es **Microsoft Entra ID** (Azure AD) con flujo de *access token*
validado en el backend contra JWKS. En desarrollo se puede activar `DEV_BYPASS` para
saltar el login.

La filosofía del stack:

1. **TypeScript estricto en todo.** Sin `any` sin motivo. Strict mode on.
2. **Un solo lenguaje fuente de verdad.** Tipos compartidos entre front y back vía
   Prisma-generated types o un paquete `lib` interno si hace falta.
3. **Dev ≡ prod salvo por la BD.** El código idéntico, sólo cambia la cadena de
   conexión y el provider de Prisma.
4. **Seguridad por defecto.** `helmet`, `rate-limit`, `cors` restringido,
   `compression`, validación con `zod`.
5. **Performance sin magia.** Vite con manual chunks por vendor pesado; React Query
   con `staleTime` explícito; lazy loading de cada módulo.

---

## 2. Arquitectura general

```
┌─────────────────────────────────────────────────────────────────────┐
│                            NAVEGADOR                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Vite dev server :5173                                       │   │
│  │  - React 19 SPA                                              │   │
│  │  - MSAL (Azure AD) obtiene access_token                      │   │
│  │  - React Query cache                                         │   │
│  │  - Zustand state (auth + centro activo)                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                        proxy /api (dev)
                  Authorization: Bearer <token>
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API Express :3001                               │
│  helmet → compression → cors → rate-limit → json → auth (JWKS)      │
│  → centroParser (x-centro-id) → rutas (/api/*) → errorHandler       │
│                                                                     │
│  Capa de persistencia: Prisma 6                                     │
└────┬──────────────────────────────────────────────┬─────────────────┘
     │                                              │
     ▼                                              ▼
┌──────────────────────────┐           ┌──────────────────────────────┐
│  SQLite (dev)   or       │           │  Azure AD JWKS endpoint      │
│  SQL Server Azure (prod) │           │  (validación del JWT)        │
└──────────────────────────┘           └──────────────────────────────┘

           (Opcional, sólo si aplica al dominio)
     │
     ▼
┌──────────────────────────┐     ┌────────────────────────┐
│  BD externa SQL Server   │     │  Azure Blob Storage    │
│  (solo lectura)          │     │  (documentos adjuntos) │
└──────────────────────────┘     └────────────────────────┘
```

Puntos clave:
- **Dos procesos separados** en desarrollo (`api` en 3001, `web` en 5173).
- **Un solo process manager** (por ejemplo `concurrently`) arranca ambos con `npm run dev` desde la raíz.
- **En producción** el backend sirve la API y el frontend se despliega como static
  assets (Azure Static Web Apps, Vercel, Nginx, etc.).

---

## 3. Stack Frontend

### 3.1 Runtime y lenguaje

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Node.js | >=22 (solo para dev/build) | Runtime de Vite |
| TypeScript | 5.9+ | Tipado estricto |
| ESM | module type | Proyecto ESM puro (`"type": "module"`) |

### 3.2 Build tool y framework UI

| Paquete | Versión | Rol |
|---------|---------|-----|
| `vite` | ^8.0.1 | Dev server + bundler |
| `@vitejs/plugin-react` | ^6.0.1 | HMR para React |
| `react` | ^19.2.4 | UI framework |
| `react-dom` | ^19.2.4 | Renderer |

### 3.3 Styling

| Paquete | Versión | Rol |
|---------|---------|-----|
| `tailwindcss` | ^4.2.2 | Utility CSS |
| `@tailwindcss/vite` | ^4.2.2 | Integración Tailwind 4 con Vite (sin PostCSS config) |

> **Nota Tailwind 4:** NO hay `tailwind.config.js`. Los tokens de diseño se definen
> en `src/styles.css` con `@theme { ... }`. Ver `DESIGN_SYSTEM.md` §3.

### 3.4 Routing y estado

| Paquete | Versión | Rol |
|---------|---------|-----|
| `react-router` | ^7.13.1 | Routing SPA (`createBrowserRouter`) |
| `zustand` | ^5.0.12 | Estado global mínimo (auth + centro activo + sidebar) |
| `@tanstack/react-query` | ^5.91.3 | Cache y fetching de datos del servidor |

### 3.5 Visualización y fechas

| Paquete | Versión | Rol |
|---------|---------|-----|
| `echarts` | ^6.0.0 | Motor de gráficas |
| `echarts-for-react` | ^3.0.6 | Wrapper React |
| `date-fns` | ^4.1.0 | Manipulación de fechas (con locale `es`) |
| `react-day-picker` | ^9.14.0 | Base del DatePicker custom |

### 3.6 Iconografía e interacción

| Paquete | Versión | Rol |
|---------|---------|-----|
| `lucide-react` | ^0.577.0 | Iconografía SVG |

### 3.7 Auth

| Paquete | Versión | Rol |
|---------|---------|-----|
| `@azure/msal-browser` | ^4.30.0 | Flujo de login Azure AD (redirect) |

### 3.8 Export / archivos

| Paquete | Versión | Rol |
|---------|---------|-----|
| `xlsx` (SheetJS) | ^0.18.5 | Export a Excel (tablas, reportes) |

> **Alerta:** `xlsx@0.18.5` tiene vulnerabilidades conocidas sin fix (Prototype
> Pollution + ReDoS). Aceptable en desarrollo; para producción evaluar migrar a
> `exceljs` o pinear versión más reciente desde el registro oficial de SheetJS.

### 3.9 Tipos de desarrollo

| Paquete | Versión |
|---------|---------|
| `@types/react` | ^19.2.14 |
| `@types/react-dom` | ^19.2.3 |

### 3.10 `package.json` del frontend (referencia exacta)

```json
{
  "name": "@admonops/web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "type-check": "tsc -b --noEmit"
  },
  "dependencies": {
    "@azure/msal-browser": "^4.30.0",
    "@tanstack/react-query": "^5.91.3",
    "date-fns": "^4.1.0",
    "echarts": "^6.0.0",
    "echarts-for-react": "^3.0.6",
    "lucide-react": "^0.577.0",
    "react": "^19.2.4",
    "react-day-picker": "^9.14.0",
    "react-dom": "^19.2.4",
    "react-router": "^7.13.1",
    "xlsx": "^0.18.5",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "tailwindcss": "^4.2.2",
    "typescript": "^5.9.3",
    "vite": "^8.0.1"
  }
}
```

---

## 4. Stack Backend

### 4.1 Runtime y lenguaje

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Node.js | >=22 | Runtime en dev y prod |
| TypeScript | 5.9+ (ESM) | Tipado estricto |
| `tsx` | ^4.21.0 | Dev runner (TypeScript sin transpile manual) |

### 4.2 Framework web

| Paquete | Versión | Rol |
|---------|---------|-----|
| `express` | ^5.2.1 | HTTP framework (Express 5, no 4) |
| `@types/express` | ^5.0.6 | Tipos |

> **Importante:** el proyecto usa **Express 5** (no 4 como dice la
> `ESPECIFICACION_TECNICA.md` original — el `package.json` es la fuente de verdad).
> Express 5 tiene mejor soporte async/await y manejo de errores más limpio.

### 4.3 Seguridad y middleware

| Paquete | Versión | Rol |
|---------|---------|-----|
| `helmet` | ^8.1.0 | Headers de seguridad (CSP, HSTS, etc.) |
| `cors` | ^2.8.6 | Gestión de CORS (whitelist por env) |
| `compression` | ^1.8.1 | Compresión gzip/deflate |
| `express-rate-limit` | ^8.3.1 | Rate limiting (default 700 req/10min por IP) |

### 4.4 Auth y validación

| Paquete | Versión | Rol |
|---------|---------|-----|
| `jose` | ^6.2.2 | Validación JWT + fetch de JWKS (Azure AD) |
| `zod` | ^4.3.6 | Validación de payloads (body, query, params) |

### 4.5 ORM y base de datos

| Paquete | Versión | Rol |
|---------|---------|-----|
| `@prisma/client` | ^6.19.2 | Client tipado de Prisma |
| `prisma` (dev) | ^6.19.2 | CLI para migraciones y generación |

### 4.6 Utilidades runtime

| Paquete | Versión | Rol |
|---------|---------|-----|
| `dotenv` | ^17.3.1 | Carga de `.env` |
| `pdfkit` | ^0.18.0 | Generación de PDFs (reportes, folios) |
| `svg-to-pdfkit` | ^0.1.8 | Insertar SVG en PDFs |

### 4.7 Tipos y tooling

| Paquete | Versión |
|---------|---------|
| `@types/node` | ^25.5.0 |
| `@types/compression` | ^1.8.1 |
| `@types/cors` | ^2.8.19 |
| `@types/pdfkit` | ^0.17.5 |

### 4.8 `package.json` del backend (referencia exacta)

```json
{
  "name": "@admonops/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "engines": { "node": ">=22" },
  "dependencies": {
    "@prisma/client": "^6.19.2",
    "compression": "^1.8.1",
    "cors": "^2.8.6",
    "dotenv": "^17.3.1",
    "express": "^5.2.1",
    "express-rate-limit": "^8.3.1",
    "helmet": "^8.1.0",
    "jose": "^6.2.2",
    "pdfkit": "^0.18.0",
    "svg-to-pdfkit": "^0.1.8",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/compression": "^1.8.1",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/node": "^25.5.0",
    "@types/pdfkit": "^0.17.5",
    "prisma": "^6.19.2",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

### 4.9 Cadena de middlewares (orden importa)

Implementada en `src/app.ts`:

```ts
app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(helmet())
app.use(compression())
app.use('/api', rateLimit({ windowMs: 10 * 60 * 1000, max: 700 }))
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(express.json())

app.use('/api', authMiddleware)      // valida JWT o DEV_BYPASS
app.use('/api', centroParser)        // lee header x-centro-id

// Routers específicos de dominio
app.use('/api/auth', authRoutes)
app.use('/api/centros', centrosRoutes)
// ... más routers

app.use(errorHandler)                // manejo centralizado de errores
```

**Regla:** `helmet` primero, `errorHandler` último. Auth antes que cualquier ruta
protegida. `cors` antes de `express.json()`.

---

## 5. Base de datos

### 5.1 Motores soportados

| Entorno | Motor | Provider Prisma | Notas |
|---------|-------|-----------------|-------|
| Desarrollo local | SQLite | `sqlite` | Archivo `.db` en `prisma/dev.db` |
| Producción | SQL Server (Azure SQL) | `sqlserver` | Cambiar provider y `DATABASE_URL` |
| BD externa (opcional, solo lectura) | SQL Server | — | Fuera de Prisma; conexión directa |

### 5.2 Regla de compatibilidad SQLite ↔ SQL Server

Para que el mismo `schema.prisma` funcione en ambos motores **sin migraciones
específicas**, seguir estas convenciones:

1. **Fechas** como `String` (`NVARCHAR(10)`) con formato `YYYY-MM-DD`.
2. **Horas** como `String` (`NVARCHAR(5)`) con formato `HH:MM`.
3. **Timestamps** (`created_at`, `updated_at`) como `DateTime` estándar (Prisma
   los mapea correctamente en ambos).
4. **IDs**: `String` con `@default(uuid())` en desarrollo; en producción SQL Server
   usa `NEWID()` nativo.
5. **Soft delete**: campo `deleted_at DateTime?` en tablas operativas.
6. **Booleans**: Prisma `Boolean` — en SQL Server se traduce a `BIT`.

### 5.3 Migraciones

- Workflow local: `npx prisma migrate dev --name <cambio>`.
- Producción: `npx prisma migrate deploy` (no crea migraciones, solo aplica).
- **Nunca** `prisma db push` en producción. Es destructivo.

### 5.4 Seed

- Script en `prisma/seed.ts`, invocado con `npx prisma db seed`.
- **Idempotente**: usar `upsert` o verificar existencia antes de crear.
- Registrado en `package.json`:
  ```json
  "prisma": { "seed": "tsx prisma/seed.ts" }
  ```

### 5.5 Cambio dev → prod

```diff
 // schema.prisma
 datasource db {
-  provider = "sqlite"
+  provider = "sqlserver"
   url      = env("DATABASE_URL")
 }
```

Y en `.env` de producción:
```env
DATABASE_URL="sqlserver://<host>:1433;database=<db>;user=<user>;password=<pass>;encrypt=true"
```

---

## 6. Autenticación y seguridad

### 6.1 Flujo Azure AD

1. Frontend: `@azure/msal-browser` inicia `loginRedirect`.
2. Azure AD devuelve un `access_token` de OAuth 2.0.
3. El frontend lo guarda y lo envía en cada request como `Authorization: Bearer <token>`.
4. El middleware `auth.ts` del backend:
   - Recupera el token.
   - Obtiene JWKS de Azure AD con `jose`.
   - Valida firma, `iss`, `aud`, expiración.
   - Extrae el email.
   - **Auto-provisiona**: si el email no existe en `usuarios`, lo crea automáticamente.
   - Carga centros/roles/permisos del usuario.
   - Los adjunta a `req.user`.

### 6.2 DEV_BYPASS

Cuando `DEV_BYPASS=true` y `NODE_ENV !== 'production'`, el middleware salta toda la
validación y usa un usuario administrador *hardcodeado* para desarrollo local.
Permite trabajar sin Azure AD configurado.

> **CRÍTICO:** nunca permitir `DEV_BYPASS=true` en producción. El código ya fuerza
> `NODE_ENV !== 'production'` como condición, pero auditar siempre.

### 6.3 RBAC

Modelo de permisos:

```
Usuario → CentroUsuario (N:M con Rol) → Rol → RolPermiso (N:M con Modulo)
```

Cada `RolPermiso` define 4 acciones por módulo: `ver`, `crear`, `editar`, `eliminar`.

- Un usuario `global_admin = true` tiene acceso total sin verificar permisos.
- Middleware `rbac.ts` expone `requirePermiso(modulo, accion)` para proteger rutas:
  ```ts
  router.post('/', requirePermiso('equipos', 'crear'), handler)
  ```

### 6.4 Defensas en capas

| Capa | Mecanismo |
|------|-----------|
| Headers | `helmet()` |
| Rate limit | `express-rate-limit` 700 req / 10 min por IP |
| CORS | Whitelist explícita desde `CORS_ORIGINS` env |
| Validación input | `zod` en `src/schemas/*.ts`, aplicado en cada ruta |
| SQL Injection | Prisma (zero raw queries) |
| XSS | React escapa por default; nunca `dangerouslySetInnerHTML` |
| JWT | Validación contra JWKS (firma asimétrica) |
| Soft delete | Datos operativos nunca se borran físicamente |

---

## 7. Integraciones externas

### 7.1 Microsoft Entra ID (Azure AD)

- Variables: `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_AUDIENCE`.
- Single tenant (tenant corporativo).
- Frontend: `@azure/msal-browser`.
- Backend: `jose` contra JWKS endpoint de Microsoft.

### 7.2 Azure Blob Storage (opcional)

Para el módulo QHSE (documentos, fotos, evidencias):
- SDK sugerido: `@azure/storage-blob` en el backend.
- Connection string vía env `AZURE_STORAGE_CONNECTION`.
- El frontend **no** accede al blob directamente — el backend firma URLs SAS con TTL
  corto.

### 7.3 BD externa SQL Server (opcional)

Para módulos que leen datos operativos de un sistema legado (E/S de producto):
- Connection string vía env `EXTERNAL_DB_URL`.
- **Solo lectura**.
- Queries parametrizados siempre (SQL Injection).
- Filtrado por `IDCentro` activo.
- NO se copian a la BD local; se consultan en tiempo real con timeouts cortos.

### 7.4 SAP (futuro)

- Pipeline sugerido: Azure Data Factory → tabla staging en la BD local.
- Refresh programado (p. ej. horario).
- Campos del dominio: `stock_sap` viene de SAP; `stock_fisico` es editable local.

---

## 8. Estructura de monorepo

### 8.1 Layout

```
<root>/
├── package.json               ← workspaces + scripts agregados
├── .gitignore
├── README.md
├── CLAUDE.md                  ← instrucciones para Claude
├── DESIGN_SYSTEM.md           ← sistema visual
├── TECH_STACK.md              ← este archivo
├── ESPECIFICACION_TECNICA.md  ← spec funcional del dominio (opcional)
│
├── api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                   ← NO commitear
│   ├── .env.example           ← plantilla
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   ├── seed.ts
│   │   └── seed-data/
│   └── src/
│       ├── index.ts           ← bootstrap del server
│       ├── app.ts             ← Express app + middleware chain
│       ├── config.ts          ← lectura centralizada de env
│       ├── prisma.ts          ← instancia singleton de PrismaClient
│       ├── types.d.ts         ← augmentación global de tipos
│       ├── middleware/
│       │   ├── auth.ts
│       │   ├── centro.ts
│       │   ├── rbac.ts
│       │   └── error.ts
│       ├── routes/            ← un archivo por dominio
│       ├── schemas/           ← validadores zod
│       ├── services/          ← lógica de negocio
│       └── utils/
│
└── web/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── index.html
    ├── public/                ← assets estáticos (logos, SVGs)
    └── src/
        ├── main.tsx
        ├── App.tsx            ← router + QueryClient
        ├── styles.css         ← @theme (design tokens)
        ├── auth/
        ├── api/               ← client.ts + hooks
        ├── store/             ← Zustand
        ├── lib/               ← types.ts + utils
        ├── components/
        │   ├── layout/
        │   ├── ui/            ← primitivas
        │   └── icons/
        └── modules/           ← features
```

### 8.2 `package.json` raíz (workspaces)

```json
{
  "name": "<tu-proyecto>",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["api", "web"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w api\" \"npm run dev -w web\"",
    "dev:api": "npm run dev -w api",
    "dev:web": "npm run dev -w web",
    "build": "npm run build -w api && npm run build -w web",
    "db:generate": "npm run db:generate -w api",
    "db:push": "npm run db:push -w api",
    "db:seed": "npm run db:seed -w api"
  },
  "devDependencies": {
    "concurrently": "^9.1.2"
  },
  "engines": { "node": ">=22" }
}
```

---

## 9. Variables de entorno

### 9.1 `api/.env.example`

```env
# ─── Base de datos ──────────────────────────────────────
# Desarrollo local (SQLite)
DATABASE_URL="file:./dev.db"

# Producción (SQL Server Azure) — ejemplo:
# DATABASE_URL="sqlserver://host.database.windows.net:1433;database=admonops;user=admin;password=***;encrypt=true"

# ─── Autenticación Microsoft Entra ID ───────────────────
AZURE_AD_TENANT_ID=
AZURE_AD_CLIENT_ID=
AZURE_AD_AUDIENCE=

# Saltar auth en desarrollo (NUNCA en producción)
DEV_BYPASS=true
NODE_ENV=development

# ─── Servidor ───────────────────────────────────────────
PORT=3001

# Lista blanca de orígenes CORS (separados por coma)
CORS_ORIGINS=http://localhost:5173

# ─── Integraciones opcionales ───────────────────────────
# Azure Blob Storage
# AZURE_STORAGE_CONNECTION=

# BD externa de solo lectura
# EXTERNAL_DB_URL=
```

### 9.2 `web/.env.example` (si se decide usar envs también en el front)

```env
# URL del backend (en dev normalmente no se usa gracias al proxy de Vite)
VITE_API_BASE_URL=http://localhost:3001

# MSAL / Azure AD
VITE_AZURE_CLIENT_ID=
VITE_AZURE_TENANT_ID=
VITE_AZURE_REDIRECT_URI=http://localhost:5173
```

> Las vars del frontend **deben** prefijarse con `VITE_` para que Vite las exponga
> al bundle. Nunca pongas secretos ahí — todo lo del frontend es público.

### 9.3 `.gitignore` mínimo

```
node_modules
dist
build
.env
.env.*
!.env.example
*.db
*.db-journal
.vite
coverage
.DS_Store
```

---

## 10. Configuraciones canónicas

### 10.1 `api/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": false,
    "sourceMap": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "prisma"]
}
```

### 10.2 `web/vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) return 'react-vendor'
            if (id.includes('echarts')) return 'charts-vendor'
            if (id.includes('@tanstack/react-query') || id.includes('zustand')) return 'data-vendor'
            if (id.includes('date-fns') || id.includes('react-day-picker')) return 'date-vendor'
            if (id.includes('xlsx')) return 'xlsx-vendor'
            if (id.includes('@azure/msal-browser')) return 'msal-vendor'
          }
          return undefined
        },
      },
    },
  },
})
```

### 10.3 `web/index.html` (mínimo)

Debe importar las fuentes **DM Sans** y **JetBrains Mono**:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AdmonOps</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 10.4 `api/prisma/schema.prisma` (cabecera canónica)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### 10.5 `src/prisma.ts` (singleton Prisma Client)

```ts
import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
```

### 10.6 `src/config.ts` (lectura centralizada de env)

```ts
import 'dotenv/config'

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  devBypass:
    process.env.DEV_BYPASS === 'true' &&
    process.env.NODE_ENV !== 'production',
  azure: {
    tenantId: process.env.AZURE_AD_TENANT_ID ?? '',
    clientId: process.env.AZURE_AD_CLIENT_ID ?? '',
    audience: process.env.AZURE_AD_AUDIENCE ?? '',
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
}
```

---

## 11. Bootstrap desde cero — paso a paso

Estos son los comandos exactos para crear un proyecto nuevo con este stack,
desde una carpeta vacía.

### 11.1 Inicializar el monorepo

```bash
mkdir mi-proyecto && cd mi-proyecto
git init
npm init -y
```

Luego editar `package.json` raíz para agregar `"workspaces": ["api", "web"]`,
el `"type": "module"`, y los scripts agregados (ver §8.2). Instalar `concurrently`:

```bash
npm install -D concurrently
```

### 11.2 Backend

```bash
mkdir -p api/src/{middleware,routes,schemas,services,utils} api/prisma
cd api
npm init -y
# Editar api/package.json: name, type: "module", scripts (ver §4.8)

# Dependencias runtime
npm install @prisma/client compression cors dotenv express express-rate-limit helmet jose pdfkit svg-to-pdfkit zod

# Dev dependencies
npm install -D @types/compression @types/cors @types/express @types/node @types/pdfkit prisma tsx typescript

# TypeScript config
npx tsc --init
# Reemplazar con el tsconfig.json de §10.1

# Inicializar Prisma
npx prisma init --datasource-provider sqlite
# Editar prisma/schema.prisma con el modelo del dominio

# Primer migration
npx prisma migrate dev --name initial

# Crear .env a partir de .env.example
cp .env.example .env

cd ..
```

### 11.3 Frontend

```bash
cd mi-proyecto
npm create vite@latest web -- --template react-ts
cd web

# Reemplazar las dependencies del package.json con las de §3.10
# O instalar manualmente:
npm install @azure/msal-browser @tanstack/react-query date-fns echarts echarts-for-react lucide-react react-day-picker react-router xlsx zustand
npm install -D @tailwindcss/vite tailwindcss

# Reemplazar vite.config.ts con el de §10.2
# Reemplazar index.html con el de §10.3
# Crear src/styles.css con el @theme del DESIGN_SYSTEM.md §3.1-3.2
# Importar styles.css desde main.tsx:
#   import './styles.css'

cd ..
```

### 11.4 Primer arranque

```bash
# Desde la raíz
npm install  # instala workspaces

# DB
npm run db:generate
npx prisma migrate dev -w api
npm run db:seed

# Dev
npm run dev
# Frontend: http://localhost:5173
# API:      http://localhost:3001
```

### 11.5 Verificación

- [ ] `http://localhost:5173` carga la SPA sin errores.
- [ ] El navegador hace `GET /api/...` y el proxy funciona.
- [ ] En consola del backend aparecen logs de requests.
- [ ] `npx prisma studio -w api` abre el explorador de BD.
- [ ] `npm run type-check` pasa en ambos workspaces.

---

## 12. Scripts de npm

### 12.1 Desde la raíz

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Arranca API y Web en paralelo |
| `npm run dev:api` | Solo API |
| `npm run dev:web` | Solo Web |
| `npm run build` | Build de producción de ambos |
| `npm run db:generate` | Regenera Prisma Client |
| `npm run db:push` | Sincroniza schema sin crear migración (solo dev) |
| `npm run db:seed` | Ejecuta `prisma/seed.ts` |

### 12.2 Desde `api/`

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | `tsx watch src/index.ts` — hot reload |
| `npm run build` | `tsc` — compila a `dist/` |
| `npm run start` | `node dist/index.js` — ejecuta el build |
| `npm run type-check` | `tsc --noEmit` |
| `npx prisma migrate dev --name <cambio>` | Nueva migración + aplicar |
| `npx prisma migrate deploy` | Aplicar migraciones en producción |
| `npx prisma studio` | UI web para explorar la BD |

### 12.3 Desde `web/`

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | `vite` — dev server con HMR |
| `npm run build` | `tsc -b && vite build` — type-check + bundle |
| `npm run preview` | `vite preview` — sirve el build localmente |
| `npm run type-check` | `tsc -b --noEmit` |

---

## 13. Prisma — workflow completo

### 13.1 Cambio de schema (dev)

```bash
# 1. Editar prisma/schema.prisma
# 2. Crear migración y aplicarla:
npx prisma migrate dev --name agregar_campo_x
# 3. Prisma Client se regenera automáticamente
```

### 13.2 Sincronizar sin migrar (prototipo rápido)

```bash
npx prisma db push
# No crea archivo de migración. Útil solo en prototipos muy tempranos.
```

### 13.3 Aplicar migraciones en producción

```bash
# En el servidor o pipeline CI/CD
npx prisma migrate deploy
```

### 13.4 Reset completo (dev)

```bash
npx prisma migrate reset
# Borra la BD, recrea schema, ejecuta seed automáticamente
```

### 13.5 Inspeccionar BD

```bash
npx prisma studio
# Abre http://localhost:5555
```

### 13.6 Cambio a SQL Server (producción)

1. Cambiar en `schema.prisma`:
   ```prisma
   datasource db { provider = "sqlserver" ... }
   ```
2. Actualizar `DATABASE_URL` en `.env` de producción.
3. `npx prisma migrate deploy`.
4. `npx prisma db seed` (si aplica).

> **Crítico:** verificar que los tipos usados son compatibles con SQL Server.
> Las reglas de §5.2 garantizan compatibilidad.

---

## 14. Producción y despliegue

### 14.1 Build

```bash
# Raíz
npm run build
```

Genera:
- `api/dist/` — JS compilado (ejecutar con `node dist/index.js`).
- `web/dist/` — assets estáticos (HTML, JS, CSS, SVGs).

### 14.2 Opciones de despliegue

| Componente | Opciones recomendadas |
|------------|-----------------------|
| **API** | Azure App Service (Node 22), Azure Container Apps, o un VPS con PM2 |
| **Frontend** | Azure Static Web Apps, Vercel, Netlify, o Nginx sirviendo `web/dist` |
| **DB** | Azure SQL Database (Single Database o Elastic Pool) |
| **Blob** | Azure Blob Storage |
| **Secrets** | Azure Key Vault (referenciado desde App Service) |

### 14.3 Variables de entorno en producción

Configurar en el servicio (App Service, Container Apps, etc.):

- `NODE_ENV=production`
- `DEV_BYPASS=false` (o simplemente no definir)
- `DATABASE_URL=sqlserver://...`
- `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_AUDIENCE`
- `CORS_ORIGINS=https://mi-app.dominio.com` (sin wildcard, sin `localhost`)
- `PORT` (normalmente lo define el PaaS)

### 14.4 Hardening adicional en producción

- [ ] Certificado HTTPS obligatorio (lo provee el PaaS o Cloudflare).
- [ ] `helmet` activo (ya lo está por default).
- [ ] Revisar `Content-Security-Policy` si hay assets externos.
- [ ] Deshabilitar `DEV_BYPASS`.
- [ ] Logs estructurados a Azure Monitor / Application Insights.
- [ ] Backups automáticos de la BD (Azure SQL: point-in-time restore).
- [ ] Alertas de uso anómalo (rate-limit excedido, errores 5xx).

---

## 15. Observabilidad y mantenimiento

### 15.1 Logs recomendados

- Agregar `pino` o `winston` al backend (no incluido por defecto en este stack —
  evaluar al crecer).
- Cada request: método, path, status, duración, user email.
- Errores: stack trace completo en logs del servidor, mensaje genérico al cliente.

### 15.2 Métricas

- Endpoint `/api/health` simple que devuelva `{ ok: true, db: 'ok' }` tras un
  `prisma.$queryRaw` trivial.
- Integrar con Azure Application Insights o equivalente.

### 15.3 Actualizaciones de dependencias

- Ejecutar `npm outdated` periódicamente.
- Major bumps de React, Express, Prisma, Vite: leer changelog, probar en rama.
- `npm audit` antes de cada release. Las vulnerabilidades de `xlsx` son conocidas —
  documentar cualquier excepción aceptada.

---

## 16. Matriz de decisiones

| Necesidad | Elección de este stack | Por qué |
|-----------|------------------------|---------|
| UI framework | React 19 | Ecosistema maduro, concurrent rendering, server components disponibles a futuro |
| Build tool | Vite 8 | Dev server instantáneo, build con Rollup, plugin ecosystem |
| CSS | TailwindCSS 4 | Velocidad de desarrollo, design tokens en CSS nativo, sin postcss config |
| State servidor | React Query 5 | Cache declarativo, invalidación automática, mejor que redux-toolkit para datos remotos |
| State global | Zustand 5 | API mínima, sin boilerplate, TypeScript-friendly |
| Routing | React Router 7 | De facto en React, soporte completo de lazy + Suspense |
| Gráficas | ECharts 6 | Amplio, performante, gauges/sankey/treemap sin esfuerzo |
| Iconos | Lucide | Tree-shakeable, consistente, stroke uniforme |
| HTTP server | Express 5 | Madurez + async/await nativo; más simple que Fastify para este tamaño |
| ORM | Prisma 6 | Schema-first, tipos auto-generados, migraciones serias, multi-DB |
| DB dev | SQLite | Zero setup, commit-friendly para datos de ejemplo |
| DB prod | SQL Server Azure | Compatibilidad con ecosistema Microsoft existente |
| Validación | zod 4 | Schemas runtime + tipos derivados, cero duplicación |
| Auth | Azure AD + jose | SSO corporativo, JWT estándar, JWKS validation |
| Fechas | date-fns 4 | Tree-shakeable, immutable, locale `es` oficial |
| PDFs | pdfkit | Control total del output, sin dependencias de Chromium |
| Excel | SheetJS (xlsx) | Estándar de facto; migrar a `exceljs` si se requiere fix de CVE |

---

## Apéndice — Comandos de emergencia

```bash
# La BD dev está rota — resetear todo
cd api && npx prisma migrate reset

# Prisma Client desincronizado tras pull
cd api && npx prisma generate

# Puerto 3001 o 5173 ocupado (Windows)
netstat -ano | findstr :3001
taskkill /PID <pid> /F

# Limpiar node_modules de todo el monorepo
rm -rf node_modules api/node_modules web/node_modules
npm install

# Rebuild completo desde cero
npm run build

# Ver qué dependencias están desactualizadas
npm outdated --workspaces

# Auditar seguridad
npm audit --workspaces
```

---

**Fin del documento.**

Este archivo describe **el stack**. El archivo `DESIGN_SYSTEM.md` describe **el
sistema visual**. Ambos son autosuficientes: con sólo estos dos `.md` y las
instrucciones en `CLAUDE.md`, un desarrollador o una instancia de Claude puede
bootstrappar un proyecto nuevo con la misma arquitectura y apariencia que
AdmonOpsPlatform.