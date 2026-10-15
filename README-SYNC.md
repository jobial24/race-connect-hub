# Sincronización, radar e IA — guía rápida

## Arrancar
```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
npm run dev
```
`npm run dev` levanta la app **y** un mini‑backend local dentro de Vite (`server/`):

| Endpoint | Qué hace |
|---|---|
| `GET /api/races/sync?force=1` | Scraping de runnea desde Node (sin CORS), caché 12 h en `.cache/runnea.json` |
| `POST /api/geocode` | Coordenadas de municipios (diccionario + OpenStreetMap/Nominatim, cacheado) |
| `POST /api/ai/extract` | Ficha de carrera desde URL o texto con Gemini |
| `GET /api/health` | Estado del backend y si hay key de Gemini |

## Runnea solo como fuente de datos
La app lee el calendario de runnea y, por cada carrera, abre su ficha para sacar:
- la **web oficial** (botón «Ver web de la carrera») y, si aparece, el enlace de **inscripción**;
- el **municipio exacto** y la hora de salida (datos schema.org de la ficha).

El botón de cada tarjeta lleva a la web oficial / inscripción, **nunca a runnea**. Si una carrera no tiene web publicada, el botón busca «nombre + web oficial» en Google.
Las fichas se guardan 7 días en `.cache/runnea-details.json`; la app procesa hasta 40 nuevas por sincronización y `npm run sync` las procesa todas.

## Cadena de resiliencia (runnea)
1. runnea en directo (cabeceras de navegador, 3 reintentos con espera)
2. Caché en disco si tiene < 12 h
3. Última copia buena aunque esté caducada (si runnea responde 403/Cloudflare)
4. `public/races.json` (snapshot del último `npm run sync`)
5. Si todo falla, se conserva el catálogo actual del navegador — nunca se borra.

Las carreras manuales y las creadas con IA no se tocan al sincronizar.

## Sync desatendido (Windows)
```bash
npm run sync
```
Para que se ejecute solo cada mañana, en PowerShell (una vez):
```powershell
$dir = "C:\Users\joelb\Documents\race-connect-hubApp\race-connect-hub"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c cd /d `"$dir`" && npm run sync >> .cache\sync.log 2>&1"
$trigger = New-ScheduledTaskTrigger -Daily -At 7:30am
Register-ScheduledTask -TaskName "RaceConnectSync" -Action $action -Trigger $trigger
```
Además, la propia app re‑sincroniza sola al abrir el calendario si han pasado más de 12 h.

## IA (Gemini)
Pon `GEMINI_API_KEY=...` en `.env` y reinicia `npm run dev`. En Admin → “Ingesta inteligente” pega una URL o un texto; la IA rellena el formulario y tú revisas antes de publicar. Si la web oficial bloquea la lectura, usa “Pegar texto”.

## Webs oficiales actualizadas con Gemini + Google Search
Runnea a veces tiene webs antiguas (ej. Mitja de Terrassa: `mitjaterrassa.cat` → `mitjaterrassa.org`).
- **Admin → icono 🌐 de cada carrera**: Gemini busca en Google la web oficial actual, la app la abre para verificar que existe y habla de esa carrera, y sustituye el enlace.
- **Admin → «Revisar webs con IA (10)»**: revisa en lote las próximas carreras no revisadas.
- **Admin → Ingesta → «Buscar en la web»**: escribe solo el nombre de la carrera y la IA rellena la ficha con datos de la web oficial.
- `npm run sync` revisa además `AI_WEB_BUDGET` carreras por ejecución (15 por defecto).

Lo encontrado se guarda 30 días en `.cache/ai-webs.json` y se aplica en cada sincronización. Nunca se usan agregadores (runnea, finishers…) ni redes sociales como web oficial.

## xipgroc.cat (Championchip) — inscripción directa
La app lee el calendario mensual de xipgroc.cat (6 meses por defecto). Cada carrera trae sus **botones de inscripción por distancia** (10K, 5K…) que abren directamente el formulario de xipgroc, y el precio se lee de ese formulario. Si una carrera está en xipgroc y en runnea, se queda la de xipgroc.
Sin API key el municipio se deduce del nombre («Cursa de Parets» → Parets); con Gemini se pregunta en un solo lote.

## Mis inscripciones
- Al pulsar **Inscribirme** (o un botón de distancia), la app recuerda la carrera. Al volver a la pestaña pregunta **«¿Te has inscrito?»** → «Sí, guardar» la añade con carrera, fecha, distancia y precio.
- **Importar comprobante**: pega el email de confirmación, una captura (Ctrl+V) o el PDF; Gemini saca distancia, dorsal, código, precio, hora y recogida de dorsal, y lo enlaza con la carrera del calendario. No guarda DNI ni datos personales.
- **Añadir al calendario** descarga un .ics con aviso el día antes.
- Las carreras pasadas pasan a «Completadas», donde puedes apuntar tu tiempo.

## Carreras de obstáculos (OCR)
- **Spartan** (API oficial de es.spartan.com): Spartan Race (Sprint 5K / Super 10K / Beast 21K / Ultra 50K), Spartan Trail, Tough Mudder y DEKA en España y Andorra (`SPARTAN_COUNTRIES`).
- **Otras OCR** (Farinato, Bulldog, Survivor, Hyrox, Xtrem…): con `GEMINI_API_KEY`, Gemini las busca en Google una vez por semana; solo se guardan las que tienen una web que existe de verdad.
- Las carreras de fuera de España que runnea mete como «destacadas» (Frankfurt, Nueva York…) se descartan.

## Móvil y app
La interfaz es *mobile-first*: en el móvil hay cabecera compacta y barra de pestañas inferior (Calendario · Mis carreras · Admin), respetando el notch.

**1. Probar en el móvil (misma wifi):** `npm run dev:mobile` y abre en el móvil la URL «Network» que muestra Vite.

**2. Instalar como app (PWA):** `npm run build && npm start` → abre `http://<tu-ip>:3000` en el móvil → «Añadir a pantalla de inicio». Tiene icono, pantalla completa y funciona sin conexión con los últimos datos.

