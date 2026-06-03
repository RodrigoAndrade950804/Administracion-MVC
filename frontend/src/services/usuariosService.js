import { supabase }
from "./supabase";

const API_URL = "http://localhost:3000/api/users";

// =========================
// GET USERS
// =========================

export const getUsers =
async () => {

  const response =
    await fetch(API_URL);

  return await response.json();

};

// =========================
// CREATE USER
// =========================

export const createUser =
async (userData) => {

  const response =
    await fetch(API_URL, {

      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify(userData)

    });

  return await response.json();

};

export const toggleUserStatus =
async (
  id,
  active
) => {

  const response =
    await fetch(

      `http://localhost:3000/api/users/${id}/status`,

      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            active
          })

      }

    );

  return await response.json();

};

export const actualizarUsuario =
async (
  id,
  usuario
) => {

  const response =
    await fetch(
      `http://localhost:3000/api/users/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify(
          usuario
        )
      }
    );

  return await response.json();

};

export const eliminarUsuario =
async (idUser) => {

  const response =
    await fetch(
      `http://localhost:3000/api/users/${idUser}`,
      {
        method: "DELETE"
      }
    );

  if (!response.ok) {

    throw new Error(
      "Error eliminando usuario"
    );

  }

  return await response.json();

};

export const getMeserosConVentas =
async () => {

  const {
    data,
    error
  } =
    await supabase
      .from("users")
      .select(`
        *,
        roles(*),
        pedidos(
          total_amount
        )
      `)
      .eq("id_role", 3);

  if (error) throw error;

  return data;

};