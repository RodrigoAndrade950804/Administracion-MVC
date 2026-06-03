import supabaseAdmin from "../services/supabaseAdmin.js";

export const descontarInventarioPedido =
async (req, res) => {

  try {

    const { idPedido } = req.params;

    // =====================
    // DETALLE PEDIDO
    // =====================

    const {
      data: detalles,
      error: detallesError
    } =
      await supabaseAdmin
        .from("detalle_pedidos")
        .select(`
          *,
          productos(*)
        `)
        .eq(
          "id_pedido",
          idPedido
        );

    if (detallesError) {

      return res
        .status(400)
        .json(detallesError);

    }

    // =====================
    // RECORRER PRODUCTOS
    // =====================

    for (
      const detalle of detalles
    ) {

      const producto =
        detalle.productos;

      const stockAnterior =
        producto.stock;

      const cantidadVendida =
        detalle.quantity;

      const stockNuevo =
        stockAnterior -
        cantidadVendida;

      // =====================
      // ACTUALIZAR PRODUCTO
      // =====================

      await supabaseAdmin
        .from("productos")
        .update({
          stock: stockNuevo
        })
        .eq(
          "id_producto",
          producto.id_producto
        );

      // =====================
      // MOVIMIENTO
      // =====================

      await supabaseAdmin
        .from(
          "movimientos_inventario"
        )
        .insert([
          {
            id_producto:
              producto.id_producto,

            tipo_movimiento:
              "venta",

            cantidad:
              cantidadVendida,

            stock_anterior:
              stockAnterior,

            stock_nuevo:
              stockNuevo,

            observacion:
              `Pedido #${idPedido}`
          }
        ]);

    }

    res.json({
      message:
        "Inventario actualizado"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error:
        "Error interno"
    });

  }

};