// Importación del cliente con privilegios de administrador de Supabase.
// Permite escribir, actualizar y borrar datos ignorando las restricciones RLS de la base de datos.
import supabaseAdmin from "../services/supabaseAdmin.js";

// =========================================================================
// FUNCIÓN UTILITARIA (MANTENIMIENTO Y SINCRONIZACIÓN)
// =========================================================================
/**
 * Recalcula de manera agregada la suma de los subtotales de un pedido y actualiza la cabecera.
 * Garantiza que el 'total' global refleje fielmente los cambios en los artículos individuales.
 * 
 * @param {string|number} idPedido - Identificador único de la orden principal.
 * @returns {number} El nuevo valor total calculado del pedido.
 */
const recalcularYActualizarTotal = async (idPedido) => {

  // 1. Obtiene la lista de todos los productos y subtotales actualmente asociados al pedido.
  // También revisa si alguno de estos ítems individuales tiene activo el beneficio de MADI.
  const {
    data: detalles,
    error
  } = await supabaseAdmin
    .from("detalle_pedidos")
    .select(`
      subtotal,
      is_madi_applied
    `)
    .eq(
      "id_pedido",
      idPedido
    );

  // Si la base de datos devuelve un error al listar los detalles, se interrumpe y propaga el error.
  if (error) throw error;

  // 2. Reduce algebraicamente el arreglo de objetos acumulando el valor numérico de cada 'subtotal'.
  // Se inicializa el acumulador (acc) en 0 para evitar errores de tipo NaN.
  const nuevoTotal =
    detalles.reduce(
      (acc, item) =>
        acc + Number(item.subtotal),
      0
    );

  // 3. Aplica el método .some() para determinar si al menos UNO de los productos de la lista
  // tiene aplicada la estrategia de descuento MADI (devuelve un valor booleano: true/false).
  const tieneMadi =
    detalles.some(
      item => item.is_madi_applied
    );

  // 4. Sincroniza y escribe los nuevos valores consolidados directamente en la cabecera de la tabla 'pedidos'.
  const {
    error: errorUpdate
  } = await supabaseAdmin
    .from("pedidos")
    .update({
      total_amount: nuevoTotal, // El costo monetario acumulado total de la orden
      madi_applied: tieneMadi   // Bandera para auditoría comercial: indica si la orden se benefició de MADI
    })
    .eq(
      "id_pedido",
      idPedido
    );

  // Control de errores en la actualización de la cabecera del pedido.
  if (errorUpdate) {
    throw errorUpdate;
  }

  // Devuelve el total numérico finalizado por si la función invocadora lo requiere para su respuesta JSON.
  return nuevoTotal;

};

// =========================================================================
// AGREGAR PRODUCTO
// =========================================================================
/**
 * Añade una línea de producto al detalle de un pedido existente.
 * Realiza verificaciones avanzadas de stock e inyecta descuentos comerciales basados en MADI.
 */
