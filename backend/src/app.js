// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║            AROMA & GRANO — SISTEMA DE GESTIÓN GASTRONÓMICA              ║
// ║         Archivo: app.js — Configuración Central de Express              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// =========================================================================
// ¿QUÉ ES ESTE ARCHIVO Y POR QUÉ EXISTE SEPARADO DE server.js?
// =========================================================================
//
// PATRÓN ARQUITECTÓNICO: SEPARACIÓN DE RESPONSABILIDADES (Separation of Concerns)
// ────────────────────────────────────────────────────────────────────────────────
// Este archivo sigue el principio de diseño que separa la CONFIGURACIÓN de
// la aplicación Express (middlewares, rutas, políticas CORS) de su ARRANQUE
// (escuchar en un puerto de red). Esta separación ofrece beneficios clave:
//
//   1. TESTABILIDAD: Permite importar 'app' en pruebas unitarias/integración
//      (con supertest) sin necesidad de levantar un servidor HTTP real.
//      Ejemplo: const response = await supertest(app).get("/api/productos");
//
//   2. MODULARIDAD: Si en el futuro se necesita usar la app con HTTPS,
//      WebSockets (Socket.io), o un servidor de clústeres, se puede
//      reutilizar esta misma instancia sin duplicar configuración.
//
//   3. CLARIDAD: Separa "qué hace la app" (este archivo) de "cómo se
//      despliega" (server.js), facilitando la lectura y mantenimiento.
//
// FLUJO GENERAL DE UNA PETICIÓN HTTP EN AROMA & GRANO:
// ─────────────────────────────────────────────────────
//   Cliente (Vue 3) → Internet → Servidor (server.js escucha en puerto)
//     → app.js (configuración) → Middleware CORS → Middleware JSON Parser
//     → Middleware verifyToken → Router de la ruta → Controlador → Supabase
//     → Respuesta JSON → Cliente (Vue 3)
//
// =========================================================================

// =========================================================================
// SECCIÓN 1: IMPORTACIÓN DE DEPENDENCIAS EXTERNAS (NPM)
// =========================================================================

// ─────────────────────────────────────────────────────────────────────────
// IMPORTACIÓN DE EXPRESS
// ─────────────────────────────────────────────────────────────────────────
// ¿QUÉ ES EXPRESS?
// Express es el framework web más popular para Node.js. Proporciona una
// capa delgada de funcionalidades sobre el módulo nativo 'http' de Node.js,
// añadiendo:
//   - Sistema de enrutamiento (routing) con métodos HTTP (GET, POST, PUT, DELETE).
//   - Arquitectura de middleware para procesar peticiones en cadena.
//   - Métodos de conveniencia para respuestas (res.json(), res.status(), etc.).
//   - Soporte para motores de plantillas (no usado aquí, ya que el frontend es Vue 3).
//
// Al importar 'express', obtenemos una función factoría que, al invocarla,
// crea una instancia de aplicación Express con todos estos métodos disponibles.
//
// NOTA: Express sigue el patrón "Factory Function" — no se usa 'new',
// sino que se invoca como función: const app = express();
//
import express from "express";

// ─────────────────────────────────────────────────────────────────────────
// IMPORTACIÓN DEL MIDDLEWARE CORS
// ─────────────────────────────────────────────────────────────────────────
// ¿QUÉ ES CORS (Cross-Origin Resource Sharing)?
// ──────────────────────────────────────────────
// CORS es un mecanismo de seguridad implementado por los navegadores web
// que controla qué dominios pueden hacer peticiones HTTP a tu servidor.
// Por defecto, los navegadores BLOQUEAN las peticiones entre diferentes
// "orígenes" (Same-Origin Policy) por motivos de seguridad.
//
// ¿QUÉ ES UN "ORIGEN"?
// Un origen se define por la combinación de: protocolo + dominio + puerto.
//   Ejemplo: http://localhost:5173 (frontend Vue/Vite)
//            http://localhost:3000 (backend Express)
//   → Son orígenes DIFERENTES → El navegador bloquea la petición.
//
// ¿CÓMO FUNCIONA CORS?
//   1. El navegador envía una "petición preflight" (OPTIONS) al servidor.
//   2. El servidor responde con encabezados CORS que indican qué orígenes,
//      métodos HTTP y encabezados están permitidos.
//   3. Si el origen del frontend está permitido, el navegador permite la
//      petición real (GET, POST, PUT, DELETE).
//
// ENCABEZADOS CORS QUE ESTE MIDDLEWARE CONFIGURA:
//   - Access-Control-Allow-Origin: * (permite todos los orígenes)
//   - Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
//   - Access-Control-Allow-Headers: Content-Type, Authorization
//
// ¿POR QUÉ ES INDISPENSABLE EN AROMA & GRANO?
// El frontend Vue 3 (puerto 5173) necesita comunicarse con el backend
// Express (puerto 3000). Sin CORS habilitado, TODAS las peticiones del
// frontend serían bloqueadas por el navegador, haciendo imposible el
// login, la carga de menú, la gestión de pedidos, etc.
//
// NOTA DE SEGURIDAD EN PRODUCCIÓN:
// En un entorno de producción, se recomienda restringir los orígenes
// permitidos en lugar de usar '*':
//   app.use(cors({ origin: "https://aromagrano.com" }));
//
import cors from "cors";

