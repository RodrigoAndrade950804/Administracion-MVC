// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║            AROMA & GRANO — SISTEMA DE GESTIÓN GASTRONÓMICA              ║
// ║     Archivo: services/supabaseAdmin.js — Cliente Administrativo DB      ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// =========================================================================
// ¿QUÉ ES SUPABASE Y CÓMO ENCAJA EN ESTE PROYECTO?
// =========================================================================
//
// Supabase es una plataforma de Backend-as-a-Service (BaaS) de código abierto
// que ofrece una alternativa a Firebase. Proporciona:
//   - Base de datos PostgreSQL completa (relacional, con SQL real).
//   - Sistema de autenticación integrado (Auth) con JWT.
//   - Almacenamiento de archivos (Storage).
//   - Funciones Edge (Edge Functions).
//   - Suscripciones en tiempo real (Realtime) vía WebSockets.
//
// En el proyecto Aroma & Grano, Supabase actúa como:
//   1. BASE DE DATOS PRINCIPAL: Almacena tablas de productos, pedidos,
//      inventarios, mesas, usuarios, movimientos Kardex, etc.
//   2. SISTEMA DE AUTH: Gestiona el registro, login y tokens JWT de
//      los usuarios (meseros, administradores, cajeros).
//   3. REALTIME: Notifica en tiempo real cuando cambia el estado de
//      una mesa o llega un nuevo pedido (usado con WebSockets).
//
// ARQUITECTURA BaaS vs. BACKEND TRADICIONAL:
// ──────────────────────────────────────────
// En un backend tradicional, tú construyes tu propia base de datos,
// autenticación, y APIs desde cero. Con BaaS, Supabase provee todo
// esto "listo para usar", y tu backend Node.js/Express actúa como una
// capa intermedia (middleware layer) que añade lógica de negocio,
// validaciones y seguridad adicional antes de acceder a Supabase.
//
// =========================================================================

// =========================================================================
// IMPORTACIÓN DEL SDK DE SUPABASE
// =========================================================================
//
// ¿QUÉ ES UN SDK?
// ────────────────
// SDK (Software Development Kit) es un conjunto de herramientas, librerías
// y documentación que facilita la integración con un servicio externo.
// '@supabase/supabase-js' es el SDK oficial de Supabase para JavaScript/Node.js.
//
// ¿QUÉ ES 'createClient'?
// ────────────────────────
// Es una función factoría (Factory Function) que crea y retorna una instancia
// del cliente Supabase. Esta instancia es el punto de entrada para todas
// las operaciones: consultas SQL, autenticación, almacenamiento, etc.
//
// DESESTRUCTURACIÓN DE IMPORTACIÓN:
//   - 'import { createClient }' → Usa desestructuración (destructuring) para
//     extraer SOLO la función 'createClient' del módulo. Esto es más eficiente
//     que importar todo el módulo, ya que herramientas como bundlers pueden
//     eliminar el código no utilizado (tree-shaking).
//
import { createClient } from "@supabase/supabase-js";

// =========================================================================
// INICIALIZACIÓN DEL CLIENTE ADMINISTRATIVO (SUPERUSUARIO)
// =========================================================================
//
// PATRÓN ARQUITECTÓNICO: SINGLETON
// ─────────────────────────────────
// Este archivo implementa el patrón de diseño Singleton de manera implícita.
// En Node.js, cuando un módulo se importa por primera vez, su código se
// ejecuta UNA SOLA VEZ. Las importaciones subsiguientes desde otros archivos
// reciben la MISMA referencia en caché (gracias al Module Cache de Node.js).
//
// Esto significa que:
//   - La primera vez que cualquier archivo hace:
//       import supabaseAdmin from "../services/supabaseAdmin.js"
//     ...se ejecuta createClient() y se crea la conexión.
//   - Todas las importaciones posteriores (desde controladores, servicios,
//     middlewares) reciben EXACTAMENTE la misma instancia.
//   - Nunca se crean múltiples conexiones innecesarias a Supabase.
//
// ¿POR QUÉ ES IMPORTANTE EL SINGLETON AQUÍ?
//   1. EFICIENCIA: Evita crear múltiples conexiones HTTP/WebSocket.
//   2. CONSISTENCIA: Todos los módulos comparten el mismo estado de conexión.
//   3. RECURSOS: Cada conexión consume memoria y sockets del sistema operativo.
//
// TIPOS DE LLAVES EN SUPABASE:
// ────────────────────────────
// Supabase proporciona dos tipos de llaves API por proyecto:
//
//   1. ANON KEY (Llave Anónima / Pública):
//      - Segura para usar en el frontend (navegador).
//      - RESPETA las políticas RLS (Row Level Security).
//      - Solo permite operaciones que las políticas RLS autoricen.
//      - Es la que usa el frontend Vue 3 de Aroma & Grano.
//
//   2. SERVICE ROLE KEY (Llave de Rol de Servicio / Administrador):
//      - ⚠️ SOLO para uso en el backend (servidor).
//      - IGNORA completamente las políticas RLS.
//      - Tiene acceso TOTAL a todas las tablas y datos.
//      - Equivale a un "superusuario" de la base de datos.
//      - Es la que usa ESTE archivo para operaciones administrativas.
//
// =========================================================================

