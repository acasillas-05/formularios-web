# Despliegue en Azure — checklist end-to-end

Plataforma: **Azure** con tres recursos principales (BD plataforma, API, frontend)
y dos integraciones (Entra ID + BDADN existente).

> Esta guia es para Fase 9. Asume que las Fases 0-8 ya estan en main y todos
> los smoke tests pasaron en local. La fase puede ejecutarse colaborativamente:
> tu en el portal/CLI, yo guiando con snippets.

---

## Arquitectura objetivo

```
                                                Azure
   ┌────────────────────────┐    ┌──────────────────────────────────┐
   │  Usuario @adnenergia   │    │                                  │
   │       (browser)        │◄───┤  Static Web Apps (frontend SPA)  │
   └───────────┬────────────┘    │  formularios.adnenergia.com      │
               │ MSAL redirect    └──────────────┬───────────────────┘
               │                                 │ HTTPS /api/*
               ▼                                 ▼
   ┌────────────────────────┐    ┌──────────────────────────────────┐
   │  Microsoft Entra ID    │    │  App Service Linux (API Node 22) │
   │  Tenant adnenergia.com │◄───┤  api.formularios.adnenergia.com  │
   └────────────────────────┘    └────────────┬──────────────┬──────┘
                                              │              │
                                              ▼              ▼
                                ┌──────────────────┐  ┌──────────────────┐
                                │ Azure SQL        │  │ Azure SQL        │
                                │ admonops_platform│  │ BDADN (existente)│
                                │ (auth, audit)    │  │ (SPs operativos) │
                                └──────────────────┘  └──────────────────┘
```

Recursos a crear: 1 SQL Server logico + 1 BD plataforma, 1 App Registration
del frontend, 1 App Registration del API, 1 App Service (Linux + Node 22) y
1 Static Web App.

---

## 0. Pre-requisitos

- Suscripcion Azure con permisos de Owner o Contributor + User Access
  Administrator en el Resource Group.
- Permiso de Application Administrator en el tenant para crear App
  Registrations (o pedirselo al admin del tenant).
- Acceso a BDADN (Azure SQL existente) para agregar la IP del App Service
  al firewall.
- Dominio `formularios.adnenergia.com` (o el que acuerden) con DNS
  controlado para crear CNAMEs.

---

## 1. App Registrations en Entra ID

Crea **dos** App Registrations en `portal.azure.com → Microsoft Entra ID →
App registrations → New registration`.

### 1.1 API — "Formularios ADN API"

- **Supported account types**: solo el directorio de la organizacion (single tenant)
- **Redirect URI**: dejar vacio
- Tras crear, copia el **Application (client) ID** -> sera `AZURE_AD_CLIENT_ID` del API.
- Tab **Expose an API**:
  - Define una Application ID URI: `api://<client-id-del-api>`
  - Esa URI sera el `AZURE_AD_AUDIENCE` del API.
  - Add a scope: nombre `access_as_user`, who can consent: Admins and users.

### 1.2 SPA — "Formularios ADN SPA"

- **Supported account types**: solo el directorio de la organizacion
- **Redirect URI**:
  - Platform: Single-page application
  - URI: `https://formularios.adnenergia.com` (y luego en dev `http://localhost:5174`)
- Copia el **Application (client) ID** -> sera `VITE_AZURE_CLIENT_ID`.
- Tab **API permissions**:
  - Add a permission > APIs my organization uses > "Formularios ADN API"
  - Selecciona el scope `access_as_user`
  - Click "Grant admin consent for adnenergia"

> El `tenantId` es comun a los dos: lo encuentras en la pagina principal
> del directorio. Sera `AZURE_AD_TENANT_ID` y `VITE_AZURE_TENANT_ID`.

---

## 2. Azure SQL — base de plataforma

Una BD nueva, separada de BDADN, donde viven `Usuario`, `UsuarioFormPermiso`,
`SubmissionLog` y `NotificationQueue`.

### 2.1 Crear el server (si no tienes uno) y la base

