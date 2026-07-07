// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                    AROMA & GRANO — SISTEMA DE GESTIÓN                       ║
// ║           Archivo: api/apiClient.js (Cliente API Centralizado)              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  PROPÓSITO DE ESTE ARCHIVO                                                  │
// │  ─────────────────────────────────────────────────────────────────────────── │
// │  Implementa un "Interceptor" centralizado para TODAS las peticiones HTTP    │
// │  que la aplicación hace al backend (API REST).                              │
// │                                                                             │
// │  PROBLEMA QUE RESUELVE:                                                     │
// │  Sin este archivo, CADA servicio (usuariosService, pedidosService, etc.)    │
// │  tendría que repetir el código para:                                        │
// │    1. Obtener el token JWT de Supabase                                      │
// │    2. Inyectarlo en los headers de la petición                              │
// │    3. Manejar la expiración del token (error 401)                           │
// │                                                                             │
// │  CON este archivo, los servicios simplemente llaman a fetchWithAuth()       │
// │  y la autenticación se maneja automáticamente. Esto sigue el principio     │
// │  DRY (Don't Repeat Yourself).                                              │
// │                                                                             │
// │  PATRÓN DE DISEÑO — Interceptor / Proxy Pattern:                            │
// │  fetchWithAuth actúa como un "proxy" (intermediario) que intercepta         │
// │  cada petición HTTP ANTES de enviarla y DESPUÉS de recibir la respuesta:    │
// │                                                                             │
// │    Componente → fetchWithAuth() → [Inyecta JWT] → fetch() → Backend        │
// │                                                                             │
// │    Backend → fetch() response → [Verifica 401] → fetchWithAuth() → Comp.   │
// │                                                                             │
// │  ANALOGÍA: Es como un guardia de seguridad en la puerta del restaurante     │
// │  que le pone a cada mesero su gafete de identificación antes de dejarlo     │
// │  entrar, y si el gafete está vencido, lo envía de regreso a la entrada.    │
// │                                                                             │
// │  FLUJO COMPLETO DEL TOKEN JWT:                                              │
// │  ┌──────────────┐                                                           │
// │  │   1. Login   │ Usuario se autentica con email/password                   │
// │  └──────┬───────┘                                                           │
// │         ▼                                                                   │
// │  ┌──────────────┐                                                           │
// │  │  2. Supabase │ Genera un JWT firmado con los datos del usuario           │
// │  └──────┬───────┘                                                           │
// │         ▼                                                                   │
// │  ┌──────────────┐                                                           │
// │  │  3. Cliente  │ Almacena el JWT en la sesión de Supabase (memoria)        │
// │  └──────┬───────┘                                                           │
// │         ▼                                                                   │
// │  ┌──────────────┐                                                           │
// │  │ 4. Petición  │ fetchWithAuth lee el JWT y lo pone en Authorization       │
// │  └──────┬───────┘                                                           │
// │         ▼                                                                   │
// │  ┌──────────────┐                                                           │
// │  │  5. Backend  │ Verifica el JWT, extrae el usuario, ejecuta la lógica     │
// │  └──────┬───────┘                                                           │
// │         ▼                                                                   │
// │  ┌──────────────┐                                                           │
// │  │ 6. Respuesta │ Si JWT inválido → 401 → fetchWithAuth cierra sesión       │
// │  └──────────────┘                                                           │
// └─────────────────────────────────────────────────────────────────────────────┘

// =========================================================================
// IMPORTACIONES
// =========================================================================

/**
 * supabase — Instancia del cliente de Supabase.
 * 
 * Se importa para acceder al sistema de autenticación de Supabase
 * y poder obtener la sesión activa (que contiene el token JWT).
 * También se usa para cerrar la sesión cuando el token expira.
 * 
 * CONCEPTO — JWT (JSON Web Token):
 * Es un estándar abierto (RFC 7519) para transmitir información de forma
 * segura entre dos partes como un objeto JSON firmado digitalmente.
 * Estructura: HEADER.PAYLOAD.SIGNATURE
 * 
 * Ejemplo de payload decodificado:
 * {
 *   "sub": "user-uuid-123",     ← ID del usuario
 *   "role": "admin",            ← Rol del usuario
 *   "exp": 1700000000,          ← Fecha de expiración (Unix timestamp)
 *   "iat": 1699996400           ← Fecha de emisión
 * }
 */
import { supabase } from "../services/supabase";

// =========================================================================
// FUNCIÓN PRINCIPAL: fetchWithAuth (Interceptor de Peticiones HTTP)
// =========================================================================

/**
 * Cliente API centralizado con inyección automática de JWT.
 * Este archivo actúa como un "Interceptor". Antes de enviar cualquier
 * petición al backend, busca el JWT de Supabase y lo inyecta en la cabecera.
 * 
 * @async
 * @function fetchWithAuth
 * @param {string} url - La URL completa del endpoint del backend.
 *   Ejemplo: "http://localhost:3000/api/users"
 * @param {Object} [options={}] - Opciones de configuración para fetch().
 *   Sigue la misma interfaz que la API nativa fetch() del navegador:
 *   @param {string} [options.method] - Método HTTP: "GET", "POST", "PUT", "DELETE", "PATCH"
 *   @param {Object} [options.headers] - Headers adicionales personalizados
 *   @param {string} [options.body] - Cuerpo de la petición (generalmente JSON.stringify())
 * @returns {Promise<Response>} La respuesta del servidor como un objeto Response de fetch().
 *   El llamador debe verificar response.ok y llamar response.json() para obtener los datos.
 * 
 * @example
 * // Ejemplo de uso en un servicio:
 * const response = await fetchWithAuth("http://localhost:3000/api/users", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ name: "Juan", role: "mesero" })
 * });
 * const data = await response.json();
 * 
 * @throws {Error} Si la red falla o el servidor no responde.
 *   Los errores 401 NO lanzan excepciones; en su lugar, cierran la sesión.
 */
