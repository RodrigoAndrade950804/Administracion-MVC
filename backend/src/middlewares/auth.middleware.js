// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║            AROMA & GRANO — SISTEMA DE GESTIÓN GASTRONÓMICA              ║
// ║    Archivo: middlewares/auth.middleware.js — Autenticación JWT           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// =========================================================================
// ¿QUÉ ES UN MIDDLEWARE EN EXPRESS.JS?
// =========================================================================
//
// Un middleware es una función que se ejecuta ENTRE la recepción de una
// petición HTTP (request) y el envío de la respuesta (response). Piensa
// en él como un "guardia de seguridad" o un "filtro" que inspecciona,
// modifica o rechaza las peticiones antes de que lleguen al controlador
// (controller) que contiene la lógica de negocio.
//
// FIRMA DE UN MIDDLEWARE EN EXPRESS:
//   (req, res, next) => { ... }
//
//   - req  → Objeto Request: contiene toda la información de la petición
//            (headers, body, params, query, cookies, etc.).
//   - res  → Objeto Response: métodos para enviar la respuesta al cliente
//            (res.json(), res.status(), res.send(), etc.).
//   - next → Función callback: al invocarla, le dice a Express que pase
//            la petición al SIGUIENTE middleware o controlador en la cadena.
//            Si NO se llama a next() ni se envía una respuesta, la petición
//            queda "colgada" (hanging) y eventualmente expira por timeout.
//
// PATRÓN ARQUITECTÓNICO: CADENA DE RESPONSABILIDAD (Chain of Responsibility)
// ──────────────────────────────────────────────────────────────────────────
// Express implementa el patrón de diseño "Cadena de Responsabilidad" para
// procesar peticiones HTTP. Cada middleware es un eslabón en la cadena:
//
//   Petición HTTP → [CORS] → [JSON Parser] → [verifyToken] → [Controlador] → Respuesta
//
// Cada eslabón puede:
//   a) Procesar la petición y pasar al siguiente (next()).
//   b) Rechazar la petición y enviar una respuesta de error (res.status().json()).
//   c) Modificar el objeto req (ej: añadir req.user) antes de pasar al siguiente.
//
// En Aroma & Grano, la cadena típica para rutas protegidas es:
//   1. cors()          → Permite peticiones cross-origin.
//   2. express.json()  → Parsea el cuerpo JSON de la petición.
//   3. verifyToken()   → Valida el JWT (ESTE ARCHIVO).
//   4. Controlador     → Ejecuta la lógica de negocio (CRUD de pedidos, etc.).
//
// =========================================================================

// =========================================================================
// ¿QUÉ ES JWT (JSON WEB TOKEN)?
// =========================================================================
//
// JWT es un estándar abierto (RFC 7519) para transmitir información de
// forma segura entre dos partes como un objeto JSON compacto y auto-contenido.
//
// ESTRUCTURA DE UN JWT (3 partes separadas por puntos):
// ─────────────────────────────────────────────────────
//   eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U
//   \_____________________/ \_________________________/ \___________________________________/
//         HEADER                    PAYLOAD                          SIGNATURE
//
//   1. HEADER: Contiene el algoritmo de firma (ej: HS256, RS256) y el tipo (JWT).
//      Se codifica en Base64URL.
//
//   2. PAYLOAD: Contiene los "claims" (afirmaciones) sobre el usuario:
//      - sub: ID único del usuario (en Supabase, es el UUID del usuario).
//      - email: Correo electrónico del usuario.
//      - role: Rol del usuario (authenticated, anon, service_role).
//      - exp: Timestamp de expiración (epoch en segundos).
//      - iat: Timestamp de emisión.
//      Se codifica en Base64URL (¡NO está encriptado, solo codificado!).
//
//   3. SIGNATURE (Firma): Se genera combinando el header + payload con una
//      clave secreta (JWT Secret) usando el algoritmo especificado.
//      Permite verificar que el token NO ha sido alterado (integridad).
//
// FLUJO DE AUTENTICACIÓN JWT EN AROMA & GRANO:
// ─────────────────────────────────────────────
//   1. El usuario (mesero/admin) ingresa email y contraseña en el frontend Vue 3.
//   2. El frontend llama a Supabase Auth: supabase.auth.signInWithPassword().
//   3. Supabase verifica las credenciales y genera un JWT firmado.
//   4. El frontend almacena el JWT (localStorage/sessionStorage).
//   5. En cada petición al backend, el frontend envía el JWT en el header:
//        Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
//   6. ESTE MIDDLEWARE intercepta la petición, extrae el token y lo valida.
//   7. Si es válido, inyecta req.user y deja pasar la petición al controlador.
//
// =========================================================================

