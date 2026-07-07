// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║            AROMA & GRANO — SISTEMA DE GESTIÓN GASTRONÓMICA              ║
// ║       Archivo: server.js — Punto de Entrada y Arranque del Servidor     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// =========================================================================
// ¿QUÉ ES ESTE ARCHIVO Y POR QUÉ ES EL MÁS IMPORTANTE DEL BACKEND?
// =========================================================================
//
// server.js es el PUNTO DE ENTRADA (entry point) de toda la aplicación
// backend de Aroma & Grano. Es el primer archivo que Node.js ejecuta
// cuando se inicia el servidor con el comando:
//   npm run dev   (desarrollo, con nodemon para hot-reload)
//   npm start     (producción)
//   node src/server.js (ejecución directa)
//
// Este archivo tiene DOS responsabilidades fundamentales:
//   1. BOOTSTRAP (Arranque): Cargar las variables de entorno ANTES que
//      cualquier otro módulo las necesite.
//   2. LISTEN (Escucha): Iniciar el servidor HTTP en un puerto de red
//      para recibir peticiones del frontend y otros clientes.
//
// PATRÓN ARQUITECTÓNICO: COMPOSITION ROOT (Raíz de Composición)
// ──────────────────────────────────────────────────────────────
// En arquitectura de software, el "Composition Root" es el lugar donde
// se ensamblan todas las dependencias de la aplicación. Aquí es donde:
//   - Se carga la configuración (env.js).
//   - Se importa la aplicación configurada (app.js).
//   - Se inicia el servidor (app.listen).
//
// Es el equivalente a la función main() en lenguajes como C, Java o Go.
//
// DIAGRAMA DE ARRANQUE DEL SISTEMA:
// ──────────────────────────────────
//   [1] server.js se ejecuta
//       │
//       ├─[2] import "./config/env.js"
//       │       └─ dotenv.config() → Carga .env → process.env se llena
//       │
//       ├─[3] import app from "./app.js"
//       │       ├─ import express → Crea instancia de Express
//       │       ├─ import cors → Configura CORS
//       │       ├─ import rutas → Carga todos los routers
//       │       │   └─ Cada router importa su controlador
//       │       │       └─ Cada controlador importa supabaseAdmin.js
//       │       │           └─ createClient() usa process.env (ya cargado ✓)
//       │       └─ export default app (instancia configurada)
//       │
//       └─[4] app.listen(PORT, callback)
//               └─ Servidor HTTP escuchando en el puerto asignado ✓
//
// =========================================================================

// =========================================================================
// PASO 1: CARGA DE VARIABLES DE ENTORNO (IMPORTACIÓN BOOTSTRAP)
// =========================================================================
//
// ¿POR QUÉ ESTA IMPORTACIÓN DEBE SER LA PRIMERA LÍNEA?
// ──────────────────────────────────────────────────────
// Esta es la importación más CRÍTICA de todo el proyecto. Al importar
// "./config/env.js", se ejecuta dotenv.config() que lee el archivo .env
// y carga todas las variables de entorno en process.env.
//
// ORDEN DE IMPORTACIÓN EN ESM (ECMAScript Modules):
// ──────────────────────────────────────────────────
// En Node.js con ESM, los imports se resuelven de forma estática y se
// ejecutan en el orden en que aparecen en el archivo. Esto es diferente
// de CommonJS (require), donde las importaciones se ejecutan de forma
// dinámica y lazy (bajo demanda).
//
// Si esta importación estuviera DESPUÉS de "import app from './app.js'",
// ocurriría el siguiente problema:
//   1. app.js se ejecutaría primero.
//   2. app.js importaría supabaseAdmin.js.
//   3. supabaseAdmin.js intentaría leer process.env.SUPABASE_URL → undefined
//   4. createClient(undefined, undefined) → Error de conexión silencioso.
//   5. Todas las consultas a la base de datos fallarían.
//
// PATRÓN: "Fail-Fast" (Fallar Rápido)
// ────────────────────────────────────
// Al cargar las variables de entorno primero, cualquier error de
// configuración (archivo .env faltante, variables mal escritas) se
// detecta inmediatamente al arrancar, en lugar de fallar silenciosamente
// minutos después cuando un usuario intenta usar la aplicación.
//
// NOTA SOBRE 'import "./config/env.js"' (Import de Efecto Secundario):
// ─────────────────────────────────────────────────────────────────────
// Esta forma de importación (sin asignar a una variable) se conoce como
// "side-effect import" o "importación de efecto secundario". No importa
// ninguna exportación del módulo; solo ejecuta el código del archivo.
// Se usa cuando el propósito del módulo es producir un efecto (en este
// caso, poblar process.env) en lugar de exportar valores.
//
import "./config/env.js";

