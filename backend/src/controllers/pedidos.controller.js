import supabaseAdmin from "../services/supabaseAdmin.js";

// =========================
// FUNCIÓN UTILITARIA
// =========================
const recalcularYActualizarTotal = async (idPedido) => {
  const { data: detalles, error } = await supabaseAdmin
    .from("detalle_pedidos")
    .select("subtotal")
    .eq("id_pedido", idPedido);

  if (error) throw error;

  const nuevoTotal = detalles.reduce(
    (acc, item) => acc + Number(item.subtotal),
    0
  );

  const { error: errorUpdate } = await supabaseAdmin
    .from("pedidos")
    .update({ total_amount: nuevoTotal })
    .eq("id_pedido", idPedido);

  if (errorUpdate) throw errorUpdate;

  return nuevoTotal;
};

// =========================
// AGREGAR PRODUCTO
// =========================
export const agregarProductoPedido = async (req, res) => {
  try {
    const { idPedido } = req.params;
    const { id_producto, quantity = 1 } = req.body;

    // 1️⃣ Obtener producto
    const { data: producto, error: errorProducto } = await supabaseAdmin
      .from("productos")
      .select("sale_price, stock")
      .eq("id_producto", id_producto)
      .single();

    if (errorProducto || !producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // 2️⃣ Cantidad ya pedida de ese producto en el pedido
    const { data: detallesExistentes } = await supabaseAdmin
      .from("detalle_pedidos")
      .select("quantity")
      .eq("id_pedido", idPedido)
      .eq("id_producto", id_producto);

    const cantidadYaPedida = detallesExistentes?.reduce(
      (sum, d) => sum + d.quantity,
      0
    ) || 0;

    // 3️⃣ Validar stock REAL
    if (producto.stock < cantidadYaPedida + quantity) {
      return res.status(400).json({
        error: "Stock insuficiente",
        disponible: producto.stock - cantidadYaPedida
      });
    }

    // 4️⃣ Obtener configuración MADI
    const { data: madi } = await supabaseAdmin
      .from("configuracion_madi")
      .select("is_active, discount_percentage")
      .single();

    const baseUnitPrice = Number(producto.sale_price);

    // Precio base
    let precioBase = Number(producto.sale_price);

    // Valores MADI por defecto
    let finalUnitPrice = precioBase;
    let isMadiApplied = false;
    let madiDiscount = 0;

    // Aplicar MADI si corresponde
    if (madi?.is_active && madi.discount_percentage > 0) {
    madiDiscount = Number(madi.discount_percentage);
    finalUnitPrice = precioBase - (precioBase * madiDiscount / 100);
    isMadiApplied = true;
    }

    // Insertar detalle con precio histórico
    const { data: detalle, error: errorDetalle } = await supabaseAdmin
    .from("detalle_pedidos")
    .insert([{
        id_pedido: idPedido,
        id_producto,
        quantity,
        final_unit_price: finalUnitPrice,
        subtotal: finalUnitPrice * quantity,
        is_madi_applied: isMadiApplied,
        madi_discount_percentage: madiDiscount
    }])
    .select()
    .single();
    if (errorDetalle) {
      return res.status(400).json(errorDetalle);
    }

    // 6️⃣ Recalcular total del pedido
    const nuevoTotal = await recalcularYActualizarTotal(idPedido);

    res.status(201).json({
      message: "Producto agregado correctamente",
      detalle,
      nuevoTotal
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// =========================
// ACTUALIZAR CANTIDAD
// =========================
export const actualizarCantidadDetalle = async (req, res) => {
  try {
    const { idPedido, idDetalle } = req.params;
    const { quantity } = req.body;

    if (quantity <= 0) {
      return res.status(400).json({ error: "Cantidad inválida" });
    }

    // 1️⃣ Obtener detalle actual con producto
    const { data: detalleActual, error: errorDetalle } = await supabaseAdmin
      .from("detalle_pedidos")
      .select(`
        id_producto,
        quantity,
        final_unit_price
      `)
      .eq("id_detalle", idDetalle)
      .single();

    if (errorDetalle || !detalleActual) {
      return res.status(404).json({ error: "Detalle no encontrado" });
    }

    const { id_producto } = detalleActual;

    // 2️⃣ Obtener stock del producto
    const { data: producto } = await supabaseAdmin
      .from("productos")
      .select("stock")
      .eq("id_producto", id_producto)
      .single();

    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // 3️⃣ Cantidad del producto en el pedido (EXCEPTO este detalle)
    const { data: otrosDetalles } = await supabaseAdmin
      .from("detalle_pedidos")
      .select("quantity")
      .eq("id_pedido", idPedido)
      .eq("id_producto", id_producto)
      .neq("id_detalle", idDetalle);

    const cantidadYaPedida =
      otrosDetalles?.reduce((sum, d) => sum + d.quantity, 0) || 0;

    // 4️⃣ Validar stock real
    if (producto.stock < cantidadYaPedida + quantity) {
      return res.status(400).json({
        error: "Stock insuficiente",
        disponible: producto.stock - cantidadYaPedida
      });
    }

    // 5️⃣ Recalcular subtotal (precio ya vendido)
    const nuevoSubtotal = detalleActual.final_unit_price * quantity;

    // 6️⃣ Actualizar detalle
    await supabaseAdmin
      .from("detalle_pedidos")
      .update({
        quantity,
        subtotal: nuevoSubtotal
      })
      .eq("id_detalle", idDetalle);

    // 7️⃣ Recalcular total del pedido
    const nuevoTotal = await recalcularYActualizarTotal(idPedido);

    res.json({
      message: "Cantidad actualizada correctamente",
      nuevoTotal
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar cantidad" });
  }
};

// =========================
// ELIMINAR DETALLE
// =========================
export const eliminarDetalle = async (req, res) => {
  try {
    const { idPedido, idDetalle } = req.params;

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

      return res.json({
        message: "Pedido vacío eliminado",
        orderDeleted: true
      });
    }

    const nuevoTotal = await recalcularYActualizarTotal(idPedido);

    res.json({
      message: "Producto eliminado",
      nuevoTotal,
      orderDeleted: false
    });
  } catch (error) {
    res.status(500).json({
      error: "Error al eliminar detalle"
    });
  }
};