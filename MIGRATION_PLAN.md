# Plan de migración: formularios-web → AdmonOps · Entradas y Salidas · Formularios PowerApp

> **Audiencia**: la instancia de Claude que trabaja sobre el repo `admon-ops-platform`.
> **Repositorio fuente** (este, solo lectura): https://github.com/acasillas-05/formularios-web
> **Cómo lo lees desde el otro VSCode**: si seguiste las instrucciones, este repo está clonado paralelo al tuyo en `../formularios-web-ref/` (mismo nivel que `admon-ops-platform/`).

Todos los caminos `formularios-web/...` o `web/...` o `api/...` que aparezcan en este documento se refieren al repo de referencia (clonado en `../formularios-web-ref/`), no al de AdmonOps.

---

## 1. Contexto

El equipo de Operaciones ADN tiene 11 formularios alojados en Microsoft Forms cuyas respuestas dispara Power Automate y termina en stored procedures de **BDADN** (Azure SQL). Esa funcionalidad ya está reimplementada como una plataforma propia (este repo) que reemplaza Forms + Power Automate. Ahora se va a integrar como **submódulo dentro de AdmonOps** (la plataforma operativa principal).

### Decisiones del jefe (transcript)

1. Crear dos submódulos dentro del módulo `Entradas y Salidas`:
   - `Reportes` — placeholder con el mismo "modulo en desarrollo" que ya tiene Entradas y Salidas hoy.
   - `Formularios PowerApp` — toda la funcionalidad de los 11 forms.
2. Reorganizar los 11 forms por **tipo de flete**, no por la dicotomía actual `transportista-adn` / `transportista-cliente`.
3. **Cambiar el modelo de permisos de AdmonOps** de "módulo + ver/crear/editar/eliminar" a un árbol de tres niveles:
   - Nivel 1: módulo (lo que ya existe)
   - Nivel 2: submódulo (nuevo, para todos los módulos en general; pero solo se implementa lo necesario para Entradas y Salidas en esta migración)
   - Nivel 3: formulario individual (nuevo, **solo se implementa para Entradas y Salidas → Formularios PowerApp** según instrucción explícita del jefe; otros módulos quedan con 2 niveles).
4. Los permisos siguen siendo **por rol** (no por usuario como en formularios-web). El admin edita el rol y marca los checkboxes que corresponden.
5. Mantener auditoría, dashboard, notificaciones, FormRenderer declarativo, executeAndAudit, mssql pool, los 9 SPs y catálogos dinámicos. Aprovechar el selector global de centro de AdmonOps cuando aplique.

---

## 2. Diferencias clave entre los dos proyectos

| | formularios-web | AdmonOps |
|---|---|---|
| Usuario.id | `String` UUID | `Int autoincrement` |
| Centro | No existe | `BigInt @id`, multi-centro real con selector global |
| Permisos | Por usuario individual (`UsuarioFormPermiso`) | Por **rol** (`RolPermiso`) — 1 nivel (módulo) con 4 acciones |
| Roles | 3 hardcoded en código (administrador / jefe_de_patio / operativo) | Tabla `Rol` mutable; ya tiene Admin, Auxiliar Centro, Dirección, Gerente, Jefe Centro, Líder Ambiental/Calidad/Mantenimiento |
| Auth | Entra ID con `DEV_BYPASS` | Entra ID, mismo tenant `@adnenergia.com` |
| Schema | 4 modelos: `Usuario`, `UsuarioFormPermiso`, `SubmissionLog`, `NotificationQueue` | Schema grande con muchos módulos ya implementados |
| Sidebar/Layout/Header | Propios | Ya existen en AdmonOps; los suyos ganan |

**Implicación**: NO se copia el shell (Sidebar/Header/PlatformLayout/AuthGuard). Los 11 forms entran como submódulo y reusan el shell existente.

---

## 3. Arquitectura objetivo

```
admon-ops-platform/
├── api/
│   ├── prisma/
│   │   ├── schema.prisma              ← se EXTIENDE (nuevos modelos + relaciones)
│   │   ├── migrations/                ← migración nueva: extiende permisos + agrega forms log/queue
│   │   └── seed/                      ← seed de submódulos + forms
│   └── src/
│       ├── modules/
│       │   └── entradas-salidas/      ← NUEVO (módulo nuevo de AdmonOps)
│       │       ├── routes.ts          ← /api/entradas-salidas/...
│       │       └── formularios/      ← submódulo Formularios PowerApp
│       │           ├── routes.ts      ← /forms (list), /forms/:slug, /forms/:slug/submit, /catalogos/:tipo
│       │           ├── definitions/   ← 11 FormDefinition (copia adaptada)
│       │           ├── registry.ts    ← registry con subgrupos por tipo de flete
│       │           ├── engine.ts      ← copia tal cual de formularios-web
│       │           ├── catalogos.ts   ← copia tal cual
│       │           ├── spRunner.ts    ← copia tal cual (si AdmonOps no tiene driver mssql ya, agregar)
│       │           ├── auditService.ts← adaptado (FormSubmissionLog en vez de SubmissionLog)
│       │           └── notifyService.ts← adaptado (FormNotificationQueue + worker)
│       ├── middleware/
│       │   └── permissions.ts          ← se EXTIENDE: cascada módulo→submódulo→form
│       └── routes/
│           └── admin/                  ← se EXTIENDE para CRUD de submódulo y form-permisos
│
└── web/
    └── src/
        └── modules/
            └── entradas-salidas/      ← NUEVO
                ├── EntradasSalidasLayout.tsx    ← sub-shell con tabs Reportes / Formularios PowerApp
                ├── ReportesPlaceholder.tsx      ← placeholder
                └── formularios/
                    ├── FormsListPage.tsx         ← lista agrupada por subgrupo (3 secciones)
                    ├── FormPage.tsx              ← /entradas-salidas/formularios/:slug
                    ├── FormRenderer.tsx          ← copia tal cual
                    ├── Field.tsx, fieldValidate.ts ← copia tal cual
                    ├── formIcons.ts              ← copia tal cual
                    └── api/                      ← hooks de forms, catalogos, stats
```