// =========================================================================
// PASO 2: IMPORTACIÓN DE LA APLICACIÓN EXPRESS CONFIGURADA
// =========================================================================
//
// Se importa la instancia de Express previamente configurada en app.js.
// En este punto, app.js ya ha:
//   ✓ Creado la instancia de Express con express().
//   ✓ Configurado el middleware CORS para peticiones cross-origin.
//   ✓ Configurado el middleware de parseo JSON (express.json()).
//   ✓ Montado TODOS los módulos de rutas bajo sus prefijos /api/:
//       /api/users, /api/inventario, /api/pedidos, /api/productos,
//       /api/mesas, /api/madi, /api/happy-hour.
//   ✓ Aplicado el middleware verifyToken en las rutas protegidas.
//
// La importación es posible gracias al 'export default app' al final
// de app.js. Se recibe la MISMA instancia (por referencia, no por copia)
// que fue configurada allí.
//
import app from "./app.js";

// =========================================================================
// PASO 3: ASIGNACIÓN DEL PUERTO DE RED
// =========================================================================
//
// ¿QUÉ ES UN PUERTO DE RED?
// ──────────────────────────
// Un puerto es un número (entre 0 y 65535) que identifica un servicio
// específico en un servidor. Permite que múltiples aplicaciones compartan
// la misma dirección IP, cada una escuchando en un puerto diferente.
//
// ANALOGÍA: Si la dirección IP es la dirección de un edificio de oficinas,
// el puerto es el número de oficina. El cartero (la red) lleva el paquete
// (la petición HTTP) al edificio correcto (IP) y luego a la oficina
// correcta (puerto).
//
// PUERTOS COMUNES:
//   - 80:    HTTP (servidores web)
//   - 443:   HTTPS (servidores web seguros)
//   - 3000:  Express/Node.js (convención de desarrollo)
//   - 5173:  Vite (frontend Vue 3 en desarrollo)
//   - 5432:  PostgreSQL (base de datos)
//   - 27017: MongoDB
//
// OPERADOR LÓGICO OR (||) COMO VALOR POR DEFECTO:
// ─────────────────────────────────────────────────
// El operador || evalúa de izquierda a derecha y retorna el primer
// valor "truthy" (verdadero en contexto booleano):
//
//   process.env.PORT || 3000
//
//   - Si process.env.PORT tiene un valor (ej: "8080" en producción),
//     se usa ese valor. → "8080" es truthy → se usa "8080".
//   - Si process.env.PORT es undefined (no está en .env ni en el
//     sistema operativo), se usa el valor por defecto 3000.
//     → undefined es falsy → se evalúa el siguiente → 3000.
//
// ¿POR QUÉ NO SE HARDCODEA EL PUERTO?
// ─────────────────────────────────────
// En plataformas de despliegue en la nube (Render, Heroku, Railway, AWS,
// Google Cloud Run, Azure), el puerto es ASIGNADO DINÁMICAMENTE por la
// plataforma a través de la variable de entorno PORT. Si el servidor
// no escucha en ese puerto exacto, la plataforma marca el servicio como
// "unhealthy" y lo reinicia o lo detiene.
//
/**
 * @constant {number|string} PORT
 * @description
 * Puerto TCP en el que el servidor HTTP escuchará las peticiones entrantes.
 * Se obtiene de la variable de entorno PORT (para compatibilidad con
 * plataformas de despliegue en la nube) o utiliza el puerto 3000 como
 * valor por defecto para desarrollo local.
 */
