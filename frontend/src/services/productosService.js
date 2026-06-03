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
  producto,
  idUser = null
) => {

  // =========================
  // PRODUCTO ACTUAL
  // =========================

  const {
    data: productoActual,
    error: errorProducto
  } =
    await supabase
      .from("productos")
      .select("*")
      .eq(
        "id_producto",
        idProducto
      )
      .single();

  if (errorProducto) {
    throw errorProducto;
  }

  const stockAnterior =
    Number(productoActual.stock);

  const stockNuevo =
    Number(producto.stock);

  // =========================
  // ACTUALIZAR PRODUCTO
  // =========================

  const { error } =
    await supabase
      .from("productos")
      .update(producto)
      .eq(
        "id_producto",
        idProducto
      );

  if (error) throw error;

  // =========================
  // REGISTRAR MOVIMIENTO
  // =========================

  if (
    stockAnterior !== stockNuevo
  ) {

    const tipoMovimiento =
      stockNuevo > stockAnterior
        ? "entrada"
        : "ajuste";

    const observacion =
      stockNuevo > stockAnterior
        ? "Ingreso manual de stock"
        : "Ajuste manual de stock";

    const cantidad =
      Math.abs(
        stockNuevo - stockAnterior
      );

    const {
      error: movimientoError
    } =
      await supabase
        .from(
          "movimientos_inventario"
        )
        .insert([
          {
            id_producto:
              idProducto,

            id_user:
              idUser,

            tipo_movimiento:
              tipoMovimiento,

            cantidad,

            stock_anterior:
              stockAnterior,

            stock_nuevo:
              stockNuevo,

            observacion
          }
        ]);

    if (movimientoError) {
      console.error(
        "Error movimiento:",
        movimientoError
      );
    }

  }

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