export const fetchWithAuth = async (url, options = {}) => {
  // ─────────────────────────────────────────────────────────────────────
  // PASO 1: Obtener la sesión activa de Supabase (y su token JWT)
  // ─────────────────────────────────────────────────────────────────────
  // supabase.auth.getSession() consulta la sesión almacenada en memoria
  // (NO hace una petición al servidor). Retorna un objeto con la estructura:
  // { data: { session: { access_token: "eyJhbGci...", user: {...} } } }
  //
  // CONCEPTO — Desestructuración Anidada de JavaScript:
  // La sintaxis { data: { session } } extrae directamente el objeto
  // 'session' desde la respuesta anidada en un solo paso.
  // Equivalente a: const session = (await supabase.auth.getSession()).data.session;
  const { data: { session } } = await supabase.auth.getSession();

  // CONCEPTO — Optional Chaining (Encadenamiento Opcional - ?.):
  // Si session es null (usuario no logueado), session?.access_token
  // retorna undefined en vez de lanzar un TypeError.
  // Esto permite que fetchWithAuth funcione incluso sin usuario autenticado
  // (útil para endpoints públicos como la configuración de Happy Hour).
  const token = session?.access_token;

  // ─────────────────────────────────────────────────────────────────────
  // PASO 2: Preparar los encabezados (Headers HTTP)
  // ─────────────────────────────────────────────────────────────────────
  // CONCEPTO — Spread Operator (...):
  // Los tres puntos (...) "esparcen" las propiedades del objeto options.headers
  // dentro del nuevo objeto headers. Esto permite que el llamador pase
  // headers adicionales que se FUSIONAN con "Content-Type".
  //
  // PRECEDENCIA: Si el llamador también envía "Content-Type", su versión
  // sobrescribirá la nuestra porque viene DESPUÉS en el spread.
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // ─────────────────────────────────────────────────────────────────────
  // PASO 3: Inyectar el Token JWT en el Header de Autorización
  // ─────────────────────────────────────────────────────────────────────
  // CONCEPTO — Bearer Token Authentication (RFC 6750):
  // El esquema "Bearer" indica al servidor que el valor que sigue es un
  // token portador (bearer token). El servidor lo decodifica para
  // identificar al usuario sin necesidad de usuario/contraseña.
  //
  // Formato del header: "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
  //
  // ¿POR QUÉ SE VERIFICA IF (token)?
  // Porque algunas rutas del backend son públicas y no requieren JWT.
  // Si no hay sesión, simplemente no se envía el header Authorization
  // y el backend decide si permite el acceso o lo deniega.
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // ─────────────────────────────────────────────────────────────────────
  // PASO 4: Ejecutar la petición HTTP con la API fetch() nativa
  // ─────────────────────────────────────────────────────────────────────
  // CONCEPTO — Fetch API (API de Obtención):
  // fetch() es la función nativa del navegador para hacer peticiones HTTP.
  // Reemplaza al antiguo XMLHttpRequest (XHR). Es basada en Promises y
  // soporta async/await de forma natural.
  //
  // El spread operator (...options) pasa method, body, etc. del llamador,
  // pero el objeto headers SOBRESCRIBE el que venía en options porque
  // se declara explícitamente después del spread.
  //
  // IMPORTANTE: fetch() solo lanza excepciones para errores de RED
  // (sin conexión, DNS fallido). Los errores HTTP (404, 500) NO lanzan
  // excepciones — debemos verificar response.ok o response.status.
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // ─────────────────────────────────────────────────────────────────────
  // PASO 5: Manejo global de expiración de sesión (HTTP 401 Unauthorized)
  // ─────────────────────────────────────────────────────────────────────
  // CONCEPTO — HTTP Status Codes (Códigos de Estado HTTP):
  // • 200-299: Éxito
  // • 301/302: Redirección
  // • 400: Bad Request (petición mal formada)
  // • 401: Unauthorized (no autenticado o token expirado) ← Manejado aquí
  // • 403: Forbidden (autenticado pero sin permisos)
  // • 404: Not Found
  // • 500: Internal Server Error
  //
  // ESTRATEGIA DE SEGURIDAD:
  // Si el backend responde con 401, significa que:
  // a) El token JWT ha expirado (caducidad típica: 1 hora)
  // b) El token fue revocado
  // c) El token es inválido o fue manipulado
  //
  // En TODOS estos casos, cerramos la sesión del usuario y lo
  // redirigimos al login para que obtenga un nuevo token.
  if (response.status === 401) {
    console.error("Sesión expirada o token inválido. Cerrando sesión...");

    // Cerramos la sesión en Supabase (elimina el token de memoria)
    await supabase.auth.signOut();

    // Eliminamos los datos de sesión persistidos en localStorage
    localStorage.removeItem("auth");

    // Solo redirigimos si NO estamos ya en la página de login
    // para evitar un bucle infinito de redirecciones
    if (window.location.pathname !== "/") {
      window.location.href = "/"; // Forzar redirección al login
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // PASO 6: Retornar la respuesta al llamador
  // ─────────────────────────────────────────────────────────────────────
  // Retornamos el objeto Response completo para que cada servicio
  // pueda manejar la respuesta según sus necesidades:
  // - response.ok → verificar si fue exitoso (status 200-299)
  // - response.json() → parsear el cuerpo como JSON
  // - response.status → verificar el código de estado específico
  // - response.headers → acceder a headers de respuesta
  return response;
};
