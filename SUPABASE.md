# Supabase en JIT Monitor (complemento al backend)

Supabase se usa **solo en el frontend** como complemento al backend Express existente. El backend (`server/`) **no se modifica**: sigue sirviendo la API con Prisma y SQLite (reportes, simulación, predicción, etc.).

## Rol de Supabase

- **Auth**: inicio y cierre de sesión en la app (email/contraseña). La sesión se guarda en el navegador; el resto de la app sigue funcionando igual con o sin sesión.
- **Futuro opcional**: base de datos en la nube (Postgres), Realtime, Storage o backups sin sustituir la API actual.

## Configuración

1. Crea un proyecto en [supabase.com](https://supabase.com) (Dashboard → New project).
2. En **Project Settings → API** copia:
   - **Project URL**
   - **anon public** (clave pública)
3. En la raíz del repo crea un archivo `.env` (o edita el existente) con:

   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

4. Reinicia el servidor de desarrollo (`npm run dev`).

Si no configuras estas variables, la app funciona igual; el bloque "Sesión (Supabase)" en el sidebar no se mostrará.

## Uso en la app

- Con Supabase configurado, en el sidebar aparece el bloque **Sesión (Supabase)**.
- Puedes **registrar** usuarios desde el Dashboard de Supabase (Authentication → Users → Add user) o habilitar registro en Authentication → Providers → Email.
- **Iniciar sesión**: escribe correo y contraseña en el sidebar y pulsa "Iniciar sesión".
- **Cerrar sesión**: botón "Cerrar sesión" en el mismo bloque.

Las llamadas a la API (reportes, simulación, etc.) siguen yendo al backend Express; Supabase solo gestiona la identidad del usuario en el frontend. Si más adelante quieres que el backend verifique el JWT de Supabase en rutas protegidas, se puede añadir sin cambiar la lógica de negocio existente.