// =========================================================================
// SECCIÓN 2: IMPORTACIÓN DE MÓDULOS DE RUTAS INTERNOS
// =========================================================================
//
// ¿QUÉ ES UN MÓDULO DE RUTAS (ROUTER)?
// ──────────────────────────────────────
// En Express, un Router es un mini-aplicación que solo contiene middleware
// y rutas. Permite organizar las rutas en archivos separados por entidad
// o funcionalidad, siguiendo el principio de responsabilidad única (SRP).
//
// PATRÓN ARQUITECTÓNICO: MODULAR ROUTING
// ───────────────────────────────────────
// En lugar de definir TODAS las rutas en un solo archivo (lo cual sería
// inmanejable), se dividen en módulos por dominio del negocio:
//   - users.routes.js      → Gestión de usuarios y roles.
//   - inventario.routes.js → Control de inventarios y Kardex.
//   - pedidos.routes.js    → Creación y seguimiento de comandas.
//   - productos.routes.js  → CRUD del menú de productos.
//   - mesas.routes.js      → Estado y asignación de mesas.
//   - madi.routes.js       → Sistema de gamificación MADI.
//   - happy_hour.routes.js → Módulo de promociones Happy Hour.
//
// Cada módulo define sus propias rutas relativas (ej: "/", "/:id", "/crear")
// que luego se montan bajo un prefijo raíz en este archivo.
//
// ─────────────────────────────────────────────────────────────────────────

// Rutas del módulo de USUARIOS: Registro, consulta, actualización y
// eliminación de cuentas de usuario (meseros, administradores, cajeros).
import usersRoutes from "./routes/users.routes.js";

// Rutas del módulo de INVENTARIO: Gestión del stock de insumos y productos,
// movimientos de entrada/salida con el sistema Kardex (método de valuación
// de inventarios que registra cada movimiento con su cantidad y costo).
import inventarioRoutes from "./routes/inventario.routes.js";

// Rutas del módulo de PEDIDOS (Comandas): Creación de pedidos asociados a
// mesas, gestión de las líneas de detalle (productos pedidos, cantidades,
// precios), y seguimiento del estado del pedido (pendiente, preparando, servido).
import pedidosRoutes from "./routes/pedidos.routes.js"; 

// Rutas del módulo de PRODUCTOS (Menú): CRUD completo del catálogo de
// productos que ofrece el restaurante (platillos, bebidas, postres),
// incluyendo nombre, descripción, precio, categoría y disponibilidad.
import productosRoutes from "./routes/productos.routes.js";

// Rutas del módulo de MESAS: Gestión del plano del restaurante, estado
// de cada mesa (disponible, ocupada, reservada), y asignación de meseros.
import mesasRoutes from "./routes/mesas.routes.js";

// Rutas del módulo MADI (Motivación, Análisis, Desempeño, Incentivos):
// Sistema de gamificación exclusivo de Aroma & Grano que motiva al personal
// mediante puntos, insignias, rankings y recompensas basadas en su desempeño.
import madiRoutes from "./routes/madi.routes.js";

// Rutas del módulo HAPPY HOUR: Sistema de promociones y descuentos
// programados por horario. Permite configurar franjas horarias con precios
// especiales, descuentos porcentuales o 2x1 en productos seleccionados.
import happyHourRoutes from "./routes/happy_hour.routes.js";

// =========================================================================
// SECCIÓN 3: IMPORTACIÓN DE MIDDLEWARES PERSONALIZADOS
// =========================================================================

// Importación del middleware de autenticación JWT.
// 'verifyToken' es una función que intercepta cada petición, valida el
// token JWT del encabezado Authorization, y si es válido, inyecta la
// identidad del usuario en req.user antes de pasar al controlador.
//
// Se importa con desestructuración { verifyToken } porque el archivo
// usa 'export const' (exportación nombrada), no 'export default'.
//
// DIFERENCIA ENTRE EXPORT NOMBRADA Y POR DEFECTO:
//   - export default → Se importa SIN llaves: import algo from "..."
//   - export const   → Se importa CON llaves: import { algo } from "..."
//
import { verifyToken } from "./middlewares/auth.middleware.js";

