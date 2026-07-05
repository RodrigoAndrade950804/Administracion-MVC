import { supabase } from "../services/supabase";

/**
 * Cliente API centralizado.
 * Este archivo actúa como un "Interceptor". Antes de enviar cualquier
 * petición al backend, busca el JWT de Supabase y lo inyecta en la cabecera.
 */
export const fetchWithAuth = async (url, options = {}) => {
  // 1. Obtener la sesión activa de Supabase (y su token JWT)
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  // 2. Preparar los encabezados (Headers)
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // 3. Inyectar el Token si existe
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // 4. Ejecutar la petición
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // 5. Manejo global de expiración de sesión (401)
  if (response.status === 401) {
    console.error("Sesión expirada o token inválido. Cerrando sesión...");
    await supabase.auth.signOut();
    localStorage.removeItem("auth");
    if (window.location.pathname !== "/") {
      window.location.href = "/"; // Forzar redirección al login
    }
  }

  return response;
};
