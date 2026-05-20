# Overload Series Fantasy Manager

Fantasy manager online para la liga simulada **Overload Series Simulación**.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Framer Motion
- Supabase Auth, PostgreSQL, RPC y Realtime

## Arranque local

```bash
npm install
npm run dev
```

En Windows PowerShell, si `npm` está bloqueado por la política de scripts:

```bash
npm.cmd install
npm.cmd run dev
```

## Configurar Supabase

1. Crea o abre tu proyecto de Supabase.
2. Copia `.env.example` a `.env.local`.
3. Añade la URL del proyecto y la publishable/anon key:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_publishable_o_anon_key
```

No pongas una `service_role` o `sb_secret_*` en el frontend.

4. En el SQL Editor de Supabase ejecuta, por orden:
   - `supabase/schema.sql`
   - `supabase/policies.sql`
   - `supabase/rpc.sql`
   - `supabase/seed.sql`
5. Activa Realtime para `league_members`, `league_players`, `transfers`, `activity_feed`, `matchdays`, `matches` y `player_match_stats`.
6. Ejecuta la app y regístrate con email y contraseña.

En **Authentication > URL Configuration** pon:

- Site URL local: `http://127.0.0.1:5174`
- Redirect URLs locales:
  - `http://127.0.0.1:5174/auth/callback`
  - `http://localhost:5174/auth/callback`
- Cuando publiques la app, añade también `https://tu-dominio.com/auth/callback`.

También puedes usar la CLI de Supabase, pero necesitas iniciar sesión con un `SUPABASE_ACCESS_TOKEN` y enlazar el proyecto:

```bash
npx supabase login
npx supabase link --project-ref ipegwbbiuryviechkssc
npx supabase db push
npx supabase db seed
```

La URL y la publishable key no permiten crear tablas por sí solas; para desplegar el esquema remoto hace falta SQL Editor, access token de Supabase o la contraseña real de Postgres.

## Dejarlo online de verdad

Para que crear liga funcione en Supabase, el proyecto remoto debe tener instaladas las tablas y funciones. Si la app muestra que falta `create_league`, ejecuta los SQL del apartado anterior o usa:

```bash
npx supabase link --project-ref ipegwbbiuryviechkssc
npx supabase db push
```

Después carga los datos iniciales:

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
psql "$SUPABASE_DB_URL" -c "select set_config('request.jwt.claim.role', 'service_role', true); select public.sync_all_leagues_from_official();"
```

`SUPABASE_DB_URL` debe ser la cadena Postgres real con password, no la URL pública ni la publishable key.

## Publicar la web

### Vercel

1. Sube este proyecto a GitHub.
2. Entra en https://vercel.com y pulsa **Add New Project**.
3. Importa el repositorio.
4. En **Environment Variables** añade:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_o_publishable_key
```

5. Deja:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
6. Pulsa **Deploy**.
7. En Supabase, ve a **Authentication > URL Configuration** y añade:
   - Site URL: `https://tu-dominio.vercel.app`
   - Redirect URL: `https://tu-dominio.vercel.app/auth/callback`

El archivo `vercel.json` ya incluye la redirección necesaria para que rutas como `/league/.../team` funcionen al recargar.

### Netlify

1. Sube el proyecto a GitHub.
2. Entra en https://app.netlify.com y pulsa **Add new site > Import an existing project**.
3. Selecciona el repositorio.
4. Añade las mismas variables:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_o_publishable_key
```

5. Usa:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Pulsa **Deploy**.
7. En Supabase añade el dominio de Netlify como Site URL y `https://tu-dominio.netlify.app/auth/callback` como Redirect URL.

El archivo `netlify.toml` ya está preparado para SPA routing.

## Sincronización automática

El repositorio incluye `.github/workflows/sync-challenge.yml`. En GitHub, crea el secret:

```text
SUPABASE_DB_URL=postgresql://postgres:<PASSWORD>@db.ipegwbbiuryviechkssc.supabase.co:5432/postgres
```

El workflow se ejecuta cada 5 minutos y hace:

- descarga el snapshot actual de Challenge Place,
- actualiza equipos, jugadores, posiciones, precios, jornadas y partidos oficiales,
- refresca todas las ligas privadas existentes,
- recalcula puntos,
- resuelve subastas de mercado vencidas.

### Sincronizacion casi en tiempo real

Challenge Place no expone webhooks publicos en la pagina de la liga. Para que la app cambie en cuanto detecte una modificacion oficial, ejecuta un watcher permanente en un servidor propio, Railway, Render, Fly.io, una VPS o similar:

```bash
SUPABASE_DB_URL="postgresql://postgres:<PASSWORD>@db.<PROJECT>.supabase.co:5432/postgres"
CHALLENGE_SYNC_INTERVAL_MS=60000
npm run sync:challenge:watch
```