/**
 * @description
 * Instancia administrativa del cliente Supabase configurada con la llave
 * de servicio (Service Role Key). Esta instancia tiene privilegios de
 * superusuario y puede realizar CUALQUIER operación sobre la base de datos
 * sin restricciones de Row Level Security (RLS).
 *
 * @type {import('@supabase/supabase-js').SupabaseClient}
 *
 * @example
 * // Uso típico desde un controlador del backend:
 * import supabaseAdmin from "../services/supabaseAdmin.js";
 *
 * const { data, error } = await supabaseAdmin
 *   .from("productos")
 *   .select("*")
 *   .eq("activo", true);
 *
 * @security
 * ⚠️ ADVERTENCIA CRÍTICA DE SEGURIDAD:
 * Este cliente utiliza 'SUPABASE_SERVICE_ROLE_KEY'. Esta llave actúa como
 * una "llave maestra" que ignora por completo las políticas RLS (Row Level
 * Security) de las tablas. Por esta razón:
 *   - Este archivo y sus variables de entorno SOLO deben existir y
 *     ejecutarse en el Backend (servidor Node.js/Express).
 *   - NUNCA se debe exportar o utilizar esta configuración en el Frontend
 *     (Vue/Vite), ya que expondría el control total de la base de datos
 *     a cualquier usuario malintencionado.
 *   - La SERVICE_ROLE_KEY NUNCA debe aparecer en el código fuente del
 *     frontend, en repositorios públicos, ni en logs de consola.
 *   - Siempre debe leerse desde variables de entorno (process.env).
 */
const supabaseAdmin =
  createClient(
    // ─────────────────────────────────────────────────────────────────────
    // PARÁMETRO 1: URL del Proyecto Supabase
    // ─────────────────────────────────────────────────────────────────────
    // Es la URL base de tu instancia de Supabase. Tiene el formato:
    //   https://<id-del-proyecto>.supabase.co
    //
    // Esta URL es el punto de entrada para TODAS las APIs de Supabase:
    //   - REST API (PostgREST): https://xyz.supabase.co/rest/v1/
    //   - Auth API:             https://xyz.supabase.co/auth/v1/
    //   - Storage API:          https://xyz.supabase.co/storage/v1/
    //   - Realtime:             wss://xyz.supabase.co/realtime/v1/
    //
    // Se lee de forma segura desde las variables de entorno de Node.js
    // (process.env), las cuales fueron cargadas previamente por dotenv
    // en el archivo config/env.js.
    //
    process.env.SUPABASE_URL,
    
    // ─────────────────────────────────────────────────────────────────────
    // PARÁMETRO 2: Service Role Key (Llave de Administración)
    // ─────────────────────────────────────────────────────────────────────
    // Esta es la llave secreta de rol de servicio del proyecto Supabase.
    // Concede permisos totales e irrestrictos para:
    //   - Crear, leer, actualizar y eliminar datos en CUALQUIER tabla.
    //   - Gestionar usuarios en Supabase Auth (crear, eliminar, verificar).
    //   - Acceder al almacenamiento de archivos (Storage).
    //   - Ejecutar funciones RPC (Remote Procedure Calls) en PostgreSQL.
    //
    // A diferencia de la ANON KEY, esta llave NO pasa por el filtro de
    // las políticas RLS, lo que la hace extremadamente poderosa y peligrosa
    // si se expone al público.
    //
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

// =========================================================================
// EXPORTACIÓN DEL MÓDULO
// =========================================================================
//
// ¿QUÉ ES 'export default'?
// ──────────────────────────
// 'export default' marca una exportación como la exportación principal
// (por defecto) del módulo. Cuando otro archivo hace:
//   import supabaseAdmin from "../services/supabaseAdmin.js"
// ...recibe directamente esta instancia sin necesidad de desestructurar {}.
//
// ¿QUIÉN IMPORTA ESTE MÓDULO?
// ────────────────────────────
// Esta instancia es utilizada por múltiples capas del backend de Aroma & Grano:
//   - CONTROLADORES (controllers/): Para realizar consultas CRUD a las tablas
//     de productos, pedidos, inventarios, mesas, etc.
//   - MIDDLEWARES (middlewares/): Para validar tokens JWT con supabaseAdmin.auth.getUser().
//   - SERVICIOS (services/): Para lógica de negocio compleja como el sistema
//     MADI de gamificación o el módulo Happy Hour.
//
// Gracias al patrón Singleton implícito de Node.js, todos estos archivos
// comparten la MISMA instancia de conexión, optimizando los recursos del servidor.
//
export default supabaseAdmin;