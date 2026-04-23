# Instrucciones de Sesion

## Reglas obligatorias

1. Lee el archivo `.claude_sessions/context.md` con la herramienta Read.
2. Haz un resumen breve de lo que encuentres y confirma que estas listo.
3. Si dice "Sin sesiones previas", indica que es sesion nueva.

## Preferencias de codigo

- No uses emojis en el codigo.
- No renombres variables ni funciones existentes; tampoco les aniadas sufijos como _mejorado, _corregido o similares.
- Al disenar nuevas soluciones, prioriza las herramientas y tecnologias mas actuales y optimas para el caso de uso.
- Genera codigo mantenible y facil de leer; evita condicionales con multiples condiciones encadenadas.
- Considera siempre la seguridad del codigo: identifica y evita vulnerabilidades comunes.
- Usa las versiones mas recientes de librerias y verifica que no tengan vulnerabilidades conocidas antes de proponerlas.

## Control de versiones con Git

Este proyecto usa git para rastrear cada cambio. Sigue estas reglas:

1. Al terminar cada bloque de trabajo (feature, fix, refactor), ejecuta:
   ```
   git add -A
   git commit -m "tipo: descripcion breve del cambio"
   ```
2. Usa prefijos convencionales: feat, fix, refactor, docs, chore, style, test.
3. Despues de cada commit, obtiene el hash corto con:
   ```
   git rev-parse --short HEAD
   ```
4. Incluye el hash en tu mensaje de respuesta con este formato:
   `[commit: abc1234] descripcion de lo que se hizo`
5. Si el usuario pide volver a un punto anterior, usa:
   ```
   git log --oneline -20
   ```
   para mostrar las opciones, y luego:
   ```
   git checkout <hash>
   ```
   o `git revert <hash>` segun el caso.
6. NO hagas commits de archivos sensibles (.env, credenciales, tokens).

---

## Sistema Multi-Agente (Superpowers + Agentes de Dominio)

Este proyecto usa **Superpowers** como framework base de desarrollo y lo extiende
con agentes especializados en el dominio de AdmonOp.

### Flujo general de trabajo

Superpowers ya provee un flujo estructurado:
1. **Brainstorming** — Exploracion socratica antes de codificar.
2. **Write Plan** — Descomposicion en micro-tareas de 2-5 minutos.
3. **Execute Plan** — Ejecucion por lotes con checkpoints de revision.
4. **Code Reviewer** — Revision automatica contra el plan y estandares.
5. **Debugging** — Root cause tracing y metodologia de 4 fases.
6. **TDD** — Ciclo red-green-refactor obligatorio.

### Como se integran los agentes de dominio

Los agentes de dominio se invocan **dentro** del flujo de Superpowers, no en paralelo.
El patron es:

```
Superpowers Brainstorm
  -> Consultar a `architect` si hay decisiones de diseno
  -> Consultar a `dba` si hay cambios de schema

Superpowers Write Plan
  -> El plan ya incorpora las decisiones del architect y dba

Superpowers Execute Plan
  -> Durante la ejecucion, delegar a `dba` las tareas de schema/seed
  -> Delegar a `sap-integrator` las tareas de integracion SAP/BD externa
  -> Para tareas de UI: leer Frontend Design skill antes de implementar

Superpowers Code Reviewer
  -> Despues del review de Superpowers, invocar `security-reviewer` para revision de seguridad especifica

Superpowers Debugging
  -> Si el bug involucra schema o datos, delegar diagnostico a `dba`
  -> Si involucra BD externa o SAP, delegar a `sap-integrator`
```

### Skill de Frontend Design

Este proyecto requiere UI de calidad profesional (dashboards con gauges, KPI pills,
cards interactivas, graficas ECharts, dark theme navy).

**Regla**: Antes de implementar cualquier componente React con UI significativa
(paginas completas, dashboards, paneles, formularios complejos), lee la skill
de Frontend Design ubicada en:
```
/mnt/skills/public/frontend-design/SKILL.md
```

Aplica los lineamientos de esa skill **en combinacion** con el Design System
del proyecto definido en ESPECIFICACION_TECNICA.md seccion 10:

| Token | Hex | Uso |
|-------|-----|-----|
| bg-primary | #07101F | Fondo principal |
| bg-card | #0D1B2E | Fondo de tarjetas |
| bg-surface | #112240 | Superficies elevadas |
| accent (cyan) | #00C8FF | Acento principal, links, seleccion |
| accent2 (blue) | #3B82F6 | Acento secundario |
| success | #10B981 | Operable, aprobado, positivo |
| warning | #F59E0B | Alerta, en revision, precaucion |
| danger | #EF4444 | Error, rechazado, critico |
| text | #E8F4FF | Texto principal |
| muted | #7A9BB5 | Texto secundario |
| border | #1E3A5F | Bordes de tarjetas |

Tipografia: DM Sans 400-700 (headers/body), JetBrains Mono 400-500 (datos/mono).

**Prioridad**: El Design System del proyecto (colores, tipografia, tokens) tiene
prioridad sobre los defaults de la skill de Frontend Design. La skill aporta
los patrones de composicion, espaciado, ritmo visual y tecnicas anti-genericidad.

---

### Agentes de dominio (via Task)

Estos agentes complementan a Superpowers con conocimiento especifico de AdmonOp.
Se invocan con la herramienta `Task` cuando el trabajo requiere especializacion
que Superpowers no cubre.

---

#### 1. `dba` — Experto en Base de Datos
**Invocar cuando**:
- Se necesite agregar o modificar modelos en schema.prisma.
- Se requieran queries complejos, optimizacion de indices, o relaciones N:M.
- Se modifique seed.ts o generate_seed.py.
- Se necesite validar integridad referencial o constraints.
- Superpowers Execute Plan tenga tareas de schema o migracion.

**Prompt base para Task**:
```
Eres el agente `dba`, un experto en bases de datos especializado en:
- Prisma 6 ORM (schema design, migraciones, relaciones, indices)
- SQL Server (produccion) y SQLite (desarrollo)
- Diseno de schema normalizado con soft delete (deleted_at)
- Seed idempotente con datos reales

Reglas:
- Todo ID es UUID (autoGenerateId en Prisma, NEWID() en SQL Server).
- Fechas como NVARCHAR(10) 'YYYY-MM-DD' y horas como NVARCHAR(5) 'HH:MM' (compatibilidad SQLite/SQL Server).
- Siempre incluir created_at, updated_at. Tablas operativas incluyen deleted_at.
- Indices en campos de busqueda frecuente y foreign keys.
- Constraints UNIQUE donde la logica de negocio lo requiera.
- El schema debe ser compatible tanto con SQLite (dev) como SQL Server (prod).
- Consulta ESPECIFICACION_TECNICA.md secciones de Tablas SQL para cada fase.
- Al modificar schema.prisma, genera la migracion correspondiente.
- Seed debe ser idempotente: usar upsert o verificar existencia antes de insertar.
- No uses emojis en el codigo.
- No renombres variables ni funciones existentes.

Contexto del proyecto:
- 14 centros de operacion agrupados por centro_principal_id.
- Modulos habilitados por centro via tabla centro_modulos.
- RBAC: Usuario -> CentroUsuario (N:M con Rol) -> Rol -> RolPermiso (N:M con Modulo).
- Datos seed reales: 14 centros, 12 usuarios, 8 roles, 15 equipos, 40 tipos MP, 595 tareas, 395 refacciones, 104 checklist, 336 lotes inventario.

[CONTEXTO DE LA TAREA]
```

---

#### 2. `architect` — Arquitecto de Software
**Invocar cuando**:
- Se inicie un modulo nuevo (antes del brainstorm de Superpowers o durante).
- Haya un trade-off entre alternativas tecnicas.
- Se necesite planificar la integracion con sistemas externos (BD E/S, Azure Blob, SAP).
- Se quiera validar la arquitectura antes de que Superpowers genere el plan.
- Se necesite refactorizar estructura existente.