```bash
RG=rg-formularios-web
LOCATION=mexicocentral
SQL_SERVER=adnplatform                       # adnplatform.database.windows.net
SQL_ADMIN=adnplatformadmin
SQL_PASSWORD='<genera-una-fuerte>'
SQL_DB=admonops_platform

az group create -n $RG -l $LOCATION

az sql server create \
  -n $SQL_SERVER -g $RG -l $LOCATION \
  -u $SQL_ADMIN -p "$SQL_PASSWORD"

az sql db create \
  -n $SQL_DB -g $RG -s $SQL_SERVER \
  --service-objective S0
```

### 2.2 Aplicar migraciones de Prisma (desde local con la IP en firewall)

```bash
# Permite tu IP temporalmente
MY_IP=$(curl -s ifconfig.me)
az sql server firewall-rule create -g $RG -s $SQL_SERVER -n my-ip \
  --start-ip-address $MY_IP --end-ip-address $MY_IP

# Genera las migraciones contra el schema de prod (PRIMERA VEZ)
cd api
DATABASE_URL="sqlserver://$SQL_SERVER.database.windows.net:1433;database=$SQL_DB;user=$SQL_ADMIN;password=$SQL_PASSWORD;encrypt=true" \
  npm run db:migrate:prod -- --name init_platform_prod

# Despues commitea prisma/migrations-sqlserver/<timestamp>_init_platform_prod
git add prisma/migrations-sqlserver
git commit -m "chore: migracion inicial de prisma para sqlserver"
```

### 2.3 Seed inicial

El seed (`prisma/seed.ts`) crea al admin con email `operacionesadn@adnenergia.com`.
En prod tambien lo necesitas. Ejecuta:

```bash
DATABASE_URL="sqlserver://..." \
  npx tsx prisma/seed.ts
```

---

## 3. App Service para el API

### 3.1 Crear App Service

```bash
PLAN=plan-formularios
APP=formularios-api

az appservice plan create -n $PLAN -g $RG -l $LOCATION --is-linux --sku B1
az webapp create -n $APP -g $RG -p $PLAN --runtime "NODE:22-lts"
```

### 3.2 Application Settings (envs)

Copia los valores reales desde `api/.env.production.example`:

```bash
az webapp config appsettings set -g $RG -n $APP --settings \
  NODE_ENV=production \
  PORT=8080 \
  WEBSITES_PORT=8080 \
  DATABASE_URL="sqlserver://..." \
  BDADN_SERVER=adnprod.database.windows.net,1433 \
  BDADN_DATABASE=BDADN \
  BDADN_USER=... \
  BDADN_PASSWORD=... \
  BDADN_ENCRYPT=true \
  BDADN_TRUST_SERVER_CERTIFICATE=false \
  BDADN_POOL_MIN=2 \
  BDADN_POOL_MAX=20 \
  AZURE_AD_TENANT_ID=... \
  AZURE_AD_CLIENT_ID=... \
  AZURE_AD_AUDIENCE="api://..." \
  CORS_ORIGINS=https://formularios.adnenergia.com
```