### Rutas objetivo (frontend)

| Ruta | Descripción | Permiso |
|---|---|---|
| `/entradas-salidas` | Redirige al primer submódulo permitido | `entradas-salidas`.ver |
| `/entradas-salidas/reportes` | Placeholder "modulo en desarrollo" | `entradas-salidas` > `reportes`.ver |
| `/entradas-salidas/formularios` | Grid de cards agrupado por tipo de flete | `entradas-salidas` > `formularios-power-app`.ver |
| `/entradas-salidas/formularios/:slug` | Form individual con `FormRenderer` | `entradas-salidas` > `formularios-power-app` > `<slug>`.ver |
| `/admin/auditoria-formularios` | Tabla paginada de submissions (admin) | `admin` (global_admin) |
| `/admin/notificaciones-formularios` | Cola del notification worker (admin) | `admin` |

> Las rutas de gestión de usuarios y roles existentes en AdmonOps (`/admin/users`, `/admin/roles`) se **extienden** con la matriz de 3 niveles (ver §6).

---

## 4. Cambios al schema de Prisma

### 4.1 Modelos NUEVOS

```prisma
// ============================================================
// FASE X - Permisos granulares (submódulos + formularios)
// ============================================================

/**
 * Submódulo dentro de un módulo. Por ejemplo, el módulo
 * "entradas-salidas" tiene los submódulos "reportes" y
 * "formularios-power-app". Es un catálogo simple sin lógica.
 */
model Submodulo {
  id         Int      @id @default(autoincrement())
  modulo_id  Int
  clave      String                       // "reportes", "formularios-power-app"
  nombre     String                       // "Reportes", "Formularios PowerApp"
  icono      String?
  orden      Int      @default(0)
  activo     Boolean  @default(true)
  created_at DateTime @default(now())

  modulo       Modulo                @relation(fields: [modulo_id], references: [id], onDelete: Cascade)
  rol_permisos RolPermisoSubmodulo[]

  @@unique([modulo_id, clave])
  @@map("submodulos")
}

/**
 * Permisos por rol a nivel de submódulo.
 * Si no existe registro para un (rol, submódulo), el comportamiento por
 * defecto es HEREDAR los permisos del módulo padre (RolPermiso).
 * Si existe, este registro GANA (override).
 */
model RolPermisoSubmodulo {
  id           Int     @id @default(autoincrement())
  rol_id       Int
  submodulo_id Int
  ver          Boolean @default(false)
  crear        Boolean @default(false)
  editar       Boolean @default(false)
  eliminar     Boolean @default(false)

  rol       Rol       @relation(fields: [rol_id], references: [id], onDelete: Cascade)
  submodulo Submodulo @relation(fields: [submodulo_id], references: [id], onDelete: Cascade)

  @@unique([rol_id, submodulo_id])
  @@map("rol_permisos_submodulo")
}

/**
 * Permisos por rol a nivel de FORMULARIO INDIVIDUAL.
 * Solo se usa para los 11 forms del submódulo "formularios-power-app".
 * - ver:   puede ver la card en la lista
 * - crear: puede enviar el formulario
 * editar/eliminar no aplican (los forms son submit-only).
 */
model RolPermisoFormulario {
  id        Int     @id @default(autoincrement())
  rol_id    Int
  form_slug String                          // "registrar-unidad-adn", etc. (11 valores conocidos)
  ver       Boolean @default(false)
  crear     Boolean @default(false)

  rol Rol @relation(fields: [rol_id], references: [id], onDelete: Cascade)

  @@unique([rol_id, form_slug])
  @@index([form_slug])
  @@map("rol_permisos_formulario")
}

// ============================================================
// FASE X - Formularios PowerApp (auditoría + cola)
// ============================================================

model FormSubmissionLog {
  id            Int      @id @default(autoincrement())
  usuario_id    Int
  centro_id     BigInt                      // centro activo al momento del envío
  usuario_email String                      // desnormalizado para auditoría estable
  form_slug     String
  sp_name       String
  payload_json  String                      // JSON.stringify del body validado
  result        String                      // "ok" | "error"
  error_message String?
  duration_ms   Int
  created_at    DateTime @default(now())

  usuario Usuario @relation(fields: [usuario_id], references: [id])
  centro  Centro  @relation(fields: [centro_id], references: [IDCentro])

  @@index([form_slug, created_at])
  @@index([centro_id, created_at])
  @@index([usuario_id, created_at])
  @@index([result, created_at])
  @@map("form_submission_log")
}

model FormNotificationQueue {
  id            Int       @id @default(autoincrement())
  submission_id Int?                         // referencia laxa a form_submission_log
  kind          String                       // "error_submit" | "success"
  payload_json  String
  sent_at       DateTime?
  created_at    DateTime  @default(now())

  @@index([sent_at])
  @@map("form_notification_queue")
}
```

