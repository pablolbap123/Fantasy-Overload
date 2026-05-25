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

## Sincronizacion con Challenge

La app puede actualizar Challenge de dos formas: con el boton **Actualizar Challenge**, que crea una solicitud en `challenge_sync_requests`, o con un watcher automatico por intervalo usando `CHALLENGE_AUTO_SYNC_MS`.

Ejecuta un watcher permanente en un servidor propio, Railway, Render, Fly.io, una VPS o similar:

```bash
SUPABASE_DB_URL="postgresql://postgres:<PASSWORD>@db.<PROJECT>.supabase.co:5432/postgres"
CHALLENGE_REQUEST_POLL_MS=15000
# Opcional: 300000 = revisar Challenge cada 5 minutos. 0 = solo boton manual.
CHALLENGE_AUTO_SYNC_MS=0
npm run sync:challenge:watch
```

Si `CHALLENGE_AUTO_SYNC_MS` es `0`, el watcher solo revisa la tabla de solicitudes. Si lo configuras por encima de `0`, tambien descarga Challenge en ese intervalo, actualiza equipos, jugadores, posiciones, precios, jornadas y partidos oficiales, recalcula ligas y avisa por Supabase Realtime.

La sincronizacion de Challenge tambien actualiza cambios de club y de posicion. Los fichajes hechos desde el 11/05/2026 no se aplican a las jornadas 1-6: esas jornadas se calculan con los clubes anteriores y desde la jornada 7 se usa la plantilla actual. Si Challenge trae dos posiciones para un jugador, se guardan en `players.positions` y la app las usa para alineaciones y filtros; la posicion principal queda en `players.position`.

La app guarda el ultimo estado en `challenge_sync_status`. Ese estado aparece como **Challenge manual**, por lo que puedes ver si la ultima actualizacion se aplico o si hubo un error.

Para desplegar el watcher en Render:

1. Sube el repo a GitHub.
2. En Render crea un **Blueprint** usando `render.yaml`, o crea un **Background Worker** con Docker y `Dockerfile.worker`.
3. Anade la variable privada `SUPABASE_DB_URL`.
4. Deja `CHALLENGE_REQUEST_POLL_MS=15000`.
5. Arranca el worker. Mientras este activo, web y apps moviles se actualizaran cuando alguien pulse el boton.

No pongas `SUPABASE_DB_URL` en variables `VITE_`: es una credencial de servidor y solo debe vivir en el worker o una maquina privada.

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

En local puedes forzar una actualizacion tecnica con `npm run sync:challenge` y aplicando `supabase/seed.sql`, pero el flujo normal online es el boton de la app.

## Sistema de puntuacion actual

La app usa estas reglas por defecto, editables por liga desde `scoring_rules`:

- Partido jugado: +2 si juega mas de 60 minutos, +1 si juega menos.
- Gol: POR/DEF +6, MED +5, DEL +4.
- Asistencia de gol +3 y asistencia sin gol +1.
- Porteria a cero con mas de 60 minutos: POR +4, DEF +4, MED +2, DEL +1.
- Cada 2 goles recibidos: POR/DEF -2, MED/DEL -1.
- Penalti fallado -2, penalti parado +5, penalti provocado +2.
- Amarilla -1, doble amarilla -1, roja directa -3, gol en propia -2.
- Portero: cada 2 paradas +1.
- Nota Overload: 0 puntos si la nota es 0-2.5, +1 si es 2.5-5, +2 si es 5-7, +3 si es 7-9, +4 si es 9-10.
- Bonus ataque: cada 2 remates a puerta, regates logrados o llegadas al area suma +1.
- Bonus defensivo: cada 10 balones perdidos resta -1; cada 5 recuperaciones o despejes suma +1.

El panel Overload permite editar manualmente estas estadisticas por jugador y partido. En esa pantalla no aparecen jugadores de la Bolsa para asignar puntuacion.

## Importar estadisticas desde Discord

Opcionalmente puedes importar partidos desde un canal de Discord usando un bot. El mensaje del canal debe contener un bloque JSON:

```json
{
  "matchday": 6,
  "homeTeam": "RMA",
  "awayTeam": "BAR",
  "homeScore": 2,
  "awayScore": 1,
  "players": [
    {
      "name": "Nombre Jugador",
      "team": "RMA",
      "minutes": 90,
      "goals": 1,
      "assists": 0,
      "overloadScore": 8.2,
      "shotsOnTarget": 3,
      "ballsRecovered": 6
    }
  ]
}
```

Configura estas variables solo en servidor/worker:

```bash
SUPABASE_DB_URL="postgresql://..."
DISCORD_BOT_TOKEN="..."
DISCORD_CHANNEL_ID="..."
DISCORD_LEAGUE_ID="uuid-de-la-liga"
npm run sync:discord
```

El script busca el partido por jornada/equipos, resuelve jugadores por nombre y equipo, llama a `update_match_result` y recalcula puntos, precios y clasificacion.

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