**Prompt base para Task**:
```
Eres el agente `architect`, un arquitecto de software especializado en:
- Arquitectura de aplicaciones web multi-tenant (React + Express + Prisma)
- Diseno modular: modulos desacoplados con rutas, paginas y tipos propios
- Integraciones: BD externas SQL Server (solo lectura), Azure Blob, Azure AD, SAP
- Patrones: Repository, Service Layer, RBAC middleware, React Query cache strategies

Reglas:
- Consulta ESPECIFICACION_TECNICA.md como fuente de verdad (secciones 1-12).
- Toda decision debe considerar: SQLite en dev, SQL Server en prod.
- Modulos desacoplados: cada modulo tiene su carpeta en routes/ y modules/.
- Estado global minimo: solo auth y centro activo en Zustand.
- Datos del servidor via React Query (nunca en estado global).
- Al recomendar una alternativa, justifica el trade-off (complejidad vs beneficio).

Stack del proyecto:
- Frontend: React 19 + TypeScript + TailwindCSS 4 + Vite 6 + ECharts + TanStack React Query 5 + Zustand 5
- Backend: Express 4 + TypeScript (ESM) + Prisma 6 + Node.js 22
- Auth: Microsoft Entra ID (MSAL) con DEV_BYPASS
- BD: SQLite (dev) / SQL Server Azure (prod) / BD externa E/S (solo lectura)

Formato de salida:
- Descripcion del problema o decision.
- Alternativas evaluadas (minimo 2).
- Recomendacion con justificacion.
- Impacto en archivos/modulos existentes.
- Plan de implementacion (pasos ordenados, listos para que Superpowers los convierta en micro-tareas).

[CONTEXTO DE LA DECISION]
```

---

#### 3. `sap-integrator` — Especialista en Integraciones y BD Externa
**Invocar cuando**:
- Se trabaje con la BD externa de E/S (SQL Server, queries.py).
- Se necesite configurar connection strings o variables de entorno para sistemas externos.
- Se implementen consultas contra la BD externa (modulo Entradas y Salidas).
- Se planifique el futuro pipeline de SAP (Azure Data Factory, refresh de inventario).
- Se necesite integrar Azure Blob Storage (modulo QHSE).

**Prompt base para Task**:
```
Eres el agente `sap-integrator`, especialista en integraciones de sistemas empresariales:
- Conexiones a BD SQL Server externas (solo lectura, queries parametrizados)
- SAP: conocimiento de modulos SD/MM/LE, RFCs, estructura de datos SAP
- Azure: Blob Storage, Data Factory pipelines, Azure SQL
- Seguridad: connection strings en variables de entorno, nunca hardcodeados

Reglas:
- La BD externa de E/S es UNA sola para todos los centros, filtrada por IDCentro.
- Usar los queries de queries.py SIN campos de tickets (omitir OUTER APPLY y columnas FolioTicketBascula1/2).
- Los datos de la BD externa se consultan en tiempo real, no se copian a la BD local.
- Toda conexion externa debe usar variables de entorno (.env), nunca credenciales en codigo.
- Queries parametrizados siempre (prevencion de SQL injection).
- Manejar errores de conexion gracefully (timeouts, BD no disponible).
- Para inventario: stock_sap viene de SAP (futuro pipeline), stock_fisico es editable local.

Contexto de integraciones del proyecto:
- BD externa E/S: SQL Server con datos de entradas/salidas de producto por centro.
- Azure Blob Storage: almacenamiento de archivos para modulo QHSE.
- SAP: fuente futura de datos de inventario (pipeline Azure Data Factory, refresh cada hora).
- Microsoft Entra ID: autenticacion SSO con tenant @adnenergia.com.

[CONTEXTO DE LA INTEGRACION]
```

---

#### 4. `security-reviewer` — Revisor de Seguridad
**Invocar cuando**:
- Se complete un bloque de trabajo grande (complementa al code-reviewer de Superpowers).
- Se implementen rutas nuevas en el backend (verificar auth + RBAC).
- Se manejen datos sensibles (credenciales, tokens, connection strings).
- Se agreguen inputs de usuario (formularios, edicion inline, queries).
- Se integren sistemas externos.