### 4.2 Modificaciones a modelos existentes

Agregar relaciones inversas a `Rol`, `Modulo`, `Usuario`, `Centro`:

```diff
 model Rol {
   ...
   permisos        RolPermiso[]
+  permisos_submodulo  RolPermisoSubmodulo[]
+  permisos_formulario RolPermisoFormulario[]
   centro_usuarios CentroUsuario[]
 }

 model Modulo {
   ...
   centro_modulos CentroModulo[]
   rol_permisos   RolPermiso[]
+  submodulos     Submodulo[]
 }

 model Usuario {
   ...
+  form_submissions FormSubmissionLog[]
 }

 model Centro {
   ...
+  form_submissions FormSubmissionLog[]
 }
```

### 4.3 Migración + seed

Crear migración con:

```bash
npx prisma migrate dev --name agregar_permisos_granulares_y_forms
```

Seed nuevo (en el archivo de seeding existente o uno nuevo):

```ts
// 1. Asegurar que existe el módulo "entradas-salidas" en `modulos`
const moduloEntradasSalidas = await prisma.modulo.upsert({
  where: { clave: 'entradas-salidas' },
  update: {},
  create: { clave: 'entradas-salidas', nombre: 'Entradas y Salidas', icono: 'ArrowLeftRight', orden: 30 },
});

// 2. Crear los dos submódulos
const subReportes = await prisma.submodulo.upsert({
  where: { modulo_id_clave: { modulo_id: moduloEntradasSalidas.id, clave: 'reportes' } },
  update: {},
  create: {
    modulo_id: moduloEntradasSalidas.id,
    clave: 'reportes',
    nombre: 'Reportes',
    icono: 'FileBarChart',
    orden: 10,
  },
});

const subForms = await prisma.submodulo.upsert({
  where: { modulo_id_clave: { modulo_id: moduloEntradasSalidas.id, clave: 'formularios-power-app' } },
  update: {},
  create: {
    modulo_id: moduloEntradasSalidas.id,
    clave: 'formularios-power-app',
    nombre: 'Formularios PowerApp',
    icono: 'FileText',
    orden: 20,
  },
});

// 3. Para cada rol existente, decidir defaults:
//    - Admin (es_default + global_admin): todos los forms con ver+crear
//    - Auxiliar Centro: solo los 5 base operativos
//    - Otros roles: nada (admin debe configurarlos a mano)

const FORM_SLUGS_OPERATIVOS = [
  'registrar-unidad-adn',
  'registrar-unidad-cliente',
  'registrar-operador-adn',
  'registrar-operador-cliente',
  'placa-remolque',
];

const FORM_SLUGS_ADMIN = [
  'eliminar-tara',
  'registrar-proveedor',
  'habilitar-concat-rem',
  'eliminar-entrada-lre',
  'eliminar-salida-tara-lrs',
  'permitir-pesaje-manual',
];

// Ejemplo para un rol "auxiliar-centro" identificado por nombre:
const auxCentro = await prisma.rol.findUnique({ where: { nombre: 'Auxiliar Centro' } });
if (auxCentro) {
  for (const slug of FORM_SLUGS_OPERATIVOS) {
    await prisma.rolPermisoFormulario.upsert({
      where: { rol_id_form_slug: { rol_id: auxCentro.id, form_slug: slug } },
      update: { ver: true, crear: true },
      create: { rol_id: auxCentro.id, form_slug: slug, ver: true, crear: true },
    });
  }
  // Submódulo formularios-power-app: ver=true, crear=true (heredan del módulo o se setea explícitamente)
  await prisma.rolPermisoSubmodulo.upsert({
    where: { rol_id_submodulo_id: { rol_id: auxCentro.id, submodulo_id: subForms.id } },
    update: { ver: true, crear: true },
    create: { rol_id: auxCentro.id, submodulo_id: subForms.id, ver: true, crear: true },
  });
}
// repetir para Supervisor Centro con FORM_SLUGS_OPERATIVOS + algunos admin (ej. permitir-pesaje-manual)
```

---

## 5. Reorganización de los 11 formularios

Los slugs internos NO cambian (los SPs siguen llamándose igual). Lo que cambia es la **agrupación visual**:

| Subgrupo | Etiqueta | Forms |
|---|---|---|
| `flete-adn` | Tipo Flete ADN | `registrar-unidad-adn`, `registrar-operador-adn`, `placa-remolque` |
| `flete-cliente` | Tipo Flete Cliente | `registrar-unidad-cliente`, `registrar-operador-cliente` |
| `operaciones-admin` | Operaciones administrativas | `eliminar-tara`, `registrar-proveedor`, `habilitar-concat-rem`, `eliminar-entrada-lre`, `eliminar-salida-tara-lrs`, `permitir-pesaje-manual` |

En el `registry.ts` agregar campo `subgroup`:

```ts
export const FORM_SUBGROUPS = {
  'flete-adn': { label: 'Tipo Flete ADN', icon: 'Truck' },
  'flete-cliente': { label: 'Tipo Flete Cliente', icon: 'Truck' },
  'operaciones-admin': { label: 'Operaciones administrativas', icon: 'Settings' },
} as const;

type FormSubgroup = keyof typeof FORM_SUBGROUPS;

// En cada FormDefinition agregar el campo:
//   subgroup: 'flete-adn' | 'flete-cliente' | 'operaciones-admin'
```

El `FormsListPage.tsx` agrupa por `subgroup` y renderiza tres secciones tituladas.

### 5.1 Aprovechar el centro activo del header de AdmonOps

Dos forms pueden simplificarse usando el centro activo en lugar de un selector dentro del form:

| Form | Antes (formularios-web) | Después (AdmonOps) |
|---|---|---|
| `permitir-pesaje-manual` | 2 fields: `IDCentro` (searchable-select) + `AllowManual` (radio) | 1 field: `AllowManual`. El `IDCentro` viene de `useAppStore.centroActivo` |
| `habilitar-concat-rem` | 2 fields: `CentroDestino` (searchable-select) + `Estatus` (radio) | 2 fields, pero el catálogo `centro-destino` se filtra por el centro activo (`WHERE IDCentro = @centroActivo`) |

Esto se hace en el `Field.tsx` para `searchable-select`: si `field.contextSource === 'centro-activo'`, salta el catálogo y usa el valor del store.

> **Decisión opcional**: si prefieres no tocar la lógica del form en esta fase, deja los 2 fields como están. Se ajusta después.

---

## 6. Lógica RBAC en cascada (3 niveles)

Para resolver si un usuario puede ejecutar una acción contra un form:

```ts
// pseudo-código del middleware permissions
function canAccess(usuario, centro, accion, modulo, submodulo?, formSlug?): boolean {
  // 1. Global admin lo puede todo
  if (usuario.global_admin) return true;

  // 2. Encontrar el rol del usuario en el centro activo
  const rol = await prisma.centroUsuario.findFirst({
    where: { usuario_id: usuario.id, centro_id: centro.IDCentro }
  })?.rol;
  if (!rol) return false;

  // 3. Permiso a nivel formulario (más específico, gana si existe)
  if (formSlug) {
    const permForm = await prisma.rolPermisoFormulario.findUnique({
      where: { rol_id_form_slug: { rol_id: rol.id, form_slug: formSlug } }
    });
    if (permForm) return permForm[accion]; // 'ver' o 'crear'
    // Si no hay registro de form, hereda del submódulo
  }

  // 4. Permiso a nivel submódulo
  if (submodulo) {
    const permSub = await prisma.rolPermisoSubmodulo.findFirst({
      where: { rol_id: rol.id, submodulo: { clave: submodulo, modulo: { clave: modulo } } }
    });
    if (permSub) return permSub[accion];
    // Si no hay registro de submódulo, hereda del módulo
  }

  // 5. Permiso a nivel módulo (fallback)
  const permMod = await prisma.rolPermiso.findFirst({
    where: { rol_id: rol.id, modulo: { clave: modulo } }
  });
  return permMod?.[accion] ?? false;
}
```

### 6.1 Endpoints típicos protegidos

| Endpoint | Permiso requerido |
|---|---|
| `GET /api/entradas-salidas/formularios` | `ver` en módulo `entradas-salidas` (al menos) |
| `GET /api/entradas-salidas/formularios/:slug` | `ver` en form `:slug` |
| `POST /api/entradas-salidas/formularios/:slug/submit` | `crear` en form `:slug` |
| `GET /api/entradas-salidas/catalogos/:tipo` | `ver` en submódulo `formularios-power-app` |
| `GET /api/admin/form-submissions` | `global_admin` |

### 6.2 UI del editor de roles

En la página `/admin/roles/:id` mostrar la matriz de permisos así:

```
[▼] Equipos y Mantenimiento     [✓] [✓] [✓] [✓]   ← actual (módulo)
    [▼] Horometros               [✓] [✓] [✓] [✓]   ← submódulo (heredado del módulo si vacío)
    [▼] Combustibles             [✓] [✓] [✓] [✓]
    ...

[▼] Entradas y Salidas           [✓] [✓] [ ] [ ]
    [▼] Reportes                 [✓] [ ] [ ] [ ]
    [▼] Formularios PowerApp     [✓] [✓] [ ] [ ]
        [✓] Registrar Unidades (ADN)        [✓] [✓]   ← form (solo ver/crear)
        [✓] Registrar Operadores (ADN)      [✓] [✓]
        [ ] Eliminar Tara                   [ ] [ ]
        ...
```

