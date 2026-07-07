// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                    AROMA & GRANO — SISTEMA DE GESTIÓN                       ║
// ║       Archivo: services/supabase.js (Configuración del Cliente Supabase)    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  PROPÓSITO DE ESTE ARCHIVO                                                  │
// │  ─────────────────────────────────────────────────────────────────────────── │
// │  Inicializa y exporta una instancia ÚNICA del cliente de Supabase que       │
// │  toda la aplicación utiliza para:                                           │
// │                                                                             │
// │    1. Autenticación (auth.signInWithPassword, auth.signOut, auth.getSession)│
// │    2. Realtime (channels, postgres_changes, subscribe)                      │
// │    3. Consultas directas a la base de datos (from().select(), etc.)         │
// │                                                                             │
// │  PATRÓN DE DISEÑO — Singleton:                                              │
// │  Solo se crea UNA instancia de createClient() y se exporta. Todos los       │
// │  archivos que importen 'supabase' obtendrán exactamente la misma instancia, │
// │  garantizando que:                                                          │
// │  • Solo existe UNA conexión WebSocket para Realtime                         │
// │  • Solo existe UNA sesión de autenticación en memoria                       │
// │  • Los canales no se duplican accidentalmente                               │
// │                                                                             │
// │  ¿QUÉ ES SUPABASE?                                                         │
// │  Supabase es una alternativa open-source a Firebase que proporciona:         │
// │  • PostgreSQL como base de datos (relacional, con SQL completo)             │
// │  • Autenticación con JWT (email/password, OAuth, magic links)               │
// │  • Realtime con WebSockets (escuchar cambios en tablas PostgreSQL)          │
// │  • Storage para archivos (imágenes, PDFs)                                   │
// │  • Edge Functions (funciones serverless)                                     │
// │                                                                             │
// │  ARQUITECTURA DE COMUNICACIÓN:                                              │
// │  ┌─────────────┐    HTTPS/WSS     ┌──────────────────┐    SQL    ┌────────┐│
// │  │  Frontend   │ ◄──────────────► │  Supabase Cloud  │ ◄──────► │ Postgres││
// │  │  (Este app) │  API REST + WS   │  (Middleware)    │          │ (DB)   ││
// │  └─────────────┘                  └──────────────────┘          └────────┘│
// └─────────────────────────────────────────────────────────────────────────────┘

// =========================================================================
// IMPORTACIONES
// =========================================================================

/**
 * createClient — Función factory del SDK oficial de Supabase para JavaScript.
 * 
 * CONCEPTO — SDK (Software Development Kit):
 * Un SDK es un conjunto de herramientas y bibliotecas que simplifican
 * la interacción con un servicio externo. @supabase/supabase-js es el
 * SDK oficial que abstrae las llamadas HTTP y WebSocket a Supabase.
 * 
 * createClient() recibe las credenciales del proyecto y retorna un
 * objeto con métodos para auth, database, realtime, storage, etc.
 */
import { createClient } from "@supabase/supabase-js";

// =========================================================================
// CONFIGURACIÓN DE VARIABLES DE ENTORNO
// =========================================================================
/**
 * CONCEPTO — Variables de Entorno con Vite (import.meta.env):
 * 
 * Las variables de entorno son valores de configuración que se definen
 * FUERA del código fuente, generalmente en un archivo .env en la raíz
 * del proyecto. Esto proporciona varios beneficios:
 * 
 * 1. SEGURIDAD: Las credenciales no se escriben directamente en el código,
 *    evitando que se suban accidentalmente a repositorios públicos.
 * 
 * 2. PORTABILIDAD: Diferentes entornos (desarrollo, staging, producción)
 *    pueden tener URLs y claves diferentes sin cambiar el código.
 * 
 * 3. CONVENCIÓN VITE: En Vite, las variables DEBEN empezar con "VITE_"
 *    para ser accesibles en el código del cliente. Variables sin este
 *    prefijo solo están disponibles en el servidor (por seguridad).
 * 
 * ARCHIVO .env (ejemplo):
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ VITE_SUPABASE_URL=https://xyzcompany.supabase.co                   │
 * │ VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...   │
 * │ VITE_API_URL=http://localhost:3000                                  │
 * └──────────────────────────────────────────────────────────────────────┘
 * 
 * CONCEPTO — import.meta.env vs process.env:
 * • import.meta.env → Específico de Vite (ESModules, navegador)
 * • process.env     → Específico de Node.js (backend, Webpack)
 * En este proyecto frontend con Vite, SIEMPRE usamos import.meta.env.
 */