// =========================================================================
// SECCIÓN 4: CREACIÓN DE LA INSTANCIA DE LA APLICACIÓN EXPRESS
// =========================================================================
//
// ¿QUÉ HACE express()?
// ─────────────────────
// La invocación de express() como función crea y retorna un nuevo objeto
// de aplicación Express. Este objeto es el núcleo del servidor y contiene:
//   - .use()    → Registra middlewares y sub-routers.
//   - .get()    → Define rutas para peticiones HTTP GET.
//   - .post()   → Define rutas para peticiones HTTP POST.
//   - .put()    → Define rutas para peticiones HTTP PUT.
//   - .delete() → Define rutas para peticiones HTTP DELETE.
//   - .listen() → Inicia el servidor HTTP (usado en server.js).
//
// 'const app' almacena esta instancia que será configurada a lo largo
// de este archivo y luego exportada para su uso en server.js.
//
const app = express();

// =========================================================================
// SECCIÓN 5: CONFIGURACIÓN DE MIDDLEWARES GLOBALES
// =========================================================================
//
// Los middlewares globales se registran con app.use() SIN un prefijo de ruta.
// Esto significa que se ejecutan para TODAS las peticiones entrantes,
// independientemente de la URL o el método HTTP.
//
// ORDEN DE REGISTRO = ORDEN DE EJECUCIÓN:
// ────────────────────────────────────────
// Express ejecuta los middlewares en el MISMO ORDEN en que se registran.
// Esto es crucial porque:
//   1. CORS debe procesarse PRIMERO para que las peticiones preflight
//      (OPTIONS) reciban los encabezados correctos antes de cualquier otro procesamiento.
//   2. express.json() debe ejecutarse ANTES de los controladores para que
//      req.body contenga el JSON parseado cuando el controlador lo necesite.
//   3. verifyToken se aplica en las rutas específicas (no globalmente aquí)
//      para permitir que ciertas rutas sean públicas (como Happy Hour).
//
// ─────────────────────────────────────────────────────────────────────────

// MIDDLEWARE 1: CORS (Cross-Origin Resource Sharing)
// ──────────────────────────────────────────────────
// Activa las políticas CORS globalmente con configuración por defecto.
// La configuración por defecto de cors() permite:
//   - Todos los orígenes (Access-Control-Allow-Origin: *)
//   - Métodos estándar (GET, HEAD, PUT, PATCH, POST, DELETE)
//   - Encabezados comunes (Content-Type, Authorization)
//
// Sin este middleware, el frontend Vue 3 en localhost:5173 NO podría
// comunicarse con este backend en localhost:3000 y recibiría un error:
//   "Access to XMLHttpRequest has been blocked by CORS policy"
//
app.use(cors());

// MIDDLEWARE 2: PARSER DE JSON (Body Parser)
// ──────────────────────────────────────────
// ¿QUÉ HACE express.json()?
// Este middleware nativo de Express intercepta las peticiones que tengan
// el encabezado 'Content-Type: application/json' y transforma el cuerpo
// (body) de la petición de una cadena de texto JSON cruda a un objeto
// JavaScript accesible mediante 'req.body'.
//
// EJEMPLO DE TRANSFORMACIÓN:
//   Cuerpo HTTP crudo:   '{"nombre": "Café Americano", "precio": 45.00}'
//   req.body resultante: { nombre: "Café Americano", precio: 45.00 }
//
// Sin este middleware, req.body sería 'undefined' en los controladores,
// y sería imposible procesar datos enviados por el frontend (como crear
// un nuevo producto, registrar un pedido, o actualizar una mesa).
//
// NOTA HISTÓRICA: En versiones anteriores de Express (< 4.16), era
// necesario instalar el paquete separado 'body-parser'. Desde Express
// 4.16+, express.json() está incluido de forma nativa.
//
app.use(express.json());