Reglas UI:
- Click en `▼` de un módulo → expande sus submódulos.
- Click en `▼` de un submódulo → expande sus forms (solo `formularios-power-app`).
- Marcar/desmarcar a nivel padre **propaga** a hijos (con confirmación si hay overrides).
- Si un hijo tiene override, mostrar un indicador (ej. badge `custom`).
- Botón "Resetear a heredado" por hijo para borrar el override.

---

## 7. Mapeo de archivos: qué copiar, adaptar, descartar

### 7.1 Backend (`api/`)

| Archivo en `formularios-web-ref` | Acción | Destino en AdmonOps |
|---|---|---|
| `api/src/lib/roles.ts` | **Adaptar** | `api/src/modules/entradas-salidas/formularios/lib/slugs.ts` (solo deja `FORM_SLUGS`, `FORM_SUBGROUPS`. Quita constantes de roles — ahora vienen de la tabla `Rol` de AdmonOps) |
| `api/src/lib/formTypes.ts` | **Copia tal cual** | `api/src/modules/entradas-salidas/formularios/lib/formTypes.ts` |
| `api/src/forms/engine.ts` | **Copia tal cual** | `api/src/modules/entradas-salidas/formularios/engine.ts` |
| `api/src/forms/registry.ts` | **Adaptar** | `api/src/modules/entradas-salidas/formularios/registry.ts` (agregar campo `subgroup` por form, mantener `getFormDefinition`/`getPublicDefinition`) |
| `api/src/forms/definitions/*.ts` (11 archivos) | **Copia tal cual + agregar `subgroup`** | `api/src/modules/entradas-salidas/formularios/definitions/` |
| `api/src/services/spRunner.ts` | **Copia tal cual** | `api/src/services/spRunner.ts` (compartido — si AdmonOps no tiene driver `mssql`, agregar al package.json) |
| `api/src/services/auditService.ts` | **Adaptar** | `api/src/modules/entradas-salidas/formularios/auditService.ts` (cambiar `prisma.submissionLog` → `prisma.formSubmissionLog`, agregar `centro_id`) |
| `api/src/services/notifyService.ts` | **Adaptar** | `api/src/services/notifyService.ts` (cambiar a `prisma.formNotificationQueue`; el worker se inicia en `index.ts` de AdmonOps) |
| `api/src/mssql.ts` | **Copia tal cual** | `api/src/mssql.ts` (si AdmonOps aún no se conecta a BDADN, agregar) |
| `api/src/routes/forms.ts` | **Adaptar** | `api/src/modules/entradas-salidas/formularios/routes.ts` (cambiar prefijo a `/api/entradas-salidas/formularios`, integrar middleware de permisos en cascada) |
| `api/src/routes/catalogos.ts` | **Copia tal cual** | `api/src/modules/entradas-salidas/formularios/catalogos.ts` (mismo whitelist) |
| `api/src/routes/admin.ts` (la parte de submissions y notifications) | **Adaptar** | extender el router admin existente de AdmonOps para agregar `GET /admin/form-submissions`, `GET /admin/form-notifications`, `POST /admin/form-notifications/:id/resend`, `GET /admin/form-stats` |
| `api/src/routes/auth.ts` | **Descartar** | AdmonOps tiene su propio `/me` |
| `api/src/middleware/auth.ts` | **Descartar** | AdmonOps tiene su propio `authMiddleware` |
| `api/src/middleware/rbac.ts` | **Reescribir** | el RBAC de AdmonOps (lo extiendes con la cascada del §6) |
| `api/src/middleware/logging.ts` | **Adoptar si AdmonOps no lo tiene** | request id + log estructurado |
| `api/src/schemas/admin.ts` | **Adaptar selectivamente** | de aquí saca `statsQuerySchema`, `listSubmissionsQuerySchema` (renombrar a Form*) |
| `api/prisma/schema.prisma` | **NO copiar** | extender el de AdmonOps con los modelos del §4 |
| `api/prisma/seed.ts` | **Como referencia** | el seed de AdmonOps incorpora los snippets del §4.3 |

### 7.2 Frontend (`web/`)