// =========================================================================
// IMPORTACIÓN DE DEPENDENCIAS
// =========================================================================
//
// Se importa la instancia administrativa del cliente Supabase (Singleton).
// Se utiliza específicamente el método supabaseAdmin.auth.getUser(token)
// para validar criptográficamente los tokens JWT contra el servidor de
// autenticación de Supabase, asegurando que:
//   - El token fue firmado con el JWT Secret correcto del proyecto.
//   - El token no ha expirado (claim 'exp' > tiempo actual).
//   - El usuario asociado al token aún existe y está activo.
//
// NOTA IMPORTANTE: Se usa el cliente ADMIN (con Service Role Key) porque
// el método getUser() del cliente admin puede verificar tokens de CUALQUIER
// usuario sin necesidad de tener una sesión activa en el backend.
//
import supabaseAdmin from "../services/supabaseAdmin.js";

// =========================================================================
// MIDDLEWARE DE VERIFICACIÓN DE TOKEN JWT
// =========================================================================
//
// PATRÓN: Guard / Gatekeeper (Guardián)
// ──────────────────────────────────────
// Este middleware actúa como un "guardián" que protege todas las rutas
// que lo incluyan. Solo permite el paso a peticiones que presenten un
// token JWT válido y no expirado. Es el componente central de la
// seguridad del backend de Aroma & Grano.
//
// ESQUEMA DE AUTENTICACIÓN: Bearer Token (RFC 6750)
// ──────────────────────────────────────────────────
// El esquema "Bearer" es un estándar HTTP para transmitir tokens de acceso.
// El formato del encabezado es:
//   Authorization: Bearer <token>
//
// "Bearer" significa "portador" en inglés. Quien porte (presente) un token
// válido obtiene acceso, similar a como una tarjeta de acceso física
// permite entrar a un edificio sin importar quién la lleve.
//
// =========================================================================

/**
 * @function verifyToken
 * @description
 * Middleware de seguridad que intercepta cada petición HTTP entrante,
 * extrae el JSON Web Token (JWT) del encabezado 'Authorization',
 * lo valida criptográficamente contra Supabase Auth, y si es correcto,
 * inyecta la identidad completa del usuario en `req.user` para que
 * los controladores posteriores puedan tomar decisiones basadas en
 * el rol, ID o email del usuario autenticado.
 *
 * @param {import('express').Request} req - Objeto de petición HTTP de Express.
 *   Contiene headers, body, params, query, y tras la validación, req.user.
 * @param {import('express').Response} res - Objeto de respuesta HTTP de Express.
 *   Permite enviar respuestas JSON con códigos de estado HTTP.
 * @param {import('express').NextFunction} next - Función callback de Express.
 *   Invocada para pasar el control al siguiente middleware o controlador.
 *
 * @returns {void | import('express').Response}
 *   - Si el token es válido: llama a next() y no retorna respuesta.
 *   - Si el token es inválido/ausente: retorna respuesta JSON con error 401 o 500.
 *
 * @example
 * // Uso en la configuración de rutas (app.js):
 * app.use("/api/pedidos", verifyToken, pedidosRoutes);
 *
 * // Uso en una ruta individual (routes/productos.routes.js):
 * router.get("/", verifyToken, productosController.getAll);
 *
 * @throws {Error} Captura cualquier excepción inesperada y retorna un error 500.
 *
 * @see {@link https://jwt.io/introduction} — Introducción a JWT
 * @see {@link https://supabase.com/docs/reference/javascript/auth-getuser} — Supabase getUser()
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7519} — RFC 7519 (JWT)
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6750} — RFC 6750 (Bearer Token)
 */
