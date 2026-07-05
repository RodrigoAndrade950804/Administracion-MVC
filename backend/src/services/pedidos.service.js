import supabaseAdmin from "./supabaseAdmin.js";

// =========================================================================
// FUNCIÓN UTILITARIA INTERNA
// =========================================================================
const recalcularYActualizarTotal = async (idPedido) => {
  const { data: detalles, error } = await supabaseAdmin
    .from("detalle_pedidos")
    .select(`subtotal, is_madi_applied`)
    .eq("id_pedido", idPedido);

  if (error) throw error;

  const nuevoTotal = detalles.reduce((acc, item) => acc + Number(item.subtotal), 0);
  const tieneMadi = detalles.some(item => item.is_madi_applied);

  const { error: errorUpdate } = await supabaseAdmin
    .from("pedidos")
    .update({
      total_amount: nuevoTotal,
      madi_applied: tieneMadi
    })
    .eq("id_pedido", idPedido);

  if (errorUpdate) throw errorUpdate;

  return nuevoTotal;
};

// =========================================================================
// SERVICIOS EXPORTADOS
// =========================================================================

export const crearPedidoService = async (id_mesa, id_user) => {
  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .insert([{ id_mesa, id_user, status: "abierto", total_amount: 0 }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const obtenerPedidoMesaService = async (id_mesa) => {
  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .select(`
      *,
      detalle_pedidos (
        *,
        productos (*)
      )
    `)
    .eq("id_mesa", id_mesa)
    .eq("status", "abierto")
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const eliminarPedidoService = async (idPedido) => {
  const { error } = await supabaseAdmin
    .from("pedidos")
    .delete()
    .eq("id_pedido", idPedido);

  if (error) throw error;
  return true;
};

export const agregarProductoPedidoService = async (idPedido, id_producto, quantity = 1) => {
  const { data: producto, error: errorProducto } = await supabaseAdmin
    .from("productos")
    .select("sale_price, stock")
    .eq("id_producto", id_producto)
    .single();

  if (errorProducto || !producto) throw Object.assign(new Error("Producto no encontrado"), { status: 404 });

  const { data: detallesExistentes } = await supabaseAdmin
    .from("detalle_pedidos")
    .select("quantity")
    .eq("id_pedido", idPedido)
    .eq("id_producto", id_producto);

  const cantidadYaPedida = detallesExistentes?.reduce((sum, d) => sum + d.quantity, 0) || 0;

  if (producto.stock < cantidadYaPedida + quantity) {
    throw Object.assign(new Error("Stock insuficiente"), { status: 400, disponible: producto.stock - cantidadYaPedida });
  }

  const { data: happyHour } = await supabaseAdmin
    .from("configuracion_happy_hour")
    .select("is_active, discount_percentage")
    .single();

  const baseUnitPrice = Number(producto.sale_price);
  let precioBase = Number(producto.sale_price);
  let finalUnitPrice = precioBase;
  let isMadiApplied = false; // Mantenemos el nombre de la columna para retrocompatibilidad
  let madiDiscount = 0;

  if (happyHour?.is_active && happyHour.discount_percentage > 0) {
    madiDiscount = Number(happyHour.discount_percentage);
    finalUnitPrice = precioBase - (precioBase * madiDiscount / 100);
    isMadiApplied = true;
  }

  const { data: detalle, error: errorDetalle } = await supabaseAdmin
    .from("detalle_pedidos")
    .insert([{
      id_pedido: idPedido,
      id_producto,
      quantity,
      base_unit_price: baseUnitPrice,
      final_unit_price: finalUnitPrice,
      subtotal: finalUnitPrice * quantity,
      is_madi_applied: isMadiApplied,
      madi_discount_percentage: madiDiscount
    }])
    .select()
    .single();

  if (errorDetalle) throw errorDetalle;

  const nuevoTotal = await recalcularYActualizarTotal(idPedido);

  return { detalle, nuevoTotal };
};

export const actualizarCantidadDetalleService = async (idPedido, idDetalle, quantity) => {
  if (quantity <= 0) throw Object.assign(new Error("Cantidad inválida"), { status: 400 });

  const { data: detalleActual, error: errorDetalle } = await supabaseAdmin
    .from("detalle_pedidos")
    .select("id_producto, quantity, final_unit_price")
    .eq("id_detalle", idDetalle)
    .single();

  if (errorDetalle || !detalleActual) throw Object.assign(new Error("Detalle no encontrado"), { status: 404 });

  const { id_producto } = detalleActual;

  const { data: producto } = await supabaseAdmin
    .from("productos")
    .select("stock, sale_price")
    .eq("id_producto", id_producto)
    .single();

  if (!producto) throw Object.assign(new Error("Producto no encontrado"), { status: 404 });

  const { data: otrosDetalles } = await supabaseAdmin
    .from("detalle_pedidos")
    .select("quantity")
    .eq("id_pedido", idPedido)
    .eq("id_producto", id_producto)
    .neq("id_detalle", idDetalle);

  const cantidadYaPedida = otrosDetalles?.reduce((sum, d) => sum + d.quantity, 0) || 0;

  if (producto.stock < cantidadYaPedida + quantity) {
    throw Object.assign(new Error("Stock insuficiente"), { status: 400, disponible: producto.stock - cantidadYaPedida });
  }

  // FIX: Force re-evaluate Happy Hour state to prevent ghost discount
  const { data: happyHour } = await supabaseAdmin
    .from("configuracion_happy_hour")
    .select("is_active, discount_percentage")
    .single();

  let precioBase = Number(producto.sale_price);
  let finalUnitPrice = precioBase;
  let isMadiApplied = false;
  let madiDiscount = 0;

  if (happyHour?.is_active && happyHour.discount_percentage > 0) {
    madiDiscount = Number(happyHour.discount_percentage);
    finalUnitPrice = precioBase - (precioBase * madiDiscount / 100);
    isMadiApplied = true;
  }

  const nuevoSubtotal = finalUnitPrice * quantity;

  await supabaseAdmin
    .from("detalle_pedidos")
    .update({ 
      quantity, 
      subtotal: nuevoSubtotal,
      final_unit_price: finalUnitPrice,
      is_madi_applied: isMadiApplied,
      madi_discount_percentage: madiDiscount
    })
    .eq("id_detalle", idDetalle);

  const nuevoTotal = await recalcularYActualizarTotal(idPedido);
  return nuevoTotal;
};

export const eliminarDetalleService = async (idPedido, idDetalle) => {
  const { data: pedidoData } = await supabaseAdmin
    .from("pedidos")
    .select("id_mesa")
    .eq("id_pedido", idPedido)
    .single();

  await supabaseAdmin
    .from("detalle_pedidos")
    .delete()
    .eq("id_detalle", idDetalle);

  const { count } = await supabaseAdmin
    .from("detalle_pedidos")
    .select("*", { count: "exact", head: true })
    .eq("id_pedido", idPedido);

  if (count === 0) {
    await supabaseAdmin
      .from("pedidos")
      .delete()
      .eq("id_pedido", idPedido);

    if (pedidoData) {
      await supabaseAdmin
        .from("mesas")
        .update({ status: "libre" })
        .eq("id_mesa", pedidoData.id_mesa);
    }

    return { message: "Pedido vacío eliminado", orderDeleted: true };
  }

  const nuevoTotal = await recalcularYActualizarTotal(idPedido);
  return { message: "Producto eliminado", nuevoTotal, orderDeleted: false };
};

export const cerrarPedidoSeguroService = async (idPedido) => {
  const { data: detallesList, error: detallesError } = await supabaseAdmin
    .from("detalle_pedidos")
    .select("id_producto, quantity, subtotal")
    .eq("id_pedido", idPedido);

  if (detallesError) throw detallesError;

  if (!detallesList || detallesList.length === 0) {
    throw new Error("El pedido no tiene detalles");
  }

  let total = 0;
  for (const item of detallesList) {
    total += Number(item.subtotal || 0);
  }

  const { data: pedido, error: pedidoError } = await supabaseAdmin
    .from("pedidos")
    .update({ total_amount: total, status: "cerrado" })
    .eq("id_pedido", idPedido)
    .select()
    .single();

  if (pedidoError) throw pedidoError;

  // TRIGGER: Verificar si el Happy Hour global debe encenderse silenciosamente
  try {
    const { verificarActivacionHappyHourService } = await import("./happy_hour.service.js");
    await verificarActivacionHappyHourService();
  } catch (e) {
    console.error("Error al intentar auto-activar Happy Hour:", e);
  }

  return pedido;
};