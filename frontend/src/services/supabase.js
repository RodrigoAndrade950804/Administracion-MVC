import { createClient } from "@supabase/supabase-js";

// =========================
// CONFIGURACIÓN DE VARIABLES DE ENTORNO
// =========================
// import.meta.env permite acceder a las variables definidas en tu archivo .env.
// Esto es una buena práctica de seguridad: las credenciales sensibles nunca 
// deben escribirse directamente en el código fuente.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// =========================
// INICIALIZACIÓN DEL CLIENTE
// =========================
/**
 * Se crea la instancia del cliente utilizando los parámetros cargados.
 * - 'supabaseUrl': La dirección de tu proyecto en la nube.
 * - 'supabaseKey': La clave pública (anon key) que permite a la aplicación 
 * realizar consultas permitidas por tus políticas de RLS (Row Level Security).
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);