export const agregarProductoPedido = async (req, res) => {
  try {
    // Extracción de variables: El ID del pedido viene de la URL; el producto y la cantidad vienen del cliente.
    const { idPedido } = req.params;
    const { id_producto, quantity = 1 } = req.body; // Por defecto añade 1 unidad si el frontend no la especifica.

    // 1️⃣ Obtener producto desde el maestro de inventario
    // Necesitamos recuperar el costo comercial actual ('sale_price') y las existencias físicas disponibles en almacén ('stock').
    const { data: producto, error: errorProducto } = await supabaseAdmin
      .from("productos")
      .select("sale_price, stock")
      .eq("id_producto", id_producto)
      .single();

    // Validación preventiva: Si el ID de producto no existe en el catálogo, aborta con código HTTP 404.
    if (errorProducto || !producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // 2️⃣ Cantidad ya pedida de ese producto en el pedido actual
    // ¡Lógica clave! Si un cliente pide un café, y luego pide otro café en la misma mesa,
    // el sistema debe considerar lo que ya está anotado en este pedido virtual antes de validar el stock real.
    const { data: detallesExistentes } = await supabaseAdmin
      .from("detalle_pedidos")
      .select("quantity")
      .eq("id_pedido", idPedido)
      .eq("id_producto", id_producto);

    // Suma las cantidades previas que ya existen en el carrito para este artículo en específico.
    const cantidadYaPedida = detallesExistentes?.reduce(
      (sum, d) => sum + d.quantity,
      0
    ) || 0;

    // 3️⃣ Validar stock REAL disponible en el negocio
    // Condición: Existencias en inventario < (Lo que ya estaba en el carrito + Lo nuevo que se quiere agregar)
    if (producto.stock < cantidadYaPedida + quantity) {
      return res.status(400).json({
        error: "Stock insuficiente",
        // Envía un cálculo útil al frontend informando el remanente neto exacto que aún puede pedir
        disponible: producto.stock - cantidadYaPedida
      });
    }

    // 4️⃣ Obtener configuración de incentivos MADI
    // Consulta la tabla de configuración global para verificar si hay una campaña de descuentos activa.
    const { data: madi } = await supabaseAdmin
      .from("configuracion_madi")
      .select("is_active, discount_percentage")
      .single();

    // Inicialización del precio unitario base (Conversión explícita a número por seguridad de tipo)
    const baseUnitPrice = Number(producto.sale_price);

    // Precio base inicial sobre el cual se calcularán las variaciones de descuentos comerciales
    let precioBase = Number(producto.sale_price);

    // Configuración de variables temporales bajo el supuesto inicial de que MADI no se aplicará
    let finalUnitPrice = precioBase;
    let isMadiApplied = false;
    let madiDiscount = 0;

    // 5️⃣ Aplicar MADI si corresponde
    // Si la campaña está explícitamente activa y el porcentaje de descuento es superior a cero
    if (madi?.is_active && madi.discount_percentage > 0) {
      madiDiscount = Number(madi.discount_percentage);
      // Deducción matemática formal del porcentaje sobre el costo base unitario
      finalUnitPrice = precioBase - (precioBase * madiDiscount / 100);
      isMadiApplied = true; // Se levanta la bandera de activación
    }

    // 6️⃣ Insertar detalle con precio histórico congelado
    // Se guarda una captura de precios del momento exacto de la venta. Esto previene que si el precio del producto
    // cambia el día de mañana en el catálogo, los pedidos históricos o las auditorías financieras no se alteren.
    const { data: detalle, error: errorDetalle } = await supabaseAdmin
    .from("detalle_pedidos")
    .insert([{
        id_pedido: idPedido,
        id_producto,
        quantity,
        base_unit_price: baseUnitPrice,        // Precio normal del menú sin alterar
        final_unit_price: finalUnitPrice,      // Precio definitivo con el descuento aplicado
        subtotal: finalUnitPrice * quantity,   // Costo unitario final multiplicado por las unidades pedidas
        is_madi_applied: isMadiApplied,        // Registro lógico del descuento aplicado
        madi_discount_percentage: madiDiscount // Almacenamiento del porcentaje aplicado para futuras facturas
    }])
    .select()
    .single();

    // Si la inserción del detalle es rechazada por restricciones de la base de datos, retorna error 400.
    if (errorDetalle) {
      return res.status(400).json(errorDetalle);
    }

    // 7️⃣ Recalcular el gran total consolidado de la orden de compra
    // Llama a la función utilitaria superior para refrescar el estado monetario global del pedido.
    const nuevoTotal = await recalcularYActualizarTotal(idPedido);

    // Retorno exitoso HTTP 201 (Created) entregando los datos precisos de la nueva fila y el total actualizado.
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

// =========================================================================
// ACTUALIZAR CANTIDAD EN EL DETALLE
// =========================================================================
/**
 * Modifica el número de unidades pedidas de una línea de detalle existente.
 * Valida de forma estricta que la nueva cantidad deseada esté amparada por el inventario real.
 */
export const actualizarCantidadDetalle = async (req, res) => {
  try {
    // Captura los identificadores desde los parámetros estructurados y el nuevo valor de unidades del cuerpo
    const { idPedido, idDetalle } = req.params;
    const { quantity } = req.body;

    // Validación de seguridad física: No se admiten cantidades negativas o iguales a cero.
    // Si un producto se quiere quitar, para eso existe el endpoint de eliminación.
    if (quantity <= 0) {
      return res.status(400).json({ error: "Cantidad inválida" });
    }

    // 1️⃣ Obtener el estado e información actual de la línea de detalle que se desea alterar
    const { data: detalleActual, error: errorDetalle } = await supabaseAdmin
      .from("detalle_pedidos")
      .select(`
        id_producto,
        quantity,
        final_unit_price
      `)
      .eq("id_detalle", idDetalle)
      .single();

    // Control preventivo si la línea de detalle fue eliminada previamente o no se encuentra en la base de datos
    if (errorDetalle || !detalleActual) {
      return res.status(404).json({ error: "Detalle no encontrado" });
    }

    // Desestructuración del ID del producto afectado por este cambio de cantidad
    const { id_producto } = detalleActual;

    // 2️⃣ Consultar el inventario total existente del producto en el catálogo
    const { data: producto } = await supabaseAdmin
      .from("productos")
      .select("stock")
      .eq("id_producto", id_producto)
      .single();

    // Validación si el producto fue removido físicamente del inventario general durante la operación
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // 3️⃣ Calcular la cantidad del mismo producto presente en OTRAS líneas de detalle de esta misma orden
    // Excluye intencionalmente la línea actual (.neq("id_detalle", idDetalle)) para evaluar el consumo neto colateral.
    const { data: otrosDetalles } = await supabaseAdmin
      .from("detalle_pedidos")
      .select("quantity")
      .eq("id_pedido", idPedido)
      .eq("id_producto", id_producto)
      .neq("id_detalle", idDetalle);

    // Sumatoria agregada del consumo colateral del mismo artículo en otras líneas de la orden
    const cantidadYaPedida =
      otrosDetalles?.reduce((sum, d) => sum + d.quantity, 0) || 0;

    // 4️⃣ Validar si el stock de bodega tolera la suma de las otras líneas más la nueva cantidad solicitada
    if (producto.stock < cantidadYaPedida + quantity) {
      return res.status(400).json({
        error: "Stock insuficiente",
        disponible: producto.stock - cantidadYaPedida // Margen neto disponible libre para asignar a esta línea
      });
    }

    // 5️⃣ Recalcular el subtotal específico de esta línea de detalle usando el precio histórico congelado
    // Nota: Esto garantiza que el precio no fluctúe si la promoción MADI se desactivó después de crear la orden.
    const nuevoSubtotal = detalleActual.final_unit_price * quantity;

    // 6️⃣ Actualizar la fila en 'detalle_pedidos' con la nueva cantidad de unidades y su subtotal ponderado
    await supabaseAdmin
      .from("detalle_pedidos")
      .update({
        quantity,
        subtotal: nuevoSubtotal
      })
      .eq("id_detalle", idDetalle);

    // 7️⃣ Recalcular el costo total definitivo que engloba a toda la comanda
    const nuevoTotal = await recalcularYActualizarTotal(idPedido);

    // Envío de la respuesta confirmando el éxito y devolviendo el total para actualizar el POS del mesero en tiempo real
    res.json({
      message: "Cantidad actualizada correctamente",
      nuevoTotal
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar cantidad" });
  }
};

// =========================================================================
// ELIMINAR DETALLE (O DESTRUCCIÓN AUTOMÁTICA DE PEDIDOS VACÍOS)
// =========================================================================
/**
 * Remueve por completo un producto del detalle de un pedido.
 * ¡Inteligencia de negocio!: Si la orden se queda sin ningún producto, el sistema elimina automáticamente
 * el pedido huérfano de la base de datos y libera la mesa para que pueda ser ocupada por nuevos clientes.
 */
export const eliminarDetalle = async (req, res) => {
  try {
    // Extracción de las claves primarias necesarias para realizar el descarte
    const { idPedido, idDetalle } = req.params;

    // 1. Antes de borrar, recupera la información de la mesa ('id_mesa') asociada a esta orden.
    // Esto es crítico por si necesitamos hacer una liberación física automática del espacio.
    const { data: pedidoData } = await supabaseAdmin
      .from("pedidos")
      .select("id_mesa")
      .eq("id_pedido", idPedido)
      .single();

    // 2. Ejecuta la eliminación física de la línea de artículo en la tabla 'detalle_pedidos'.
    await supabaseAdmin
      .from("detalle_pedidos")
      .delete()
      .eq("id_detalle", idDetalle);

    // 3. Auditoría de conteo rápido (Head Query) para verificar cuántas líneas le quedan al pedido.
    // `{ count: "exact", head: true }` le dice a Supabase que calcule el conteo exacto sin transferir
    // las filas de datos por la red, optimizando drásticamente la velocidad y la memoria.
    const { count } = await supabaseAdmin
      .from("detalle_pedidos")
      .select("*", { count: "exact", head: true })
      .eq("id_pedido", idPedido);

    // 4. FLUJO DE CONTROL: Si el conteo es exactamente CERO, significa que el pedido quedó complemente vacío.
    if (count === 0) {
      // Procede a eliminar la cabecera del pedido en la tabla 'pedidos' para evitar registros basura en la base de datos.
      await supabaseAdmin
        .from("pedidos")
        .delete()
        .eq("id_pedido", idPedido);

      // Si el pedido original estaba asignado a una mesa física, cambia el estado de esa mesa a "libre"
      // para que el mapa de mesas del restaurante o cafetería se pinte de verde al instante en el frontend.
      if (pedidoData) {
        await supabaseAdmin
          .from("mesas")
          .update({ status: "libre" })
          .eq("id_mesa", pedidoData.id_mesa);
      }

      // Responde al cliente notificando que el pedido completo fue anulado de forma segura debido al vaciado total.
      return res.json({
        message: "Pedido vacío eliminado",
        orderDeleted: true // Bandera lógica para que el frontend limpie la interfaz de usuario por completo
      });
    }

    // 5. En caso de que el conteo de artículos sea superior a cero, el pedido sigue vivo.
    // Por lo tanto, se vuelve a invocar el cálculo de totales agregados para restar el valor del producto eliminado.
    const nuevoTotal = await recalcularYActualizarTotal(idPedido);

    // Envía la respuesta confirmando el descarte exitoso y proveyendo el nuevo balance financiero de la comanda.
    res.json({
      message: "Producto eliminado",
      nuevoTotal,
      orderDeleted: false // Indica al frontend que mantenga la orden abierta en pantalla
    });
  } catch (error) {
    // Captura y aislamiento de fallos durante la eliminación de registros en cascada
    res.status(500).json({
      error: "Error al eliminar detalle"
    });
  }
};