export const verifyToken = async (req, res, next) => {
  try {
    // ─────────────────────────────────────────────────────────────────────
    // PASO 1: EXTRAER EL ENCABEZADO DE AUTORIZACIÓN
    // ─────────────────────────────────────────────────────────────────────
    // El encabezado HTTP 'Authorization' es el mecanismo estándar para
    // transmitir credenciales en peticiones HTTP. En el esquema Bearer,
    // su formato es: "Bearer eyJhbGciOiJIUzI1NiJ9..."
    //
    // req.headers es un objeto que contiene TODOS los encabezados HTTP
    // de la petición entrante. Express normaliza los nombres de los
    // encabezados a minúsculas automáticamente, por lo que accedemos
    // con 'authorization' (minúscula), aunque el cliente lo envíe como
    // 'Authorization' (capitalizado).
    //
    const authHeader = req.headers.authorization;

    // VALIDACIÓN DE PRESENCIA Y FORMATO:
    // ───────────────────────────────────
    // Se verifica que:
    //   a) El encabezado existe (!authHeader → es null, undefined o cadena vacía).
    //   b) Comienza con "Bearer " (incluido el espacio). Esto descarta otros
    //      esquemas de autenticación como "Basic" (usuario:contraseña en Base64)
    //      o "Digest" (hash MD5).
    //
    // Si falla alguna condición, se retorna inmediatamente un error HTTP 401
    // (Unauthorized / No Autorizado). El código 401 indica que la petición
    // requiere autenticación y las credenciales proporcionadas son inválidas
    // o no fueron proporcionadas.
    //
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autorizado. Token no proporcionado o formato inválido." });
    }

    // ─────────────────────────────────────────────────────────────────────
    // PASO 2: EXTRAER EL TOKEN CRUDO (RAW TOKEN)
    // ─────────────────────────────────────────────────────────────────────
    // Se separa la cadena "Bearer eyJhbGciOiJIUzI1NiJ9..." por el espacio
    // y se toma el SEGUNDO elemento (índice [1]), que es el token JWT puro.
    //
    // EJEMPLO:
    //   "Bearer abc123".split(" ") → ["Bearer", "abc123"]
    //                                  [0]       [1] ← Este es el token
    //
    // El método .split(" ") divide una cadena en un array usando el espacio
    // como delimitador. Es un método nativo de String en JavaScript.
    //
    const token = authHeader.split(" ")[1];
    
    // VALIDACIÓN ADICIONAL: Se verifica que el token no sea una cadena vacía
    // o undefined. Esto cubre el caso extremo donde el encabezado sea
    // exactamente "Bearer " (con espacio pero sin token después).
    //
    if (!token) {
      return res.status(401).json({ error: "No autorizado. Token vacío." });
    }

    // ─────────────────────────────────────────────────────────────────────
    // PASO 3: VALIDACIÓN CRIPTOGRÁFICA DEL TOKEN CON SUPABASE AUTH
    // ─────────────────────────────────────────────────────────────────────
    // El método supabaseAdmin.auth.getUser(token) realiza una validación
    // COMPLETA del JWT, que incluye:
    //
    //   a) DECODIFICACIÓN: Separa el token en sus 3 partes (header, payload,
    //      signature) y decodifica el payload de Base64URL a JSON.
    //
    //   b) VERIFICACIÓN DE FIRMA: Recalcula la firma usando el JWT Secret
    //      del proyecto y compara con la firma incluida en el token.
    //      Si no coinciden, el token fue alterado (tampered) y se rechaza.
    //
    //   c) VERIFICACIÓN DE EXPIRACIÓN: Compara el claim 'exp' (expiration)
    //      con el tiempo actual del servidor. Si el token expiró, se rechaza.
    //      Los tokens de Supabase típicamente expiran en 1 hora (3600 segundos).
    //
    //   d) VERIFICACIÓN DE USUARIO: Consulta la tabla auth.users de Supabase
    //      para confirmar que el usuario aún existe y no ha sido eliminado
    //      o deshabilitado desde que se emitió el token.
    //
    // DESESTRUCTURACIÓN DE LA RESPUESTA:
    //   - { data } → Contiene el objeto 'user' con la información del usuario:
    //       { id, email, role, user_metadata, app_metadata, created_at, ... }
    //   - { error } → Contiene el error si la validación falla:
    //       { message: "JWT expired", status: 401 }
    //
    // NOTA: 'await' es necesario porque getUser() es una operación ASÍNCRONA
    // que realiza una petición HTTP al servidor de Supabase Auth. Sin await,
    // obtendríamos una Promise pendiente en lugar del resultado.
    //
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    // MANEJO DE ERRORES DE VALIDACIÓN:
    // ─────────────────────────────────
    // Si Supabase retorna un error (token expirado, firma inválida, etc.)
    // o si el objeto 'user' no existe en la respuesta, se rechaza la petición.
    //
    // El operador opcional (?.) en error?.message evita un TypeError si
    // 'error' es null/undefined. Es el operador de encadenamiento opcional
    // (optional chaining) introducido en ES2020.
    //
    if (error || !data.user) {
      console.error("JWT Error:", error?.message);
      return res.status(401).json({ error: "No autorizado. Token inválido o expirado." });
    }

    // ─────────────────────────────────────────────────────────────────────
    // PASO 4: INYECCIÓN DE LA IDENTIDAD DEL USUARIO EN LA PETICIÓN
    // ─────────────────────────────────────────────────────────────────────
    // Se adjunta el objeto completo del usuario autenticado al objeto 'req'
    // de Express. Esto es una convención ampliamente utilizada en backends
    // Node.js: el middleware de autenticación "decora" (augments) el objeto
    // request con información adicional que los controladores necesitan.
    //
    // A partir de este punto, CUALQUIER controlador o middleware posterior
    // en la cadena puede acceder a la identidad del usuario con:
    //   req.user.id          → UUID del usuario (ej: "a1b2c3d4-...")
    //   req.user.email       → Email (ej: "mesero@aromagrano.com")
    //   req.user.role        → Rol (ej: "authenticated")
    //   req.user.user_metadata → Datos personalizados (nombre, cargo, etc.)
    //
    // Esto es esencial para:
    //   - Control de acceso basado en roles (RBAC): Verificar si el usuario
    //     es administrador antes de permitir eliminar productos.
    //   - Auditoría: Registrar quién realizó cada operación en el sistema.
    //   - Personalización: Filtrar datos según el usuario (sus pedidos, mesas, etc.).
    //
    req.user = data.user;

    // ─────────────────────────────────────────────────────────────────────
    // PASO 5: PASAR LA PETICIÓN AL SIGUIENTE ESLABÓN DE LA CADENA
    // ─────────────────────────────────────────────────────────────────────
    // La invocación de next() es FUNDAMENTAL en la arquitectura de middleware
    // de Express. Sin esta llamada, la petición quedaría "atrapada" en este
    // middleware y nunca llegaría al controlador que procesa la lógica de negocio.
    //
    // next() le dice a Express: "La autenticación fue exitosa, continúa con
    // el siguiente middleware o controlador en la pila de rutas."
    //
    // En el contexto de Aroma & Grano, después de verifyToken, la petición
    // típicamente llega a un controlador como:
    //   - pedidos.controller.js → Para crear/listar pedidos.
    //   - productos.controller.js → Para gestionar el menú.
    //   - inventario.controller.js → Para movimientos de Kardex.
    //
    next();
  } catch (error) {
    // ─────────────────────────────────────────────────────────────────────
    // MANEJO DE ERRORES INESPERADOS (CATCH-ALL / SAFETY NET)
    // ─────────────────────────────────────────────────────────────────────
    // Este bloque catch captura CUALQUIER excepción no prevista que pueda
    // ocurrir durante la ejecución del middleware, como:
    //   - Errores de red (Supabase no disponible, timeout).
    //   - Errores de programación (TypeError, ReferenceError).
    //   - Errores del servidor de Supabase (500 Internal Server Error).
    //
    // Se retorna un error HTTP 500 (Internal Server Error) que indica
    // que el servidor encontró una condición inesperada que le impidió
    // completar la petición. A diferencia del 401 (problema del cliente),
    // el 500 indica un problema en el servidor.
    //
    // Se registra el error en console.error para facilitar la depuración
    // en los logs del servidor (útil en producción con herramientas como
    // PM2, Docker logs, o servicios de monitoreo como Sentry/Datadog).
    //
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({ error: "Error interno verificando la sesión." });
  }
};