| Archivo en `formularios-web-ref` | Acción | Destino en AdmonOps |
|---|---|---|
| `web/src/lib/cn.ts` | **Verificar duplicado** | si AdmonOps no lo tiene, copiar |
| `web/src/lib/relativeTime.ts` | **Copia tal cual** | `web/src/lib/relativeTime.ts` |
| `web/src/lib/types.ts` | **Adaptar** | partir en dos: tipos de form (`FieldType`, `FormPublicDefinition`) van a `web/src/modules/entradas-salidas/formularios/types.ts`; tipos de auth (`AuthMeUser`) **no se copian**, usa los de AdmonOps |
| `web/src/lib/isFormSlug.ts` | **Copia tal cual** | `web/src/modules/entradas-salidas/formularios/lib/isFormSlug.ts` |
| `web/src/api/client.ts` | **Verificar duplicado** | AdmonOps probablemente tiene su `apiGet/apiPost`. Si no, copiar |
| `web/src/api/forms.ts` | **Adaptar** | `web/src/modules/entradas-salidas/formularios/api/forms.ts` (cambiar paths a `/api/entradas-salidas/formularios/...`) |
| `web/src/api/catalogos.ts` | **Adaptar** | mismo: prefijo `/api/entradas-salidas/formularios/catalogos/...` |
| `web/src/api/admin.ts` | **Mergear** | extiende el `web/src/api/admin.ts` de AdmonOps (forms submissions + notifications + stats) |
| `web/src/api/notifications.ts`, `stats.ts` | **Adaptar** | rutas con prefijo `/api/admin/form-...` |
| `web/src/components/ui/*` | **Verificar duplicado** | la mayoría AdmonOps ya las tiene. Solo copia las que falten (probable: `SearchableSelect.tsx`, `RadioGroup.tsx`, `FieldShell.tsx`, `Toaster.tsx`) |
| `web/src/components/forms/*` | **Copia tal cual** | `web/src/modules/entradas-salidas/formularios/components/` (FormRenderer, Field, fieldValidate) |
| `web/src/components/layout/*` | **Descartar** | AdmonOps tiene su propio shell |
| `web/src/auth/*` | **Descartar** | AdmonOps tiene su propio auth |
| `web/src/store/authStore.ts` | **Descartar** | AdmonOps tiene su propio store |
| `web/src/store/appStore.ts` | **Descartar** | AdmonOps tiene su propio store con tema/sidebar/centro activo |
| `web/src/store/toastStore.ts` | **Verificar duplicado** | si AdmonOps no lo tiene, copiar |
| `web/src/modules/formularios/FormsListPage.tsx` | **Reescribir** | nueva versión agrupada por subgrupo. Mira el original como referencia de estructura |
| `web/src/modules/formularios/FormPage.tsx` | **Adaptar** | mismo flujo (`useFormDefinition` + `<FormRenderer/>`), cambiar imports |
| `web/src/modules/formularios/formIcons.ts` | **Copia tal cual** | mismo |
| `web/src/modules/admin/UsersPage.tsx`, `UserFormPage.tsx` | **Como referencia** | la versión de AdmonOps gana; agregar la sección de "Permisos extra de form" SOLO si AdmonOps decide tener permisos por usuario (no es el caso según el jefe — todo va por rol) |
| `web/src/modules/admin/SubmissionsPage.tsx` | **Adaptar** | en AdmonOps debería ir bajo `/admin/auditoria-formularios` o como sección dentro de `/admin/auditoria` ya existente si la tiene |
| `web/src/modules/admin/NotificationsPage.tsx` | **Adaptar** | mismo: `/admin/notificaciones-formularios` |
| `web/src/modules/dashboard/DashboardPage.tsx` | **Como referencia** | AdmonOps probablemente ya tiene su Dashboard. Las tarjetas y gráficas de stats de formularios pueden integrarse como sección en `/dashboard` o como pestaña filtrable. Decisión del otro Claude. |
| `web/src/App.tsx` | **NO copiar** | extender el router de AdmonOps con las nuevas rutas |

### 7.3 Reglas generales

- Los archivos marcados **"Copia tal cual"** se pueden mover sin cambiar lógica. Solo ajustar imports.
- Los marcados **"Adaptar"** requieren cambios mínimos (paths, tipos, ids `Int` vs `String`).
- Los **"Reescribir"** parten de cero pero el original sirve de referencia visual.
- Los **"Descartar"** son funcionalidad que AdmonOps ya tiene mejor o diferente.

---

## 8. Variables de entorno

En `api/.env` de AdmonOps, agregar (si no existen):

```env
# BDADN — la BD operativa donde corren los SPs
BDADN_SERVER=adnprod.database.windows.net,1433
BDADN_DATABASE=BDADN
BDADN_USER=
BDADN_PASSWORD=
BDADN_ENCRYPT=true
BDADN_TRUST_SERVER_CERTIFICATE=false
BDADN_POOL_MIN=1
BDADN_POOL_MAX=10
BDADN_CONNECT_TIMEOUT_MS=10000
BDADN_REQUEST_TIMEOUT_MS=30000
```

Las variables de Entra ID ya existen en AdmonOps. **No tocarlas.**

En `web/.env` de AdmonOps no hace falta agregar nada (los forms heredan la auth y proxy de AdmonOps).

---

## 9. Plan por fases

> Cada fase termina con un commit en su propia rama (sugerido: `feature/forms-power-app`).
> Type-check entre fases para detectar regresiones.

### Fase 0 — Pre-requisitos y schema

1. Confirmar que el módulo `entradas-salidas` ya existe en la tabla `modulos`. Si no, agregar al seed.
2. Aplicar el schema delta del §4 (`prisma migrate dev --name agregar_permisos_granulares_y_forms`).
3. Correr el seed que crea los dos `Submodulo` y los `RolPermisoFormulario` defaults.
4. **Smoke**: `prisma studio` muestra las tablas nuevas, los submódulos creados, los permisos seed.

### Fase 1 — Backend: pool mssql + spRunner + módulo de forms