// =========================================================================
// SECCIÓN 6: ENRUTAMIENTO Y MONTAJE DE RUTAS (API PREFIXES)
// =========================================================================
//
// ¿QUÉ ES app.use(prefijo, middleware, router)?
// ──────────────────────────────────────────────
// El método app.use() con un prefijo de ruta "monta" un router (conjunto
// de rutas) bajo ese prefijo. Todas las rutas definidas dentro del router
// se convierten en sub-rutas del prefijo.
//
// EJEMPLO:
//   app.use("/api/productos", productosRoutes);
//   // Si productosRoutes define: router.get("/")
//   // → La ruta final es: GET /api/productos/
//   // Si productosRoutes define: router.get("/:id")
//   // → La ruta final es: GET /api/productos/:id
//
// CONVENCIÓN RESTful:
// ───────────────────
// Las rutas siguen la convención REST (Representational State Transfer):
//   - GET    /api/recurso     → Listar todos los recursos.
//   - GET    /api/recurso/:id → Obtener un recurso específico.
//   - POST   /api/recurso     → Crear un nuevo recurso.
//   - PUT    /api/recurso/:id → Actualizar un recurso completo.
//   - PATCH  /api/recurso/:id → Actualizar parcialmente un recurso.
//   - DELETE /api/recurso/:id → Eliminar un recurso.
//
// PREFIJO "/api/" COMO NAMESPACE:
// ───────────────────────────────
// Usar "/api/" como prefijo es una convención que permite:
//   1. Diferenciar rutas de la API de rutas de archivos estáticos o vistas.
//   2. Facilitar la configuración de proxies reversos (Nginx, Caddy).
//   3. Versionar la API en el futuro: "/api/v2/productos".
//
// PROTECCIÓN CON verifyToken:
// ───────────────────────────
// Las rutas que incluyen 'verifyToken' como segundo argumento están
// PROTEGIDAS: solo usuarios autenticados con un JWT válido pueden acceder.
// Las rutas SIN verifyToken son PÚBLICAS (accesibles sin autenticación).
//
// ─────────────────────────────────────────────────────────────────────────

// MÓDULO DE USUARIOS — Prefijo: /api/users
// Endpoints protegidos para la gestión de cuentas de usuario.
// verifyToken se ejecuta ANTES de usersRoutes, asegurando que solo
// usuarios autenticados puedan consultar o modificar datos de usuarios.
app.use("/api/users", verifyToken, usersRoutes);

// MÓDULO DE INVENTARIO — Prefijo: /api/inventario
// Endpoints protegidos para el control de stock e insumos.
// Incluye operaciones del sistema Kardex para registrar entradas y
// salidas de inventario con trazabilidad completa.
app.use("/api/inventario", verifyToken, inventarioRoutes);

// MÓDULO DE PEDIDOS (COMANDAS) — Prefijo: /api/pedidos
// Endpoints protegidos para la gestión completa de pedidos del restaurante.
// Permite crear comandas, añadir líneas de detalle, cambiar estados
// (pendiente → preparando → servido → pagado) y consultar historial.
app.use("/api/pedidos", verifyToken, pedidosRoutes); 

// MÓDULO DE PRODUCTOS (MENÚ) — Prefijo: /api/productos
// Endpoints protegidos para el CRUD del catálogo de productos.
// Gestiona platillos, bebidas, postres, con sus precios y disponibilidad.
app.use("/api/productos", verifyToken, productosRoutes);

// MÓDULO DE MESAS — Prefijo: /api/mesas
// Endpoints protegidos para la gestión del plano del restaurante.
// Permite consultar, actualizar y asignar mesas a meseros.
app.use("/api/mesas", verifyToken, mesasRoutes);

// MÓDULO MADI (GAMIFICACIÓN) — Prefijo: /api/madi
// Endpoints protegidos para el sistema de Motivación, Análisis,
// Desempeño e Incentivos. Gestiona puntos, rankings e insignias
// del personal como mecanismo de motivación laboral.
app.use("/api/madi", verifyToken, madiRoutes);

// MÓDULO HAPPY HOUR (PROMOCIONES) — Prefijo: /api/happy-hour
// ⚠️ NOTA: Este módulo NO incluye verifyToken, lo que significa que
// sus endpoints son PÚBLICOS. Esto tiene sentido porque la información
// de promociones y descuentos Happy Hour debe ser accesible sin
// autenticación (ej: una pantalla pública del restaurante que muestra
// las ofertas vigentes, o clientes consultando el menú con descuentos).
app.use("/api/happy-hour", happyHourRoutes);

// =========================================================================
// SECCIÓN 7: EXPORTACIÓN DE LA INSTANCIA CONFIGURADA
// =========================================================================
//
// Se exporta la instancia de Express completamente configurada con todos
// sus middlewares y rutas. Esta exportación es consumida por server.js,
// que se encarga exclusivamente de llamar app.listen(PORT) para levantar
// el servidor HTTP.
//
// PATRÓN: SEPARATION OF CONCERNS (Separación de Responsabilidades)
// ─────────────────────────────────────────────────────────────────
//   - app.js    → CONFIGURA la aplicación (qué hacer con las peticiones).
//   - server.js → ARRANCA el servidor (en qué puerto escuchar).
//
// Esta separación permite, por ejemplo, que en las pruebas automatizadas
// se importe solo 'app' sin levantar un servidor real:
//   import app from "./app.js";
//   import supertest from "supertest";
//   const response = await supertest(app).get("/api/productos").expect(200);
//
export default app;