const PORT =
  process.env.PORT || 3000;

// =========================================================================
// PASO 4: ARRANQUE OFICIAL DEL SERVIDOR HTTP
// =========================================================================
//
// ¿QUÉ HACE app.listen()?
// ────────────────────────
// El método app.listen() es un wrapper (envoltorio) del método nativo
// http.Server.listen() de Node.js. Internamente hace lo siguiente:
//
//   1. Crea un servidor HTTP nativo: http.createServer(app)
//   2. Vincula (bind) el servidor al puerto especificado.
//   3. Pone el servidor en modo "escucha" (listening), donde espera
//      conexiones TCP entrantes.
//   4. Ejecuta el callback proporcionado cuando el servidor está listo.
//
// MODELO DE EVENTOS DE NODE.JS:
// ─────────────────────────────
// Node.js utiliza un modelo de I/O no bloqueante basado en eventos
// (event-driven, non-blocking I/O). Esto significa que app.listen()
// NO bloquea el proceso — el servidor queda escuchando en segundo plano
// mientras el event loop de Node.js procesa las peticiones entrantes
// de forma asíncrona, una por una, sin crear hilos separados.
//
// CALLBACK DE CONFIRMACIÓN:
// ─────────────────────────
// La función de flecha (arrow function) que se pasa como segundo
// argumento se ejecuta UNA SOLA VEZ cuando el servidor se ha
// inicializado exitosamente. Sirve como confirmación visual en la
// consola del desarrollador de que todo está funcionando correctamente.
//
// POSIBLES ERRORES EN ESTE PASO:
//   - EADDRINUSE: El puerto ya está ocupado por otro proceso.
//     Solución: Cambiar el puerto o terminar el proceso que lo usa.
//   - EACCES: Permisos insuficientes para usar puertos < 1024.
//     Solución: Usar un puerto > 1024 o ejecutar con permisos elevados.
//

/**
 * @function listen
 * @description
 * Inicia el servidor HTTP del backend de Aroma & Grano y lo pone en
 * modo escucha (listening) en el puerto configurado. Una vez activo,
 * el servidor está listo para recibir y procesar peticiones REST desde
 * el frontend Vue 3, aplicaciones móviles, o cualquier cliente HTTP.
 *
 * @param {number|string} PORT - Puerto TCP donde escuchará el servidor.
 * @param {Function} callback - Función ejecutada al iniciar exitosamente.
 *
 * @example
 * // Arranque en desarrollo:
 * //   $ npm run dev
 * //   > Servidor ejecutándose en puerto 3000
 *
 * // Arranque en producción (Render/Heroku):
 * //   PORT=8080 node src/server.js
 * //   > Servidor ejecutándose en puerto 8080
 */
app.listen(PORT, () => {

  // ─────────────────────────────────────────────────────────────────────
  // MENSAJE DE CONFIRMACIÓN EN CONSOLA
  // ─────────────────────────────────────────────────────────────────────
  // console.log() envía un mensaje informativo a la salida estándar
  // (stdout) del terminal. En desarrollo, aparece en la consola del
  // desarrollador. En producción, se captura por los sistemas de logging
  // de la plataforma de despliegue (Render logs, Docker logs, PM2 logs).
  //
  // Se usa un template literal (backticks ` `) con interpolación ${...}
  // para incrustar el valor de la variable PORT directamente en la cadena.
  // Los template literals son una característica de ES6 (2015) que
  // reemplaza la concatenación con + para crear cadenas más legibles.
  //
  // Este mensaje es la CONFIRMACIÓN FINAL de que todo el proceso de
  // arranque del backend de Aroma & Grano fue exitoso:
  //   ✓ Variables de entorno cargadas.
  //   ✓ Conexión a Supabase configurada.
  //   ✓ Middlewares globales activos (CORS, JSON).
  //   ✓ Todas las rutas montadas y protegidas.
  //   ✓ Servidor HTTP escuchando y listo para peticiones.
  //
  console.log(
    `Servidor ejecutándose en puerto ${PORT}`
  );

});