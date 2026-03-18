# Supabase en JIT Monitor (backend + frontend)

Este proyecto ahora usa **Supabase PostgreSQL** como base de datos del backend (`server/`) en lugar de SQLite.

## 1) Backend (Prisma + Supabase Postgres)

El backend Express sigue igual en lógica y endpoints, pero Prisma apunta a Postgres.

### Variables requeridas en `server/.env`

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.TU_PROJECT_REF.supabase.co:5432/postgres?sslmode=require"
PORT=4000
```

### Crear tablas (elige una sola opción)

Opción A (recomendada): usar migraciones Prisma.

```bash
cd server
npx prisma generate
npx prisma migrate deploy
npm run import:reto2
```

Opción B: crear tablas manualmente en SQL Editor.

1. Abre Supabase -> SQL Editor.
2. Ejecuta el SQL de [server/prisma/supabase_schema.sql](./server/prisma/supabase_schema.sql).
3. Después ejecuta solo:

```bash
cd server
npx prisma generate
npm run import:reto2
```

> Nota: el importador `import:reto2` carga los datos JIT desde `Archivos_Reto2/BESI JIS AKSYS CW 09.xlsx`.

## 2) Frontend (Supabase Auth)

Si quieres mantener autenticación en frontend con Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_publishable_key
```

Si estas variables no están definidas, la app sigue funcionando, solo oculta el bloque de sesión.