El watcher consulta Challenge cada 60 segundos por defecto. Si detecta cambios, actualiza Supabase, recalcula todas las ligas y Supabase Realtime refresca las pantallas abiertas en web, Android e iOS. Sin un webhook oficial de Challenge, esto es lo mas cercano a "al momento"; puedes bajar o subir `CHALLENGE_SYNC_INTERVAL_MS` segun el servidor y el trafico que quieras asumir.

La app tambien guarda el ultimo estado del watcher en `challenge_sync_status`. Ese estado aparece en el menu como **Challenge en vivo**, por lo que puedes ver si el proceso esta comprobando, si aplico cambios o si hubo un error. El boton **Actualizar Challenge** crea una solicitud en `challenge_sync_requests`; el watcher la atiende en el siguiente ciclo y fuerza una comprobacion.

Para desplegar el watcher en Render:

1. Sube el repo a GitHub.
2. En Render crea un **Blueprint** usando `render.yaml`, o crea un **Background Worker** con Docker y `Dockerfile.worker`.
3. Anade la variable privada `SUPABASE_DB_URL`.
4. Deja `CHALLENGE_SYNC_INTERVAL_MS=60000` o bajalo si quieres mas inmediatez.
5. Arranca el worker. Mientras este activo, web y apps moviles se actualizaran por Supabase Realtime.

No pongas `SUPABASE_DB_URL` en variables `VITE_`: es una credencial de servidor y solo debe vivir en el worker, GitHub Actions o una maquina privada.

## Datos Challenge

El snapshot actual está generado desde **Temporada 1 GO**:

- `1117` jugadores
- `39` equipos/bolsa
- `6` jornadas
- `84` partidos
- jornada actual: `6`

Para refrescarlo manualmente:

```bash
npm run sync:challenge
```

Esto regenera:

- `src/data/challengeData.ts`
- `src/data/challengeFixtures.ts`
- `supabase/seed.sql`

Con el workflow activo y el secret `SUPABASE_DB_URL` configurado, la app online se refresca automaticamente: el job descarga Challenge, sube el seed, ejecuta `sync_all_leagues_from_official()` y Supabase Realtime avisa a las pantallas abiertas. En local puedes forzarlo con `npm run sync:challenge` y aplicando `supabase/seed.sql`.

## App movil

El proyecto incluye Capacitor para empaquetar Android/iOS con los mismos datos online de Supabase.

```bash
npm run cap:sync
npm run android:apk
```

El APK debug se genera en:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Tambien hay una copia preparada en:

```text
artifacts/overload-fantasy-debug.apk
```

Para iOS se genera el proyecto en `ios/`, pero el `.ipa` requiere macOS + Xcode + cuenta/certificados de Apple para firmar y archivar.

### Instalar en iPhone sin App Store

La via mas rapida para probarlo en iOS es usarlo como PWA:

1. Publica la app en una URL HTTPS, por ejemplo Vercel o Netlify.
2. Abre esa URL desde Safari en el iPhone.
3. Toca Compartir.
4. Toca Anadir a pantalla de inicio.
5. Se instalara con el icono de Overload Fantasy y abrira en modo app.

La app ya incluye:

- `public/manifest.webmanifest`
- `apple-mobile-web-app-capable`
- `apple-mobile-web-app-title`
- `apple-touch-icon`
- iconos `192x192` y `512x512`

Esto no genera un `.ipa`; es una web app instalable. Sigue usando Supabase online, login real y ligas privadas.

### Instalar como app iOS nativa

Para una app nativa instalable por TestFlight o App Store:

1. Abre el proyecto `ios/App/App.xcworkspace` en un Mac con Xcode.
2. Configura el bundle id y el equipo de firma de Apple.
3. Ejecuta `npm run build` y `npx cap sync ios`.
4. En Xcode, crea un Archive.
5. Sube el build a App Store Connect.
6. Distribuyelo con TestFlight o mandalo a revision de App Store.

En Windows se puede generar el proyecto iOS de Capacitor, pero no se puede firmar ni exportar un `.ipa` valido sin Xcode/macOS.

## Flujo principal

1. Regístrate o inicia sesión.
2. Crea una liga privada o únete con código.
3. Invita amigos desde el código o enlace de la liga.
4. Puja por los 10 jugadores del mercado diario. Cada ciclo dura 24 horas.
5. Cuando termina el ciclo, el manager con la puja más alta se lleva al jugador.
6. Paga cláusulas o sube cláusulas pagando presupuesto.
7. Sube tu alineacion para la siguiente jornada.
8. El watcher sincroniza jugadores, posiciones, resultados y puntos desde Challenge.
9. La clasificación se recalcula y se actualiza con Realtime.

## Sin modo demo

La app esta pensada para jugar online con Supabase. Si faltan `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`, se muestra el login pero no se ofrece modo demo. `localStorage` queda reservado para preferencias locales y cache ligera.

## Estructura

```text
src/
  components/
  data/
  hooks/
  lib/
  pages/
  store/
  types/
  utils/
supabase/
  schema.sql
  policies.sql
  rpc.sql
  seed.sql
```
#   F a n t a s y - O v e r l o a d  
 
#   F a n t a s y - O v e r l o a d  
 