import { supabase } from "./supabase";
import { fetchWithAuth } from "../api/apiClient";

const API_URL = import.meta.env.VITE_API_URL + "/api/users";

// =========================
// CRUD DE USUARIOS (Vía Backend API)
// =========================
// Estas funciones utilizan el protocolo HTTP estándar (GET, POST, PUT, DELETE, PATCH).
// Se derivan al backend probablemente para gestionar la lógica de autenticación (auth.users),
// encriptación de contraseñas o validaciones de negocio antes de tocar la DB.

/** Obtiene el listado completo de usuarios registrados. */
export const getUsers = async () => {
  const response = await fetchWithAuth(API_URL);
  return await response.json();
};

/** Crea un nuevo usuario en el sistema. */
export const createUser = async (userData) => {
  const response = await fetchWithAuth(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData)
  });
  return await response.json();
};

/** Cambia el estado de un usuario (Activo/Inactivo) mediante un método PATCH (actualización parcial). */
export const toggleUserStatus = async (id, active) => {
  const response = await fetchWithAuth(`${API_URL}/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active })
  });
  return await response.json();
};

/** Actualiza toda la información de un usuario. */
export const actualizarUsuario = async (id, usuario) => {
  const response = await fetchWithAuth(`${API_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(usuario)
  });
  return await response.json();
};

/** Elimina un usuario de la base de datos. */
export const eliminarUsuario = async (idUser) => {
  const response = await fetchWithAuth(`${API_URL}/${idUser}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error("Error eliminando usuario");
  return await response.json();
};

// =========================
// CONSULTA DE MÉTRICAS (Vía Supabase)
// =========================
/**
 * Esta función es fundamental para el 'Dashboard Supervisor'.
 * Utiliza Supabase para realizar una consulta compleja ("Join"):
 * 1. Filtra usuarios con 'id_role: 3' (meseros).
 * 2. Trae sus datos personales y el rol correspondiente.
 * 3. Trae todos los pedidos asociados a cada mesero para poder calcular sus ventas.
 * Este enfoque es altamente eficiente al evitar múltiples llamadas al backend.
 */
export const getMeserosConVentas = async () => {
  const response = await fetchWithAuth(`${API_URL}/meseros-ventas`);
  if (!response.ok) throw new Error("Error obteniendo métricas");
  return await response.json();
};