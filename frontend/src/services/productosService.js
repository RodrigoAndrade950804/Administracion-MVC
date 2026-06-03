import { supabase } from "./supabase";

// =========================
// OBTENER PRODUCTOS
// =========================

export const getProductos = async () => {

  const { data, error } =
    await supabase
      .from("productos")
      .select("*")
      .order("id_producto");

  if (error) {
    throw error;
  }

  return data;

};

// =========================
// CREAR PRODUCTO
// =========================

export const crearProducto = async (
  producto
) => {

  const { data, error } =
    await supabase
      .from("productos")
      .insert([producto])
      .select()
      .single();

  if (error) throw error;

  return data;

};

// =========================
// ACTUALIZAR PRODUCTO
// =========================

export const actualizarProducto = async (
  idProducto,
  producto
) => {

  const { error } =
    await supabase
      .from("productos")
      .update(producto)
      .eq(
        "id_producto",
        idProducto
      );

  if (error) throw error;

};

// =========================
// ELIMINAR PRODUCTO
// =========================

export const eliminarProducto = async (
  idProducto
) => {

  const { error } =
    await supabase
      .from("productos")
      .delete()
      .eq(
        "id_producto",
        idProducto
      );

  if (error) throw error;

};