// Importación del método oficial 'createClient' desde el SDK de Supabase para Node.js.
// Este método es el encargado de orquestar la conexión y los canales de comunicación con tu base de datos.
import { createClient } from "@supabase/supabase-js";

// =========================================================================
// INICIALIZACIÓN DEL CLIENTE ADMINISTRATIVO (SUPERUSUARIO)
// =========================================================================
/**
 * Instancia especial de Supabase configurada con privilegios de administrador global.
 * * ⚠️ ADVERTENCIA CRÍTICA DE SEGURIDAD:
 * Este cliente utiliza 'SUPABASE_SERVICE_ROLE_KEY'. Esta llave actúa como una "llave maestra" 
 * que ignora por completo las políticas RLS (Row Level Security) de las tablas. Por esta razón,
 * este archivo y sus variables de entorno SOLO deben existir y ejecutarse en el Backend (servidor).
 * NUNCA se debe exportar o utilizar esta configuración en el Frontend (Vue/Vite), ya que expondría 
 * el control total de la base de datos a cualquier usuario malintencionado.
 */
const supabaseAdmin =
  createClient(
    // 1. URL base del proyecto de Supabase (Ej: https://xyz.supabase.co).
    // Se lee de forma segura desde las variables de entorno de Node.js (process.env).
    process.env.SUPABASE_URL,
    
    // 2. La firma secreta de administración (Service Role Key).
    // Concede permisos totales para crear/borrar usuarios en Auth y mutar cualquier tabla de la base de datos.
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

// Exportación por defecto de la instancia administrativa.
// Permite que cualquier controlador o servicio del backend (como el de inventarios, pedidos o usuarios)
// lo importe para interactuar directamente con los datos del sistema AromaGrano sin restricciones de seguridad locales.
export default supabaseAdmin;