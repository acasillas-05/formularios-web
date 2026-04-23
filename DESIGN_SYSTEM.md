# AdmonOps Platform — Design System & UI/UX Guidelines

> Documento de referencia profesional del sistema de diseño de **AdmonOpsPlatform**.
> Úsalo como guía para replicar la misma filosofía visual, arquitectura de componentes
> y patrones de UX en otros proyectos del ecosistema ADN.
>
> **Última actualización:** 2026-04-23
> **Versión del sistema:** v1.0

---

## Tabla de contenidos

1. [Filosofía de diseño](#1-filosofia-de-diseno)
2. [Stack técnico](#2-stack-tecnico)
3. [Design Tokens](#3-design-tokens)
4. [Tipografía](#4-tipografia)
5. [Espaciado, radios, sombras](#5-espaciado-radios-sombras)
6. [Dark mode / Light mode](#6-dark-mode--light-mode)
7. [Arquitectura de carpetas](#7-arquitectura-de-carpetas)
8. [Layout global (shell)](#8-layout-global-shell)
9. [Componentes base](#9-componentes-base)
10. [Dashboards y visualización de datos](#10-dashboards-y-visualizacion-de-datos)
11. [Patrones de UX](#11-patrones-de-ux)
12. [Iconografía](#12-iconografia)
13. [Animaciones y micro-interacciones](#13-animaciones-y-micro-interacciones)
14. [Estado global y data-fetching](#14-estado-global-y-data-fetching)
15. [Routing y navegación](#15-routing-y-navegacion)
16. [Accesibilidad](#16-accesibilidad)
17. [Responsive y breakpoints](#17-responsive-y-breakpoints)
18. [Checklist de replicación](#18-checklist-de-replicacion)

---

## 1. Filosofía de diseño

AdmonOpsPlatform es una plataforma operacional industrial. Las decisiones visuales
priorizan densidad de información, legibilidad bajo luz ambiental variable (planta,
oficina, campo) y una estética **técnica-profesional** sin adornos decorativos.

Principios rectores:

1. **Dark-first.** El tema oscuro es el default. El tema claro es una alternativa
   funcional, no un modo secundario de segunda clase. Ambos deben verse idénticos
   en calidad.
2. **Data over chrome.** El crédito visual lo ganan los datos (gauges, KPIs, tablas),
   no los contenedores. Bordes sutiles, sombras mínimas.
3. **High contrast, low noise.** Texto claro sobre fondo oscuro, con un único acento
   cyan que marca interactividad. Nada más compite por atención.
4. **Consistencia radical.** Un botón primario se ve igual en todo el sistema. Un
   badge "success" tiene exactamente el mismo verde en cualquier módulo.
5. **Componentes componibles, no monolíticos.** Cada primitiva (Button, Card, Input)
   hace una cosa y se combina. No existen mega-componentes con 20 props.
6. **Mobile funcional, desktop óptimo.** El target principal es desktop (planta,
   oficina). Mobile existe para consultas rápidas, no para operaciones intensivas.

---

## 2. Stack técnico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Framework | React | 19 |
| Lenguaje | TypeScript (strict) | 5.9+ |
| Build tool | Vite | 8 |
| Styling | TailwindCSS | 4 (vía `@tailwindcss/vite`) |
| Routing | React Router | 7 |
| Data-fetching | TanStack React Query | 5 |
| Estado global | Zustand | 5 |
| Gráficas | Apache ECharts + `echarts-for-react` | 6 / 3 |
| Iconos | Lucide React | 0.577+ |
| Fechas | date-fns + react-day-picker | 4 / 9 |
| Excel export | SheetJS (`xlsx`) | 0.18 |
| Auth | MSAL (Azure AD) | 4 |

**Decisión clave:** Tailwind 4 no usa `tailwind.config.js`. Los tokens se definen en
el CSS con `@theme { ... }` y se consumen como clases Tailwind automáticas
(ej. `bg-bg-primary`, `text-accent`).

---

## 3. Design Tokens

### 3.1 Paleta — tema oscuro (default)

Definidos en `src/styles.css` como variables CSS dentro del bloque `@theme`:

```css
@theme {
  --color-bg-primary: #07101F;   /* fondo principal — navy casi negro */
  --color-bg-card:    #0D1B2E;   /* fondo de tarjetas y paneles */
  --color-bg-surface: #112240;   /* superficies elevadas, hover states */
  --color-accent:     #00C8FF;   /* cyan — interactividad, foco, seleccion */
  --color-accent2:    #3B82F6;   /* azul — acento secundario */
  --color-success:    #10B981;   /* operable, aprobado */
  --color-warning:    #F59E0B;   /* alerta, en revision */
  --color-danger:     #EF4444;   /* error, rechazado, critico */
  --color-text:       #E8F4FF;   /* texto principal */
  --color-muted:      #7A9BB5;   /* texto secundario, labels */
  --color-border:     #1E3A5F;   /* bordes de tarjetas e inputs */
}
```

### 3.2 Paleta — tema claro

```css
[data-theme="light"] {
  --color-bg-primary: #F5F7FA;
  --color-bg-card:    #FFFFFF;
  --color-bg-surface: #EDF0F5;
  --color-accent:     #0094CC;   /* cyan mas oscuro para contraste en blanco */
  --color-accent2:    #2563EB;
  --color-success:    #059669;
  --color-warning:    #D97706;
  --color-danger:     #DC2626;
  --color-text:       #1E293B;
  --color-muted:      #64748B;
  --color-border:     #E2E8F0;
}
```

### 3.3 Uso semántico

| Token | Cuándo usarlo | Cuándo NO usarlo |
|-------|---------------|------------------|
| `bg-primary` | Fondo del body, shell | Tarjetas, modales |
| `bg-card` | Tarjetas, paneles, filas de tabla | Fondo global, hover |
| `bg-surface` | Hover sobre card, inputs, elementos elevados | Texto, bordes |
| `accent` (cyan) | Botón primario, link, selección, foco, ruta activa | Texto largo |
| `accent2` (azul) | Acento secundario cuando cyan ya está en uso | Texto general |
| `success` | Estado "operable", "aprobado", checks positivos | Botón primario |
| `warning` | Umbral medio, "en revisión", alertas no críticas | Errores |
| `danger` | Errores, eliminar, estados rechazados/críticos | Acento decorativo |
| `text` | Todo texto principal | Muted info |
| `muted` | Labels, placeholders, texto secundario, datos inactivos | Texto importante |
| `border` | Bordes de cards, inputs, dividers | Backgrounds |

### 3.4 Convención de opacidad

Para variantes sutiles de color, usar la sintaxis Tailwind `/XX`:

```
bg-accent/10     → fondo cyan al 10% (ruta activa)
bg-success/12    → fondo verde al 12% (badge success)
border-success/28→ borde verde al 28% (badge success)
text-danger      → texto rojo puro (mensaje de error)
hover:bg-accent/25 → hover con cyan 25%
```

Opacidades estándar del sistema: **10, 12, 15, 20, 25, 28, 30, 40, 50, 60, 90**.

---

## 4. Tipografía

### 4.1 Familias

```css
--font-sans: 'DM Sans', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

- **DM Sans** — textos generales, headers, UI, labels.
- **JetBrains Mono** — datos numéricos, horómetros, porcentajes, valores en gauges,
  tablas de datos críticos. Garantiza alineación perfecta.

> Importar ambas desde Google Fonts o CDN. No definir fallbacks exóticos.

### 4.2 Escala (utilidades Tailwind)

| Clase | Tamaño | Uso |
|-------|--------|-----|
| `text-xs` | 12px | Labels, badges, microcopy |
| `text-sm` | 14px | Body secundario, botones md, inputs |
| `text-base` | 16px | Body principal, botones lg |
| `text-lg` | 18px | Títulos de card, subheaders |
| `text-2xl` | 24px | Títulos de página (`h1`) |
| `text-4xl` | 36px | Estados especiales (404, hero) |

### 4.3 Pesos

| Peso | Clase | Uso |
|------|-------|-----|
| 400 | `font-normal` | Body |
| 500 | `font-medium` | Botones, énfasis ligero |
| 600 | `font-semibold` | Subtítulos, datos mono importantes |
| 700 | `font-bold` | Headers, títulos de página, día seleccionado |

### 4.4 Transformaciones

- **Uppercase en labels de grupo** (sidebar, headers de tabla):
  `text-xs uppercase tracking-wider text-muted/60`
- **Tabular nums en datos mono**: aplicar `font-mono` + `tabular-nums` para tablas
  numéricas.

---

## 5. Espaciado, radios, sombras

### 5.1 Espaciado

La escala es la de Tailwind estándar. Valores **de uso frecuente en el sistema**:

| Clase | Valor | Contexto típico |
|-------|-------|-----------------|
| `gap-2` / `p-2` | 8px | Entre elementos pequeños, badges |
| `gap-3` / `p-3` | 12px | Entre componentes |
| `p-3.5` | 14px | Padding de EquipoCard (específico) |
| `gap-4` / `p-4` | 16px | Entre cards del grid |
| `p-5` | 20px | Body de modal |
| `gap-6` / `p-6` | 24px | Padding del main content |

### 5.2 Border radius

| Clase | Valor | Uso |
|-------|-------|-----|
| `rounded-sm` | 3px | Scrollbar, indicadores muy pequeños |
| `rounded-md` | 6px | Botones de calendario, celdas |
| `rounded-lg` | 8px | Botones, inputs, selects |
| `rounded-xl` | 12px | Cards, paneles |
| `rounded-2xl` | 16px | Modales |
| `rounded-full` | ∞ | Badges, avatars, dots de estado |

### 5.3 Sombras

Intencionalmente escasas. Usar sólo cuando un elemento debe percibirse como flotante:

```
shadow-xl shadow-black/50   → popovers, dropdowns custom
shadow-2xl shadow-black/50  → modales grandes
hover:shadow-lg hover:shadow-accent/5 → hover sutil en cards interactivas
```

**Regla:** las cards normales **no** llevan sombra. El borde (`border-border`) las
delimita. La sombra se reserva para elementos sobre otros elementos.

### 5.4 Focus ring

Patrón único del sistema, para todos los inputs/selects/searchables:

```
focus:outline-none
focus:border-accent
focus:ring-1
focus:ring-accent/30
```

Con error: reemplazar `accent` por `danger`.

---

## 6. Dark mode / Light mode

### 6.1 Mecánica

1. El valor se guarda en `localStorage` bajo la clave **`admon_theme`** (`'dark'` | `'light'`).
2. El atributo `data-theme` se aplica al elemento `<html>`:
   ```ts
   document.documentElement.setAttribute('data-theme', next)
   ```
3. Las variables CSS bajo `[data-theme="light"]` sobreescriben las del `@theme` por
   defecto. Todo componente que use `bg-bg-card`, `text-text`, etc. se adapta
   automáticamente.

### 6.2 Toggle en UI

Ubicado en el menú de usuario del Header. Iconos `Sun` / `Moon` de Lucide.

### 6.3 Componentes que reaccionan a cambios dinámicos

Los componentes que leen el tema fuera de Tailwind (por ejemplo, para elegir un SVG
con variante `-light` o configurar colores de ECharts) deben observar el cambio con
un `MutationObserver`:

```ts
const [theme, setTheme] = useState(
  () => localStorage.getItem('admon_theme') || 'dark',
)

useEffect(() => {
  const observer = new MutationObserver(() => {
    setTheme(document.documentElement.getAttribute('data-theme') || 'dark')
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  return () => observer.disconnect()
}, [])
```

### 6.4 Assets con variante de tema

Los iconos SVG que necesitan versión clara llevan sufijo `-light`:

```
/cargador-frontal_64x64.svg        ← oscuro (default)
/cargador-frontal_64x64-light.svg  ← claro
```

Selector en código:
```ts
const suffix = theme === 'light' ? '-light' : ''
const src = `/cargador-frontal_64x64${suffix}.svg`
```

### 6.5 Inputs nativos de fecha/hora

Requieren tratamiento especial para que el popup nativo del navegador respete el
tema. Usar `color-scheme` + SVG embebido como `background-image` en
`::-webkit-calendar-picker-indicator`. Ver `styles.css` líneas 73-136 como referencia.

---

## 7. Arquitectura de carpetas

Estructura probada del frontend (adaptable al nuevo proyecto):

```
web/
├── src/
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Router + QueryClient provider
│   ├── styles.css                # @theme, variables, animations, globales
│   │
│   ├── auth/                     # AuthGuard, MSAL config
│   │   └── AuthGuard.tsx
│   │
│   ├── api/                      # Fetch wrappers + hooks de dominio
│   │   ├── client.ts             # apiGet/apiPost/apiPut/apiPatch/apiDelete
│   │   └── <dominio>.ts          # hooks React Query por dominio
│   │
│   ├── store/                    # Zustand stores
│   │   ├── authStore.ts
│   │   └── appStore.ts
│   │
│   ├── lib/                      # Tipos y utilidades puras
│   │   ├── types.ts
│   │   └── formatUtils.ts
│   │
│   ├── components/
│   │   ├── layout/               # Shell de la app
│   │   │   ├── PlatformLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   │
│   │   ├── ui/                   # Primitivas reutilizables
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── SearchableSelect.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── DatePicker.tsx
│   │   │   └── EmptyState.tsx
│   │   │
│   │   └── icons/                # Wrappers de SVG custom
│   │
│   └── modules/                  # Features / páginas
│       ├── admin/
│       ├── <dominio-1>/
│       └── <dominio-2>/
│
├── public/                       # Logos, iconos SVG, favicons
├── vite.config.ts
├── tsconfig.app.json
└── package.json
```

**Regla estructural:** `components/ui` contiene **solo** primitivas agnósticas al
dominio. Cualquier componente específico (ej. `EquipoCard`) vive dentro de su módulo.

---

## 8. Layout global (shell)

### 8.1 Estructura

```
┌──────────────────────────────────────────────┐
│  HEADER  h-16   Logo | Centro | User menu    │
├──────┬───────────────────────────────────────┤
│      │                                       │
│  S   │                                       │
│  I   │          MAIN CONTENT                 │
│  D   │          flex-1                       │
│  E   │          overflow-y-auto              │
│  B   │          p-6                          │
│  A   │                                       │
│  R   │                                       │
│      │                                       │
└──────┴───────────────────────────────────────┘
```

### 8.2 Dimensiones clave

| Elemento | Valor |
|----------|-------|
| Header altura | `h-16` (64px) |
| Sidebar colapsado | `w-[68px]` |
| Sidebar expandido | `w-[250px]` |
| Transición sidebar | `transition-all duration-300` |
| Padding main | `p-6` (24px) |

### 8.3 Sidebar

- **Logo area** (`h-16`, border-b): imagen completa cuando expandido, icono 32×32
  cuando colapsado.
- **Grupos de navegación** con label uppercase muy tenue
  (`text-xs uppercase tracking-wider text-muted/60`).
- **NavItem activo**: `border-l-2 border-accent bg-accent/10 text-accent`.
- **NavItem hover**: `hover:bg-bg-surface/50 hover:text-text`.
- **Submenu**: padding menor (`px-3 py-2 text-xs`), indentación clara.
- **Toggle de colapso**: botón en el footer del sidebar
  (`border-t border-border p-3`).

### 8.4 Header

- Izquierda: breadcrumb o título de sección (opcional).
- Centro: selector de centro (multi-select) si la app es multi-tenant por sede.
- Derecha: menú de usuario — avatar con inicial, nombre, y al click un dropdown con:
  - Perfil (nombre + email + rol).
  - Toggle Sun/Moon.
  - Botón Cerrar sesión.

### 8.5 Main content

- Scroll **independiente** (`overflow-y-auto`). El shell nunca debe scrollear en conjunto.
- Padding base `p-6`. Páginas con grid denso pueden usar `p-4`.
- Primer elemento típico: `<h1 className="text-2xl font-bold">`.

---

## 9. Componentes base

> Los snippets son reales del sistema — cópialos literalmente como punto de partida.

### 9.1 Button

```tsx
type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:   "bg-accent text-bg-primary hover:bg-accent/90",
  secondary: "bg-bg-surface text-text border border-border hover:border-accent/40",
  danger:    "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};
```

- **Base class común:** `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors`.
- **Icon opcional** (Lucide) con tamaños 14/16/18 según size.
- **Loading**: reemplaza el icono por `<Loader2 className="animate-spin" />` y marca
  `disabled`.
- **Disabled**: `opacity-50 cursor-not-allowed`.

### 9.2 Card

```tsx
// Base
"bg-bg-card border border-border rounded-xl"

// Si interactiva (con onClick)
"cursor-pointer hover:border-accent/40 transition-colors"
```

Compañero: `CardHeader` con título a la izquierda y slot de acciones a la derecha.

### 9.3 Badge

Seis variantes: `default | success | warning | danger | cyan | blue`.
Todas siguen el patrón **bg/12 + text + border/28**:

```tsx
success: "bg-success/12 text-success border-success/28"
warning: "bg-warning/12 text-warning border-warning/28"
danger:  "bg-danger/12 text-danger border-danger/28"
cyan:    "bg-accent/12 text-accent border-accent/28"
blue:    "bg-accent2/12 text-accent2 border-accent2/28"
default: "bg-bg-surface text-muted border-border"
```

Base: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border`.

Soporta un `dot` opcional (círculo sólido `w-1.5 h-1.5 rounded-full` del color del variant).

### 9.4 Input / Select

```tsx
// Base
"w-full bg-bg-surface border border-border rounded-lg px-3 py-2
 text-text text-sm placeholder:text-muted/50
 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"

// Con error
"border-danger focus:border-danger focus:ring-danger/30"
```

- **Label**: `text-sm font-medium text-muted mb-1.5`. Asterisco rojo si `required`.
- **Error**: `text-xs text-danger mt-1`.
- **Select**: mismo look; chevron custom con `ChevronDown` absolute a la derecha,
  `appearance: none` al `<select>` nativo.
- **Input number**: desactivar teclas `-` y `e` si `allowNegative={false}` (regla del
  dominio: valores negativos prohibidos en la mayoría de campos).

### 9.5 Modal

- Implementación con `createPortal(..., document.body)`.
- Backdrop: `bg-black/60 backdrop-blur-sm animate-fade-in`.
- Dialog: `bg-bg-card border border-border rounded-2xl`.
- Tamaños: `sm` (max-w-md), `md` (max-w-lg), `lg` (max-w-2xl), `xl` (max-w-4xl).
- Header con título + botón `X`. Body con `p-5`.
- **Escape** cierra. Mientras está abierto: `document.body.style.overflow = 'hidden'`.

### 9.6 ConfirmDialog

Wrapper de `Modal` tamaño `sm`. Dos variantes: `danger` (icon `Trash2`) y
`warning` (icon `AlertTriangle`). Icono centrado dentro de un círculo
`bg-<variant>/15 text-<variant>`. Dos botones: Cancelar (secondary) + Confirmar
(danger/warning).

### 9.7 Table

```tsx
// thead
"bg-bg-surface sticky top-0"
// th
"px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted"
// tbody row
"bg-bg-card border-b border-border/50 hover:bg-bg-surface/50"
// row clickable
"cursor-pointer"
```

- **Loading**: 5 filas de shimmer (`h-4 rounded bg-bg-surface animate-shimmer`).
- **Empty**: mensaje centrado con `EmptyState`.
- API genérica:
  ```ts
  interface Column<T> {
    key: string;
    header: string;
    render?: (row: T) => ReactNode;
    width?: string;
    className?: string;
  }
  ```

### 9.8 EmptyState

```tsx
<EmptyState
  icon={Package}
  title="Sin modulos disponibles"
  description="No hay modulos habilitados para este centro"
  action={{ label: "Contactar admin", onClick: ... }}  // opcional
/>
```

- Layout centered flex-col.
- Icono 48px `text-muted/40`.
- Título `text-lg font-medium text-muted`.
- Descripción `text-sm text-muted/70 max-w-sm text-center`.

### 9.9 DatePicker (custom, sobre react-day-picker)

Puntos clave (ver `src/components/ui/DatePicker.tsx` como referencia):

- Tema aplicado con la clase raíz **`rdp-admon`** que consume las variables del
  Design System (ver `styles.css` líneas 165-231).
- `CompactDropdown` reemplaza los `<select>` nativos de mes y año:
  anchos fijos (130px mes, 78px año), `max-h: 9 items × 28px`,
  posicionamiento con portal `fixed`, dirección (arriba/abajo) calculada según
  espacio disponible.
- Display: `dd/MM/yyyy`, locale `es` de date-fns.
- Clear button (X) cuando hay valor.
- Popover principal con `shadow-xl shadow-black/50`.

### 9.10 SearchableSelect

Patrón combo: el input se comporta como texto filtrable; al hacer foco aparece
dropdown scrollable (`max-h-64 overflow-y-auto z-50`). Items con
`hover:bg-bg-surface`; item seleccionado `bg-accent/10 text-accent`.
Sin resultados: mensaje `"Sin resultados"`. Clear button (X) cuando hay valor.

---

## 10. Dashboards y visualización de datos

### 10.1 Grid de cards

```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4
```

- 1 columna en mobile → 4 columnas en XL.
- Gap 16px (`gap-4`).

### 10.2 EquipoCard (patrón de card con gauge)

Estructura de referencia:

```
┌────────────────────────────────────┐
│ Header  [icono 50px] + [badge]     │  p-3.5
├────────────────────────────────────┤
│                                    │
│         GAUGE RADIAL (ECharts)     │  h-[124px]
│                                    │
├────────────────────────────────────┤
│  Estatus | Prox. MP: NNN hrs       │  p-3.5
│  [────── progress bar ───────]     │
└────────────────────────────────────┘
```

- Borde izquierdo dinámico por estado:
  `style={{ borderLeft: `3px solid ${gaugeColor}73` }}` (hex + alpha).
- Gauge ECharts: `type: 'gauge'`, `radius: '90%'`, `startAngle: 210`, `endAngle: -30`,
  `fontFamily: 'JetBrains Mono'`, `fontSize: 17`.

### 10.3 Umbrales de color estándar

```ts
// Aplicable a "horas hasta próximo mantenimiento", progresos, etc.
function statusColor(value: number): string {
  if (value >= 200) return '#10B981'; // success
  if (value >= 80)  return '#F59E0B'; // warning
  return '#EF4444';                    // danger
}
```

Adaptar los umbrales al dominio, pero conservar la paleta semántica.

### 10.4 ECharts — configuración base

```ts
<ReactECharts
  option={option}
  style={{ height: '100%', width: '100%' }}
  opts={{ renderer: 'canvas' }}  // canvas > SVG para perf en grids grandes
/>
```

Reglas:
- Colores siempre desde los tokens del sistema (inyectar `getComputedStyle(...)
  .getPropertyValue('--color-accent')` si se necesita en runtime).
- Sin `title` en la gráfica (los títulos son parte de la Card contenedora, no del
  canvas).
- `tooltip.backgroundColor` = `--color-bg-card`; `tooltip.borderColor` = `--color-border`.
- Legends con `textStyle.color = --color-muted`.

### 10.5 KPI pills / badges de resumen

Fila horizontal de Badges sobre el grid, una por estado:

```tsx
<div className="flex flex-wrap gap-2 mb-4">
  <Badge variant="cyan" dot>{total} Total</Badge>
  <Badge variant="success" dot>{ok} Operables</Badge>
  <Badge variant="warning" dot>{alert} En revision</Badge>
  <Badge variant="danger" dot>{bad} Fuera de servicio</Badge>
</div>
```

---

## 11. Patrones de UX

### 11.1 Empty states

Siempre con icono + título + descripción. Acción opcional si hay algo que el usuario
puede hacer inmediatamente. Ejemplo canónico: **"Sin modulos disponibles / No hay
modulos habilitados para este centro"**.

### 11.2 Loading states

- **Tabla**: `ShimmerRow` × 5 filas, celdas con `animate-shimmer`.
- **Página completa**: fallback de `<Suspense>` con texto simple "Cargando…".
- **Botón** en acción: prop `loading={true}` sustituye icono por spinner y deshabilita.
- **Card individual**: shimmer sobre el área de datos, el resto del chrome se queda.

### 11.3 Error states

- **Field-level** en formularios: `text-xs text-danger mt-1` debajo del input.
- **Request-level**: banner superior de la página o toast (si el proyecto decide
  implementar un sistema de toasts).
- **Detalles técnicos** NO se muestran al usuario. Van al log del cliente.

### 11.4 Confirmación de acciones destructivas

`ConfirmDialog` variant `danger` para eliminar. Siempre describir qué se va a eliminar:
"¿Eliminar el equipo EX-4508? Esta acción no se puede deshacer."

### 11.5 Forms

- Inputs apilados verticalmente, ancho completo por defecto.
- Grid de 2 columnas (`grid grid-cols-1 md:grid-cols-2 gap-4`) cuando los campos son
  cortos.
- Validación **al blur** o al submit, nunca en cada tecla (evita ruido).
- Botones al final del modal/formulario, alineados a la derecha, orden **Cancelar
  (secondary) · Guardar (primary)**.
- Campo requerido: asterisco rojo pequeño junto al label.

### 11.6 Multi-tenant (multi-centro)

Si el proyecto tiene el concepto "centro" (sede, región, cliente):
- Selector en el Header.
- Persistir selección en `localStorage` vía store.
- Todas las queries toman el `centroId` activo; el backend filtra.
- Soporte multi-selección si el usuario tiene acceso a varios centros
  (`CentroMultiSelector`).

---

## 12. Iconografía

### 12.1 Lucide React

- Versión `^0.577.0`.
- Stroke width **default (2)** en todo el sistema — no mezclar.
- Tamaños estándar:

| Contexto | Tamaño |
|----------|--------|
| NavItem sidebar | 20px (`h-5 w-5`) |
| NavItem submenu | 16px (`h-4 w-4`) |
| Botón sm / md / lg | 14 / 16 / 18 px |
| Headers de sección | 24px |
| EmptyState | 48px |

### 12.2 SVG custom (dominio)

Para iconos específicos del negocio (equipos industriales, maquinaria, productos),
guardar SVG optimizados en `public/` con dimensiones nominales en el nombre:

```
/cargador-frontal_64x64.svg
/cargador-frontal_64x64-light.svg  ← variante clara
```

Uso:
```tsx
<img src={`/cargador-frontal_64x64${suffix}.svg`} className="h-[50px] w-[50px]" />
```

---

## 13. Animaciones y micro-interacciones

### 13.1 Keyframes propios

Definidos en `styles.css`:

```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### 13.2 Utilidades

- `.animate-fade-in-up` — 0.4s ease-out — entrada de páginas y cards.
- `.animate-fade-in` — 0.3s ease-out — modales, backdrops.
- `.animate-shimmer` — 1.5s infinite — skeletons de carga.
- `.animate-spin` (Tailwind) — loaders de Lucide `Loader2`.

### 13.3 Transiciones de estado

| Elemento | Clase |
|----------|-------|
| Cambios de color | `transition-colors` |
| Cambios mixtos | `transition` (default 150ms) |
| Sidebar colapso | `transition-all duration-300` |
| Progress bar fill | `transition-all duration-1000` |

### 13.4 Hover effects

- **Cards interactivas**: `hover:border-accent/40` (nunca escalar, nunca mover).
- **Botones**: `hover:bg-*/90` o cambio de borde.
- **NavItems**: `hover:bg-bg-surface/50 hover:text-text`.
- **Rows de tabla**: `hover:bg-bg-surface/50`.

Regla: las transformaciones geométricas (scale, translate) se evitan en UI densa.
Sólo se usan en entrada inicial (`fadeInUp`), no en hover.

---

## 14. Estado global y data-fetching

### 14.1 Zustand — cuándo usarlo

**Solamente** para:
- Sesión / usuario actual (`authStore`).
- Centro activo y centros disponibles (`appStore`).
- Estado UI persistente del shell (sidebar colapsado).

Los datos del servidor **no viven en Zustand**. Van en React Query.

Patrón mínimo:
```ts
export const useAppStore = create<AppState>((set) => ({
  centrosActivos: [],
  centroActivo: null,
  sidebarCollapsed: false,
  setCentrosActivos: (centros) => {
    persistCentros(centros);
    set({ centrosActivos: centros, centroActivo: centros[0] ?? null });
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
```

### 14.2 React Query — convenciones

- **Query keys** jerárquicas y tipadas: `['equipos', centroId]`, `['equipos', centroId, equipoId]`.
- **`staleTime` default** `15 * 60 * 1000` (15 min). Ajustar por dominio.
- **`retry: 1`** salvo endpoints críticos.
- **Invalidar** tras mutaciones con `queryClient.invalidateQueries({ queryKey: [...] })`.
- Multi-centro: `useQueries` + flatMap para agregar resultados.

```ts
const equiposQueries = useQueries({
  queries: centrosActivos.map((c) => ({
    queryKey: ['equipos', c.IDCentro],
    queryFn: () => apiGet<Equipo[]>('/api/equipos', { centroId: c.IDCentro }),
    enabled: centrosActivos.length > 0,
  })),
})
const equipos = useMemo(
  () => equiposQueries.flatMap((q) => q.data ?? []),
  [equiposQueries],
)
```

### 14.3 API client

Wrapper tipado en `src/api/client.ts`. Firma:

```ts
apiGet<T>(path, options?)
apiPost<T>(path, body?, options?)
apiPut<T>(path, body?, options?)
apiPatch<T>(path, body?, options?)
apiDelete<T>(path, options?)
```

`options` incluye `centroId` (se serializa como header `x-centro-id`) y lee el token
de auth del store.

---

## 15. Routing y navegación

### 15.1 React Router 7

- `createBrowserRouter` con un único `PlatformLayout` como root.
- **Lazy loading obligatorio** de cada módulo:
  ```ts
  const EquiposDashboardPage = lazy(
    () => import('./modules/mantenimiento/EquiposDashboardPage'),
  )
  ```
- `<Suspense fallback={...}>` envolviendo cada ruta hija.
- Ruta `*` → página 404 con estilo.

### 15.2 Vite manual chunks

Separar vendors pesados para mejorar la carga inicial:

```ts
manualChunks(id) {
  if (id.includes('echarts'))              return 'charts-vendor'
  if (id.includes('react-router'))         return 'router-vendor'
  if (id.includes('@tanstack/react-query'))return 'data-vendor'
  if (id.includes('react-day-picker'))     return 'datepicker-vendor'
}
```

### 15.3 Proxy en dev

```ts
server: {
  port: 5173,
  proxy: { '/api': 'http://localhost:3001' },
}
```

---

## 16. Accesibilidad

Nivel objetivo: **WCAG 2.1 AA**.

### 16.1 Contraste

- Texto principal sobre fondos dark/light cumple AA. Verificar al introducir nuevos
  colores con herramientas como `coolors.co/contrast-checker`.

### 16.2 Foco visible

- Todos los inputs/botones/links tienen focus ring (`ring-1 ring-accent/30`).
- Nunca `outline: none` sin reemplazo.

### 16.3 Teclado

- Modales cierran con **Escape**.
- Tab recorre en orden lógico.
- Enter envía formularios.
- Los componentes custom (SearchableSelect, CompactDropdown) implementan navegación
  con flechas cuando el caso lo requiere.

### 16.4 ARIA

- `aria-label` en botones icon-only (ej. Toggle sidebar, Cerrar modal, Limpiar fecha).
- `role="dialog"` + `aria-modal="true"` en modales.
- `aria-invalid="true"` en inputs con error.

### 16.5 Scrollbars

Custom sutil para webkit (ancho 8px, thumb `var(--color-border)`, hover
`var(--color-muted)`). Ver `styles.css` líneas 43-60.

---

## 17. Responsive y breakpoints

### 17.1 Breakpoints (Tailwind defaults)

| Prefix | Ancho | Dispositivo |
|--------|-------|-------------|
| (base) | 0+    | mobile |
| `sm:`  | 640px | mobile landscape / tablet pequeña |
| `md:`  | 768px | tablet |
| `lg:`  | 1024px | laptop |
| `xl:`  | 1280px | desktop |
| `2xl:` | 1536px | desktop ancho |

### 17.2 Patrones

- **Grids de cards**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
- **Grids de formularios**: `grid-cols-1 md:grid-cols-2`.
- **Sidebar**: fijo en desktop. Mobile: considerar drawer (no implementado aún en
  AdmonOps).
- **Tablas densas**: `overflow-x-auto` contenedor — nunca reflow a cards en mobile.
  Los usuarios de dominio entienden scrollear tablas.

---

## 18. Checklist de replicación

Si vas a aplicar este Design System en un proyecto nuevo, sigue este orden:

### Bootstrap del proyecto
- [ ] Crear proyecto Vite + React + TypeScript.
- [ ] Instalar dependencias del [stack técnico](#2-stack-tecnico).
- [ ] Configurar `tailwindcss@4` vía `@tailwindcss/vite`.
- [ ] Configurar alias `@` → `./src` en `vite.config.ts` y `tsconfig`.
- [ ] Importar fuentes **DM Sans** y **JetBrains Mono** en `index.html`.

### Tokens y tema
- [ ] Crear `src/styles.css` con el bloque `@theme` completo ([§3.1](#31-paleta--tema-oscuro-default)).
- [ ] Agregar override `[data-theme="light"]` ([§3.2](#32-paleta--tema-claro)).
- [ ] Copiar bloque `@layer base` (scrollbars, inputs date/time) de `styles.css`.
- [ ] Copiar bloque `@layer utilities` (keyframes + animaciones).
- [ ] Copiar clases `rdp-admon` si vas a usar DatePicker.

### Layout
- [ ] Crear `PlatformLayout` con flex horizontal: Sidebar + (Header + Outlet).
- [ ] Crear `Sidebar` con colapso persistente en Zustand + `localStorage`.
- [ ] Crear `Header` con slot de título/breadcrumb + user menu.
- [ ] Implementar toggle dark/light en el user menu.

### Primitivas
- [ ] Portar los componentes base tal cual: `Button`, `Card`, `Badge`, `Input`,
      `Select`, `SearchableSelect`, `Modal`, `ConfirmDialog`, `Table`,
      `EmptyState`, `DatePicker`.
- [ ] Ajustar sólo nombres de dominio, **no** estilos.

### Estado e infra
- [ ] Stores Zustand: `authStore`, `appStore` (o equivalentes del proyecto).
- [ ] Client API tipado en `src/api/client.ts`.
- [ ] `QueryClient` configurado en `App.tsx` con defaults de `staleTime` y `retry`.
- [ ] Router con `lazy()` + `Suspense` por módulo.
- [ ] Manual chunks en Vite para ECharts, react-router, react-query, datepicker.

### Auditoría visual
- [ ] Navegar toda la app en dark mode. Nada queda "fuera de tono".
- [ ] Navegar toda la app en light mode. Idem.
- [ ] Probar focus ring en cada input/botón.
- [ ] Probar modal + confirm dialog + escape.
- [ ] Probar tabla con 0, 1 y muchas filas (shimmer, empty, normal).
- [ ] Probar sidebar colapsado + expandido en los breakpoints principales.
- [ ] Verificar contraste WCAG AA con herramienta externa.

### Documentación local
- [ ] Copiar este archivo (`DESIGN_SYSTEM.md`) a la raíz del nuevo proyecto.
- [ ] Añadir referencia en `CLAUDE.md` o `README.md` del proyecto nuevo.

---

## Apéndice A — Dependencias exactas (package.json del web)

```json
{
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
    "@vitejs/plugin-react": "^6.0.1",
    "tailwindcss": "^4.2.2",
    "typescript": "^5.9.3",
    "vite": "^8.0.1"
  }
}
```

---

## Apéndice B — Archivos canónicos de referencia

Ruta base: `AdmonOps/web/src/`

| Archivo | Responsabilidad |
|---------|-----------------|
| `styles.css` | Design tokens, animaciones, globales, scrollbar, rdp |
| `components/layout/PlatformLayout.tsx` | Shell con Sidebar + Header + Outlet |
| `components/layout/Sidebar.tsx` | Navegación con grupos, active states, colapso |
| `components/layout/Header.tsx` | Logo, centro selector, user menu, theme toggle |
| `components/ui/Button.tsx` | Botón base con variantes/size/loading |
| `components/ui/Card.tsx` | Card + CardHeader |
| `components/ui/Badge.tsx` | Badge 6 variantes + dot opcional |
| `components/ui/Input.tsx` | Input con label/error/required |
| `components/ui/Select.tsx` | Select con chevron custom |
| `components/ui/SearchableSelect.tsx` | Combo filtrable con dropdown |
| `components/ui/Table.tsx` | Tabla tipada genérica + shimmer + empty |
| `components/ui/Modal.tsx` | Modal con portal + backdrop blur + escape |
| `components/ui/ConfirmDialog.tsx` | Dialog de confirmación destructiva |
| `components/ui/DatePicker.tsx` | DatePicker custom con CompactDropdown |
| `components/ui/EmptyState.tsx` | Estado vacío con icon + title + desc + action |
| `store/appStore.ts` | Centros, sidebar, módulos habilitados |
| `store/authStore.ts` | Usuario, permisos, sesión |
| `api/client.ts` | apiGet/apiPost/... tipados con token + centroId |
| `App.tsx` | Router + QueryClient + lazy loading |

---

## Apéndice C — Matriz de decisiones rápidas

| Situación | Usa |
|-----------|-----|
| Mostrar un botón de acción primaria | `<Button variant="primary">` |
| Mostrar un botón destructivo | `<Button variant="danger">` |
| Mostrar un estado operable/saludable | `<Badge variant="success" dot>` |
| Mostrar un estado en revisión | `<Badge variant="warning" dot>` |
| Mostrar un estado crítico / fuera de servicio | `<Badge variant="danger" dot>` |
| Contar un total con énfasis cyan | `<Badge variant="cyan" dot>` |
| Pedir confirmación antes de eliminar | `<ConfirmDialog variant="danger">` |
| Mostrar formulario complejo | `<Modal size="lg">` con grid 2 cols |
| Listado de registros con filtros/paginación | `<Table>` con `Column[]` tipado |
| Gráfica radial tipo gauge | ECharts `type: 'gauge'` dentro de `<Card>` |
| Selector de fecha | `<DatePicker>` custom (no input nativo) |
| Selector con muchas opciones + búsqueda | `<SearchableSelect>` |
| Estado vacío con icono + CTA | `<EmptyState icon={...} action={...}>` |

---

**Fin del documento.**

Cualquier extensión o nueva primitiva debe mantener: *dark-first*, *tokens centralizados*,
*primitivas componibles*, *contraste WCAG AA*, *consistencia radical*.