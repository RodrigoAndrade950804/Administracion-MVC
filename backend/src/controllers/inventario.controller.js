import supabaseAdmin from "../services/supabaseAdmin.js";


export const descontarInventarioPedido =
async (req, res) => {

  try {

    const { idPedido } = req.params;

    // =====================
    // OBTENER USUARIO DEL PEDIDO
    // =====================

    const {
      data: pedido,
      error: pedidoError
    } =
      await supabaseAdmin
        .from("pedidos")
        .select("id_user")
        .eq(
          "id_pedido",
          idPedido
        )
        .single();

    if (pedidoError) {

      return res
        .status(400)
        .json(pedidoError);

    }

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

            id_user:
              pedido.id_user,

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

export const registrarMovimientoInventario =
async (req, res) => {

  try {

    const {
      id_producto,
      stock_nuevo,
      id_user,
      observacion
    } = req.body;

    const {
      data: producto,
      error: productoError
    } =
      await supabaseAdmin
        .from("productos")
        .select("*")
        .eq(
          "id_producto",
          id_producto
        )
        .single();

    if (productoError) {

      return res
        .status(400)
        .json(productoError);

    }

    const stockAnterior =
      producto.stock;

    const diferencia =
      stock_nuevo -
      stockAnterior;

    if (diferencia === 0) {

      return res.json({
        message:
          "Sin cambios de stock"
      });

    }

    await supabaseAdmin
      .from("productos")
      .update({
        stock: stock_nuevo
      })
      .eq(
        "id_producto",
        id_producto
      );

    await supabaseAdmin
      .from(
        "movimientos_inventario"
      )
      .insert([
        {
          id_producto,

          id_user,

          tipo_movimiento:
            diferencia > 0
              ? "entrada"
              : "ajuste",

          cantidad:
            Math.abs(
              diferencia
            ),

          stock_anterior:
            stockAnterior,

          stock_nuevo,

          observacion:
            observacion ||
            "Ajuste manual"
        }
      ]);

    res.json({
      message:
        "Movimiento registrado"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error:
        "Error interno"
    });

  }

};