1. Si AdmonOps no tiene driver `mssql`, instalar (`npm install mssql`).
2. Copiar/adaptar `mssql.ts`, `spRunner.ts`, `engine.ts`, `formTypes.ts`, `slugs.ts`.
3. Copiar las 11 `FormDefinition` (con campo `subgroup` agregado).
4. Copiar `catalogos.ts` con whitelist.
5. Crear `routes.ts` del módulo con los 4 endpoints (list, detail, submit, catalogos).
6. Crear `auditService.ts` y `notifyService.ts` adaptados (`form_submission_log`, `form_notification_queue`).
7. Wirear el router bajo `/api/entradas-salidas/formularios` con el middleware de auth de AdmonOps.
8. **Smoke**: `curl POST /api/entradas-salidas/formularios/registrar-unidad-adn/submit` con body válido inserta en BDADN y registra `FormSubmissionLog`. Re-validar la prueba con la placa sintética PLACATEST001 + cleanup.

### Fase 2 — Backend: middleware de permisos en cascada

1. Implementar `canAccess(usuario, centro, accion, modulo, submodulo?, formSlug?)` según §6.
2. Aplicarlo a los endpoints del módulo en cascada.
3. Endpoints admin para CRUD de `RolPermisoSubmodulo` y `RolPermisoFormulario`.
4. **Smoke**: programáticamente cambiar el rol de un usuario sintético a "Auxiliar Centro", probar acceso a los 5 forms operativos y bloqueo a los 6 admin. Cambiar a "Supervisor Centro" con override en `permitir-pesaje-manual`, verificar que pasa.

### Fase 3 — Frontend: shell del submódulo

1. Crear `EntradasSalidasLayout.tsx` con tabs Reportes / Formularios PowerApp.
2. `ReportesPlaceholder.tsx` con el mismo placeholder que ya tiene Entradas y Salidas.
3. Agregar entrada de sidebar en AdmonOps "Entradas y Salidas" (si ya existe, agregar el sub-sidebar visual cuando estás dentro).
4. **Smoke**: navegar a `/entradas-salidas` redirige a `/entradas-salidas/formularios`. Tabs cambian entre placeholders.

### Fase 4 — Frontend: FormsListPage agrupado + FormPage

1. Copiar primitivas que falten en AdmonOps (`SearchableSelect`, `RadioGroup`, `FieldShell`, `Toaster`).
2. Copiar `FormRenderer`, `Field`, `fieldValidate`.
3. Crear `FormsListPage` con 3 secciones agrupadas por `subgroup`. Cards solo muestran los forms autorizados (filtrado por backend).
4. Crear `FormPage` que consume `useFormDefinition` y renderiza `<FormRenderer />`.
5. Hooks de React Query para forms y catalogos.
6. **Smoke**: usuario admin ve los 3 grupos completos. Usuario "Auxiliar Centro" solo ve los 2 grupos operativos. Submit de un form llega al backend, devuelve toast verde con `submissionId`.

### Fase 5 — Editor de roles con árbol expandible

1. Adaptar la página `/admin/roles/:id` de AdmonOps:
   - Por cada módulo, agregar botón ▼ que expande sus submódulos
   - Por cada submódulo `formularios-power-app`, agregar botón ▼ que expande los 11 forms
   - Edición inline de checkboxes por nivel
   - Indicador de `custom` cuando hay override
   - Botón "Resetear a heredado" por hijo
2. Backend de los PUT/PATCH para los nuevos modelos de permiso.
3. **Smoke**: admin crea rol "Supervisor Centro", configura los 5 base + `permitir-pesaje-manual`, login como ese rol, verifica que ve solo lo configurado.

### Fase 6 — Auditoría + notifications + stats

1. Adaptar `SubmissionsPage` (`/admin/auditoria-formularios` o sección anidada).
2. Adaptar `NotificationsPage` (`/admin/notificaciones-formularios`).
3. Integrar las KPI cards de stats al Dashboard de AdmonOps (o página propia).
4. Worker de notificaciones se inicia en el `index.ts` de AdmonOps.
5. **Smoke**: forzar error de negocio (`eliminar-tara` con folio inexistente), verificar que aparece en notificaciones y se procesa en ≤15s.

### Fase 7 — Hardening y limpieza

1. Rate limiting estricto en `POST /api/entradas-salidas/formularios/:slug/submit` (60/min por usuario, igual que aquí).
2. Verificar que `requestLogger` aplica a las rutas nuevas.
3. Probar los 11 forms en una sesión completa (submit de los reversibles + dummy de los destructivos).
4. Si AdmonOps todavía tiene módulos sin granularidad de submódulo, marcar como TODO en un issue (no es alcance de esta migración).

### Fase 8 — Despliegue (cuando esté listo)

1. Las migraciones de Prisma se aplican con `prisma migrate deploy` en producción.
2. Validar variables `BDADN_*` en App Service.
3. Smoke en prod con un usuario operativo y un usuario admin.
4. Apagar los flujos de Power Automate solo después de 1 semana de paralelo.
5. Deprecar los Microsoft Forms con redirect a la nueva URL en AdmonOps.

---

## 10. Verificación end-to-end (post Fase 6)

Repetir manualmente:

