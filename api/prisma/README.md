# Prisma — workflow dev / prod

La plataforma soporta dos motores via dos schemas:

| Entorno | Schema | Migraciones | Provider |
|---------|--------|-------------|----------|
| dev local | `schema.prisma` | `migrations/` | sqlite |
| produccion | `schema.prod.prisma` | `migrations-sqlserver/` | sqlserver |

Ambos schemas declaran exactamente los mismos modelos. Cualquier cambio
estructural debe replicarse en los dos archivos.

## Dev (SQLite)

```bash
# desde api/
npx prisma migrate dev --name <descripcion>
npx prisma db seed
npx prisma studio          # explorador GUI
```

`DATABASE_URL` debe apuntar a `file:./dev.db`.

## Produccion (Azure SQL)

Antes del primer deploy:

```bash
# 1. Genera la migracion inicial contra Azure SQL
DATABASE_URL="sqlserver://..." \
  npx prisma migrate dev \
    --schema prisma/schema.prod.prisma \
    --name init_platform_prod

# Esto crea prisma/migrations-sqlserver/<timestamp>_init_platform_prod/migration.sql
# Esa SQL se commitea al repo.

# 2. Genera el client contra el schema de prod
npx prisma generate --schema prisma/schema.prod.prisma
```

En el pipeline de deploy (Azure DevOps / GitHub Actions / App Service deployment):

```bash
DATABASE_URL=$AZURE_SQL_CONN_STRING \
  npx prisma migrate deploy --schema prisma/schema.prod.prisma
```

`migrate deploy` solo aplica migraciones existentes (no crea nuevas) — es la
forma segura de avanzar el schema en produccion.

## Cambiar el schema (workflow recomendado)

1. Edita `prisma/schema.prisma` con el cambio.
2. `npx prisma migrate dev --name <cambio>` para aplicarlo en dev.
3. **Replica el cambio en `prisma/schema.prod.prisma`** (mismo modelo,
   ajustando tipos `@db.NVarChar(Max)` si aplica).
4. Cuando despliegues a prod: con DATABASE_URL apuntando a Azure SQL,
   `npx prisma migrate dev --schema prisma/schema.prod.prisma --name <cambio>`
   para crear la migracion equivalente en `migrations-sqlserver/`.
5. Commitea ambos directorios de migraciones.
6. En el pipeline de prod: `npx prisma migrate deploy --schema prisma/schema.prod.prisma`.

## Reglas de tipo cross-provider

| Tipo Prisma | SQLite | SQL Server | Override prod |
|-------------|--------|-----------|---------------|
| `String` | TEXT | NVARCHAR(1000) | usar `@db.NVarChar(Max)` para textos grandes |
| `String` (id uuid) | TEXT | NVARCHAR(1000) | OK |
| `DateTime` | NUMERIC (epoch) | DATETIME2 | OK |
| `Int` | INTEGER | INT | OK |
| `Boolean` | INTEGER 0/1 | BIT | OK |

Si necesitas `BIGINT` (ej. IDs de SAP), usa `BigInt` en Prisma — pero ojo
con la serializacion JSON (Prisma no lo serializa por default; convertir a
string en la capa API si vas a enviarlo al cliente).