**3. Publicar el servidor:** `npm start` sirve la app + la API en un solo proceso (puerto `PORT`, 3000 por defecto). Se puede subir tal cual a Render / Railway / Fly.io (gratis) con las variables del `.env`.

**4. App nativa Android/iOS (Capacitor):** ya está `capacitor.config.json`.
```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
set VITE_API_BASE=https://tu-servidor.onrender.com   # PowerShell: $env:VITE_API_BASE="https://..."
npm run build
npx cap add android        # (y/o ios en un Mac)
npx cap sync
npx cap open android       # abre Android Studio → Run / generar APK
```
En la app nativa la API es la del servidor publicado (paso 3), por eso hace falta `VITE_API_BASE`.

## Base de datos (Supabase, gratis) — cuenta, sincronización y «¿Quién va?»
1. Crea un proyecto en https://supabase.com (plan Free).
2. **SQL Editor → New query**: pega `supabase/schema.sql` y pulsa **Run**.
3. La URL y la clave publicable ya están en `supabase/config.js` (se pueden cambiar con `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` en el `.env`). La *secret key* no se usa nunca en la app.
4. (Opcional) **Authentication → Providers → Email**: desactiva «Confirm email» si no quieres confirmar por correo; y en **Authentication → URL Configuration** añade `http://localhost:5173` (y tu dominio cuando publiques).
5. Reinicia `npm run dev`. Arriba aparece «Entrar»: crea tu cuenta.

Con cuenta:
- Tus inscripciones se guardan en la nube → las mismas en el móvil y en el PC.
- En cada carrera ves **quién más va** (solo nombre y distancia; puedes ocultarte desmarcando la casilla al guardar la inscripción).
- **Calendario suscribible**: Mis inscripciones → Sincronizar calendario → «Suscribirme en Google Calendar» o «iPhone / Mac / Outlook». Las carreras nuevas aparecen solas. (Google solo puede leerlo cuando el servidor está publicado en internet.)

Sin configurar nada, la app sigue funcionando en modo local.

## Gemini: «créditos agotados»
Si al probar la conexión sale *«tu proyecto no tiene saldo (créditos de prepago agotados)»*, la key es correcta pero el proyecto de Google AI Studio tiene facturación de prepago sin saldo. Opciones: recargar en https://aistudio.google.com/projects o crear la key en un proyecto **sin facturación** (capa gratuita). El modelo por defecto es `gemini-flash-latest` (los modelos con versión, como `gemini-2.5-flash`, ya no se dan a cuentas nuevas).
La key se guarda en Admin → Ajustes de IA (queda en el servidor, `.cache/settings.json`) o en el `.env`.