1. Login como admin global → ve los 11 forms en 3 grupos. Submit de `registrar-unidad-adn` con `PLACATESTUI001` funciona.
2. Crear rol "Auxiliar Centro" sin permisos extra → asignar a un usuario → ese usuario solo ve los 5 base.
3. Crear rol "Supervisor Centro" → marcar los 5 base + `permitir-pesaje-manual` + `eliminar-tara` → ese usuario ve 7 forms.
4. Cambiar el centro activo del header → el form `permitir-pesaje-manual` usa ese centro automáticamente.
5. Forzar un error de negocio (`eliminar-tara` con folio 999999999) → toast rojo con mensaje del SP, fila aparece en `/admin/auditoria-formularios` y en `/admin/notificaciones-formularios`.
6. Tema dark/light se aplica correctamente al renderer y a las tablas.
7. Cleanup: borrar registros sintéticos de BDADN (placa de prueba, log entries).

---

## 11. Riesgos y rollback

| Riesgo | Mitigación |
|---|---|
| La cascada de permisos rompe acceso a otros módulos | El comportamiento por defecto del nuevo middleware es heredar del nivel superior, así que módulos sin `Submodulo` ni `RolPermisoSubmodulo` se comportan igual que antes. **Test obligatorio**: que un Auxiliar Centro siga viendo Equipos y Mantenimiento como antes. |
| Cambio de tipos `String` UUID → `Int autoincrement` rompe relaciones | El Usuario.id de AdmonOps es Int. La copia adapta los tipos en `auditService.ts` y los hooks. |
| BDADN no acepta la IP del App Service nuevo | El firewall ya lo cubrimos antes; en prod hay que repetir el ajuste en Azure SQL. |
| Conflicto de nombres entre `Proveedor` (modelo Prisma de AdmonOps) y `Proveedor` (tabla de BDADN) | No hay conflicto: el `Proveedor` de Prisma es el catálogo SAP de proveedores de AdmonOps; el de BDADN se accede vía SP, no vía Prisma. |
| Worker de notificaciones se duplica si AdmonOps escala con múltiples instancias | Para MVP: una sola instancia. Para HA: agregar un lock con `SELECT FOR UPDATE` o usar Azure Queue Storage en lugar de la tabla local. |

**Rollback**: si la migración falla en producción, las tablas nuevas (`submodulos`, `rol_permisos_submodulo`, `rol_permisos_formulario`, `form_submission_log`, `form_notification_queue`) se pueden DROP sin afectar las tablas existentes. La rama `feature/forms-power-app` se descarta. Microsoft Forms y Power Automate siguen funcionando en paralelo durante el periodo de transición.

---

## 12. Checklist alto nivel para arrancar

- [ ] Clonar `formularios-web-ref` paralelo a `admon-ops-platform` (ver instrucciones en el chat del usuario).
- [ ] Abrir multi-root workspace en VSCode con ambas carpetas.
- [ ] Leer este documento completo.
- [ ] Ejecutar `prisma migrate dev` con el schema extendido (Fase 0).
- [ ] Ir fase por fase. Antes de cada fase, mostrar el plan de la fase y esperar confirmación del usuario.
- [ ] Cada fase termina con type-check + smoke + commit + push a `feature/forms-power-app`.
- [ ] Al finalizar todas las fases, abrir PR contra `main` de AdmonOps con resumen de los 11 forms migrados.

---

## Apéndice A — Inventario de SPs (de BDADN)

```
sp_InsertarPlaca               (registrar-unidad-adn, registrar-unidad-cliente)
sp_InsertarOperador            (registrar-operador-adn, registrar-operador-cliente)
sp_RegistrarPlacaRemolque      (placa-remolque)
sp_InsertarProveedor           (registrar-proveedor)
sp_DeleteTara                  (eliminar-tara, resultset convention)
sp_DeleteEntradaLRE            (eliminar-entrada-lre)
sp_DeleteTaraSalidaLRS         (eliminar-salida-tara-lrs, resultset convention)
sp_ActualizarConcatRemisionExt (habilitar-concat-rem)
sp_UpdatePesajeManual          (permitir-pesaje-manual)
```

Definiciones completas: `formularios-web-ref/db_analysis_output/object_definitions/procedure/*.sql` (no tracked en git, debes correr `analyze_sqlserver_db.py` la primera vez si no las tienes).

## Apéndice B — Catálogos dinámicos (queries whitelisted)

Ver `formularios-web-ref/api/src/routes/catalogos.ts`. Los slugs son:

```
proveedores-transportista
proveedores-transportista-cliente
tipos-proveedor                (constante)
centro-destino
tipos-entrada
centros-pesaje
```

## Apéndice C — Referencias del repo fuente

- Schema actual de plataforma: `api/prisma/schema.prisma`
- FormDefinitions: `api/src/forms/definitions/`
- Engine declarativo: `api/src/forms/engine.ts`
- spRunner: `api/src/services/spRunner.ts`
- Renderer + Field: `web/src/components/forms/`
- DESIGN_SYSTEM.md (raíz) — tokens visuales (AdmonOps ya los tiene; sirve de referencia para nuevas primitivas)

---

**Fin del plan.** Cualquier ambigüedad, preguntar al usuario antes de implementar.