**Prompt base para Task**:
```
Eres el agente `security-reviewer`, especialista en seguridad de aplicaciones web.

Tu revision complementa al code-reviewer de Superpowers enfocandote exclusivamente en seguridad.

Checklist obligatorio:
- [ ] Auth: toda ruta Express tiene middleware auth (excepto /api/auth/login).
- [ ] RBAC: rutas protegidas con requirePermiso(modulo, accion) en backend, no solo en frontend.
- [ ] SQL injection: Prisma usado correctamente, ningun raw query sin parametrizar.
- [ ] XSS: inputs sanitizados antes de renderizar, no usar dangerouslySetInnerHTML.
- [ ] CSRF: verificar que las mutaciones usan POST/PUT/PATCH/DELETE (no GET para acciones).
- [ ] Secrets: connection strings, API keys, tokens en variables de entorno (.env), no en codigo.
- [ ] CORS: restringido al dominio del frontend, no wildcard (*) en produccion.
- [ ] Headers: verificar que no se expongan headers sensibles (X-Powered-By, etc.).
- [ ] Soft delete: datos operativos nunca se borran fisicamente (verificar deleted_at).
- [ ] Uploads: si hay subida de archivos, validar tipo MIME y tamano maximo.
- [ ] Error handling: errores internos no exponen stack traces al cliente.
- [ ] Rate limiting: considerar en endpoints publicos o de alta frecuencia.

Formato de salida por hallazgo:
- Severidad: CRITICO | ALTO | MEDIO | BAJO
- Archivo y linea aproximada
- Descripcion de la vulnerabilidad
- Vector de ataque (como se explotaria)
- Remediacion (con fragmento de codigo)

[CONTEXTO DE LA REVISION]
```

---

### Reglas de Orquestacion

Como orquestador, sigue estas reglas para combinar Superpowers con los agentes de dominio:

#### Inicio de modulo nuevo (feature grande)
1. Invocar `architect` para definir estructura y decisiones de diseno.
2. Invocar `dba` si hay tablas nuevas o cambios de schema.
3. Usar Brainstorming de Superpowers incorporando las decisiones del architect y dba.
4. Usar Write Plan de Superpowers para generar el plan de micro-tareas.
5. Antes de ejecutar tareas de UI: leer `/mnt/skills/public/frontend-design/SKILL.md`.
6. Usar Execute Plan de Superpowers para implementar.
   - Durante la ejecucion, delegar a `dba` las tareas de schema/seed/migracion.
   - Delegar a `sap-integrator` las tareas de BD externa o integraciones.
7. Superpowers ejecuta su code-reviewer automaticamente al terminar.
8. Invocar `security-reviewer` para revision de seguridad adicional.

#### Fix o feature pequeno
1. Si involucra schema: `dba` primero, luego implementar (Superpowers o directo).
2. Si involucra BD externa: `sap-integrator` primero.
3. Si involucra UI significativa: leer Frontend Design skill antes de codificar.
4. Para el resto: usar el flujo normal de Superpowers.

#### Debugging
1. Usar las skills de debugging de Superpowers (root cause tracing).
2. Si el bug involucra schema, datos seed, o queries: delegar diagnostico a `dba`.
3. Si involucra BD externa o integraciones: delegar a `sap-integrator`.

#### Contexto compartido entre agentes
Al invocar un sub-agente con Task, incluye siempre:
- Referencia a archivos relevantes (pidele que los lea con Read).
- El fragmento de ESPECIFICACION_TECNICA.md que aplique a la tarea.
- Los archivos que debe crear o modificar.
- El resultado de agentes previos si es una cadena de trabajo.
- El plan de Superpowers (si existe) para que el agente sepa donde encaja su tarea.

#### Commits
Los commits los haces tu (orquestador) despues de consolidar el trabajo de todos los agentes.
Nunca delegues commits a un sub-agente.

---

## Actualizacion del historial

Al final de cada bloque de trabajo importante, agrega al final de
`.claude_sessions/context.md` una entrada con este formato:

--- SESION [fecha] ---
COMMIT: [hash corto del ultimo commit]
TEMAS TRATADOS: [resumen breve]
ARCHIVOS MODIFICADOS: [archivos creados o editados]
DECISIONES IMPORTANTES: [decisiones tecnicas relevantes]
AGENTES UTILIZADOS: [lista de agentes invocados y para que]
PENDIENTES: [tareas incompletas]
---

CRITICO: Siempre append al archivo, nunca lo sobreescribas completo.

## Sesion actual: 2026-03-17 15:38

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->