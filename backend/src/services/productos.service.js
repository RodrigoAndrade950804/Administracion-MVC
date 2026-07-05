import supabaseAdmin from "./supabaseAdmin.js";

export const getProductosService = async () => {
  const { data, error } = await supabaseAdmin
    .from("productos")
    .select("*")
    .order("id_producto");

  if (error) throw error;
  return data;
};

export const crearProductoService = async (producto) => {
  const { data, error } = await supabaseAdmin
    .from("productos")
    .insert([producto])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const actualizarProductoService = async (idProducto, productoData, idUser = null) => {
  // 1. Obtener estado actual
  const { data: productoActual, error: errorProducto } = await supabaseAdmin
    .from("productos")
    .select("*")
    .eq("id_producto", idProducto)
    .single();

  if (errorProducto) throw errorProducto;

  const stockAnterior = Number(productoActual.stock);
  const stockNuevo = Number(productoData.stock);

  // 2. Actualizar producto
  const { data, error } = await supabaseAdmin
    .from("productos")
    .update(productoData)
    .eq("id_producto", idProducto)
    .select()
    .single();

  if (error) throw error;

  // 3. Registrar auditoría si hubo cambio de stock
  if (stockAnterior !== stockNuevo) {
    const tipoMovimiento = stockNuevo > stockAnterior ? "entrada" : "ajuste";
    const observacion = stockNuevo > stockAnterior 
      ? "Ingreso manual de stock" 
      : "Ajuste manual de stock";
    
    const cantidad = Math.abs(stockNuevo - stockAnterior);

    await supabaseAdmin
      .from("movimientos_inventario")
      .insert([{
        id_producto: idProducto,
        id_user: idUser,
        tipo_movimiento,
        cantidad,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        observacion
      }]);
  }

  return data;
};

export const eliminarProductoService = async (idProducto) => {
  const { error } = await supabaseAdmin
    .from("productos")
    .delete()
    .eq("id_producto", idProducto);

  if (error) throw error;
  return true;
};