/**
 * @constant {string} supabaseUrl - URL del proyecto Supabase en la nube.
 * Formato típico: "https://<project-ref>.supabase.co"
 * Esta URL es pública y segura de exponer en el cliente.
 */
// import.meta.env permite acceder a las variables definidas en tu archivo .env.
// Esto es una buena práctica de seguridad: las credenciales sensibles nunca 
// deben escribirse directamente en el código fuente.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

/**
 * @constant {string} supabaseKey - Clave pública anónima (anon key) del proyecto.
 * 
 * CONCEPTO — Anon Key vs Service Role Key:
 * Supabase genera DOS tipos de claves API:
 * 
 * ┌──────────────────┬──────────────────────────────────────────────────────┐
 * │ Clave            │ Descripción                                         │
 * ├──────────────────┼──────────────────────────────────────────────────────┤
 * │ anon (pública)   │ Segura para el cliente. Respeta las políticas RLS.  │
 * │                  │ Solo puede hacer lo que RLS permite. ✅ Usada aquí  │
 * ├──────────────────┼──────────────────────────────────────────────────────┤
 * │ service_role     │ NUNCA exponer en el cliente. Tiene acceso total     │
 * │ (secreta)        │ a la base de datos, ignorando RLS. 🔒 Solo backend │
 * └──────────────────┴──────────────────────────────────────────────────────┘
 * 
 * CONCEPTO — RLS (Row Level Security):
 * RLS son políticas de seguridad definidas directamente en PostgreSQL que
 * controlan qué filas puede leer/escribir cada usuario basándose en su
 * JWT. Ejemplo: "Un mesero solo puede ver SUS pedidos, no los de otros".
 * La anon key activa estas verificaciones automáticamente.
 */
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// =========================================================================
// INICIALIZACIÓN DEL CLIENTE SUPABASE
// =========================================================================
/**
 * Se crea la instancia del cliente utilizando los parámetros cargados.
 * 
 * @constant {SupabaseClient} supabase - Instancia singleton del cliente Supabase.
 * 
 * Esta instancia proporciona acceso a todos los servicios de Supabase:
 * 
 * • supabase.auth     → Sistema de autenticación
 *   - signInWithPassword()  → Login con email y contraseña
 *   - signOut()             → Cerrar sesión
 *   - getSession()          → Obtener sesión actual y JWT
 * 
 * • supabase.from()   → Consultas a la base de datos
 *   - .select()       → Leer datos (SELECT)
 *   - .insert()       → Insertar datos (INSERT)
 *   - .update()       → Actualizar datos (UPDATE)
 *   - .delete()       → Eliminar datos (DELETE)
 * 
 * • supabase.channel() → Suscripciones Realtime
 *   - .on('postgres_changes', ...) → Escuchar cambios en tablas
 *   - .subscribe()                 → Activar la suscripción WebSocket
 * 
 * • supabase.storage  → Almacenamiento de archivos
 *   - .from('bucket').upload()   → Subir archivos
 *   - .from('bucket').download() → Descargar archivos
 * 
 * PARÁMETROS:
 * - 'supabaseUrl': La dirección de tu proyecto en la nube.
 * - 'supabaseKey': La clave pública (anon key) que permite a la aplicación 
 *   realizar consultas permitidas por tus políticas de RLS (Row Level Security).
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);