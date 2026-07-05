import supabaseAdmin from "./supabaseAdmin.js";

/**
 * Descuenta el stock de los productos involucrados en un pedido.
 */
export const descontarInventarioPedidoService = async (idPedido) => {
  // Obtener usuario del pedido
  const { data: pedido, error: pedidoError } = await supabaseAdmin
    .from("pedidos")
    .select("id_user")
    .eq("id_pedido", idPedido)
    .single();

  if (pedidoError) throw pedidoError;

  // Obtener detalles del pedido
  const { data: detalles, error: detallesError } = await supabaseAdmin
    .from("detalle_pedidos")
    .select(`
      *,
      productos(*)
    `)
    .eq("id_pedido", idPedido);

  if (detallesError) throw detallesError;

  // Recorrer productos y actualizar existencias
  for (const detalle of detalles) {
    const producto = detalle.productos;
    const stockAnterior = producto.stock;
    const cantidadVendida = detalle.quantity;
    const stockNuevo = stockAnterior - cantidadVendida;

    // Actualizar producto
    const { error: updateError } = await supabaseAdmin
      .from("productos")
      .update({ stock: stockNuevo })
      .eq("id_producto", producto.id_producto);
      
    if (updateError) throw updateError;

    // Registrar movimiento (Kardex)
    const { error: movError } = await supabaseAdmin
      .from("movimientos_inventario")
      .insert([
        {
          id_producto: producto.id_producto,
          id_user: pedido.id_user,
          tipo_movimiento: "venta",
          cantidad: cantidadVendida,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          observacion: `Pedido #${idPedido}`
        }
      ]);
      
    if (movError) throw movError;
  }

  return true;
};

/**
 * Registra movimientos o ajustes manuales de inventario.
 */
export const registrarMovimientoInventarioService = async (data) => {
  const { id_producto, stock_nuevo, id_user, observacion } = data;

  const { data: producto, error: productoError } = await supabaseAdmin
    .from("productos")
    .select("*")
    .eq("id_producto", id_producto)
    .single();

  if (productoError) throw productoError;

  const stockAnterior = producto.stock;
  const diferencia = stock_nuevo - stockAnterior;

  if (diferencia === 0) {
    return { message: "Sin cambios de stock", changed: false };
  }

  const { error: updateError } = await supabaseAdmin
    .from("productos")
    .update({ stock: stock_nuevo })
    .eq("id_producto", id_producto);
    
  if (updateError) throw updateError;

  const { error: movError } = await supabaseAdmin
    .from("movimientos_inventario")
    .insert([
      {
        id_producto,
        id_user,
        tipo_movimiento: diferencia > 0 ? "entrada" : "ajuste",
        cantidad: Math.abs(diferencia),
        stock_anterior: stockAnterior,
        stock_nuevo,
        observacion: observacion || "Ajuste manual"
      }
    ]);
    
  if (movError) throw movError;

  return { message: "Movimiento registrado", changed: true };
};