> Recomendacion: en lugar de poner `BDADN_PASSWORD` directo, usa
> [Key Vault references](https://learn.microsoft.com/en-us/azure/app-service/app-service-key-vault-references)
> con la sintaxis `@Microsoft.KeyVault(SecretUri=...)`.

### 3.3 Firewall de Azure SQL

Permite que el App Service se conecte a las dos BDs:

```bash
# Permitir servicios de Azure (incluye App Service)
az sql server firewall-rule create -g $RG -s $SQL_SERVER -n allow-azure \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0

# Para BDADN, repetir con su server:
az sql server firewall-rule create -g <RG-BDADN> -s adnprod -n allow-azure \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

### 3.4 Build & deploy

**Opcion A: deploy directo desde repo (recomendado para empezar)**

Conecta el App Service al GitHub repo via Deployment Center. Setea el
build command en `package.json` raiz:

```json
"scripts": {
  "build": "npm run build:prod -w api && npm run build -w web"
}
```

App Service Linux ejecutara `npm run build && npm start` automaticamente.

> El `start` de `api/package.json` es `node dist/index.js`. App Service
> debe arrancar el workspace api: en Deployment Center pon
> *Startup command*: `cd api && node dist/index.js`.

**Opcion B: Container con Dockerfile**

```bash
ACR=adnformulariosacr
az acr create -n $ACR -g $RG --sku Basic --admin-enabled true
az acr login -n $ACR

docker build -f api/Dockerfile -t $ACR.azurecr.io/formularios-api:v1 .
docker push $ACR.azurecr.io/formularios-api:v1

az webapp config container set -g $RG -n $APP \
  --docker-custom-image-name $ACR.azurecr.io/formularios-api:v1 \
  --docker-registry-server-url https://$ACR.azurecr.io
```

### 3.5 Custom domain + SSL

```bash
az webapp config hostname add -g $RG --webapp-name $APP \
  --hostname api.formularios.adnenergia.com

# Crear el CNAME en tu DNS apuntando a $APP.azurewebsites.net
# Despues, vincular un certificado managed (gratis para este dominio):
az webapp config ssl bind --certificate-thumbprint <thumb> --ssl-type SNI \
  -n $APP -g $RG
```

---

## 4. Static Web Apps para el frontend

### 4.1 Crear el recurso

Por portal: `Static Web Apps → Create`. En *Build details*:
- App location: `web`
- Output location: `dist`
- Api location: vacio (NO usamos las managed functions)

Esto crea un GitHub Action que builda y deploya en cada push a main.

### 4.2 Variables de build

En **Configuration > Environment variables**:

```
VITE_API_BASE_URL=https://api.formularios.adnenergia.com
VITE_AZURE_TENANT_ID=...
VITE_AZURE_CLIENT_ID=...
VITE_AZURE_REDIRECT_URI=https://formularios.adnenergia.com
```

### 4.3 staticwebapp.config.json

Ya esta en `web/staticwebapp.config.json`. Reemplaza `__API_HOST__` con
el dominio real del API antes de subir, o usa el "Linked backend" de SWA
(ver doc oficial) para evitar la doble configuracion.

### 4.4 Custom domain

```bash
az staticwebapp hostname set --hostname formularios.adnenergia.com \
  -n <swa-name> -g $RG
```

---

## 5. Smoke production

Una vez todo arriba:

```bash
# Health del API (publico)
curl https://api.formularios.adnenergia.com/api/health

# Diagnostics (requiere admin token)
curl -H "Authorization: Bearer <token>" \
     https://api.formularios.adnenergia.com/api/admin/diagnostics
```

Desde el navegador:
1. https://formularios.adnenergia.com → MSAL redirect a login.microsoftonline.com
2. Tras login con tu cuenta @adnenergia → vuelve y ves `/formularios` con 11 cards
3. Submit "Registrar Unidades (ADN)" con `PLACAPRODTEST001` → toast verde
4. Verifica en `/admin/auditoria` que aparece la submission

---

## 6. Apagar Forms + Power Automate

Solo despues de confirmar que la plataforma corre estable durante una
ventana de uso real (recomendado: 1 semana de produccion paralela).

1. Compara conteo de submissions de la plataforma vs filas insertadas en
   BDADN durante el periodo de prueba.
2. Apaga el flujo de Power Automate de cada form (`Utils_PowerAdn_*`).
3. En Forms, edita la portada de cada formulario poniendo un link a la
   nueva URL de la plataforma + mensaje "Este formulario fue migrado".
4. Despues de 1-2 semanas mas, archiva los Forms.

---

## 7. Operacion ongoing

- **Backups**: Azure SQL S0 ya incluye point-in-time restore 7 dias.
  Revisa que este activo. Para retencion mas larga, aumenta el tier o
  configura long-term retention.
- **Monitoring**: agrega Application Insights al App Service y conecta los
  logs de `requestLogger` (formato JSON en prod) al workspace de Log Analytics.
- **Alertas**: SLA recomendado:
  - 5xx > 5/min sostenidos -> page
  - latencia P95 /api/forms/*/submit > 5s -> warn
  - notification queue con > 100 pending sin sent_at -> investigar transporter
- **Rotacion de secretos**: la password de BDADN deberia rotarse
  trimestralmente. Hacerlo via Key Vault evita downtime (App Service detecta
  el cambio del secret).

---

## 8. Rollback plan

Si la nueva plataforma falla:

1. Re-encender los flujos de Power Automate (estaban en "Off", no borrados)
2. Quitar el redirect en Forms para que vuelvan a aceptar respuestas
3. Investigar el problema en la plataforma offline
4. Re-deploy cuando este corregido

Los datos en BDADN nunca se ven afectados por un rollback porque la
plataforma solo invoca SPs ya existentes — ningun cambio de schema.
