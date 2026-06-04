// Importación del cliente administrativo de Supabase que permite realizar operaciones 
// en la base de datos saltándose las políticas de seguridad RLS (Row Level Security).
import supabaseAdmin from "../services/supabaseAdmin.js";

/**
 * Controlador para descontar el stock de los productos involucrados en un pedido específico.
 * Se ejecuta normalmente cuando un pedido pasa a un estado confirmado o pagado.
 * 
 * @param {Object} req - Objeto de petición de Express. Contiene los parámetros de la URL (req.params).
 * @param {Object} res - Objeto de respuesta de Express para enviar respuestas HTTP.
 */
export const descontarInventarioPedido =
async (req, res) => {

  try {
    // Extracción del ID del pedido desde los parámetros de la ruta (Ej: /inventario/descontar/:idPedido)
    const { idPedido } = req.params;

    // =========================================================================
    // OBTENER USUARIO DEL PEDIDO
    // =========================================================================
    // Se consulta la tabla 'pedidos' para identificar al usuario (id_user) que realizó la orden.
    // Esto es necesario para asociar el historial del movimiento de inventario a este usuario.
    const {
      data: pedido,
      error: pedidoError
    } =
      await supabaseAdmin
        .from("pedidos") // Tabla objetivo
        .select("id_user") // Traer únicamente la columna id_user
        .eq(
          "id_pedido",
          idPedido
        ) // Condición WHERE id_pedido = idPedido
        .single(); // Fuerza a que retorne un solo objeto en lugar de un arreglo

    // Si ocurre un error al buscar el pedido (ej. no existe), se detiene la ejecución 
    // y se retorna un estado HTTP 400 Bad Request junto con el detalle del error.
    if (pedidoError) {

      return res
        .status(400)
        .json(pedidoError);

    }

    // =========================================================================
    // DETALLE PEDIDO
    // =========================================================================
    // Se consultan los productos contenidos en el pedido.
    // Usando la sintaxis de relación de Supabase `*, productos(*)`, se trae toda la información
    // del detalle del pedido y, de forma anidada, los datos del producto relacionado (como su stock actual).
    const {
      data: detalles,
      error: detallesError
    } =
      await supabaseAdmin
        .from("detalle_pedidos") // Tabla objetivo
        .select(`
          *,
          productos(*)
        `) // Trae todos los campos de detalle y el objeto completo del producto asociado
        .eq(
          "id_pedido",
          idPedido
        ); // Condición WHERE id_pedido = idPedido

    // Si ocurre un error al traer los detalles, se retorna un estado HTTP 400 Bad Request.
    if (detallesError) {

      return res
        .status(400)
        .json(detallesError);

    }

    // =========================================================================
    // RECORRER PRODUCTOS
    // =========================================================================
    // Ciclo para procesar uno a uno los productos vendidos en el pedido y actualizar sus existencias.
    for (
      const detalle of detalles
    ) {
      // Se extrae la información del producto anidado en esta fila del detalle
      const producto =
        detalle.productos;

      // Se guarda el stock que tiene actualmente el producto en la base de datos
      const stockAnterior =
        producto.stock;

      // Se obtiene la cantidad de unidades que se vendieron en este pedido
      const cantidadVendida =
        detalle.quantity;

      // Cálculo matemático: Se resta la cantidad vendida al stock que existía previamente
      const stockNuevo =
        stockAnterior -
        cantidadVendida;

      // =========================================================================
      // ACTUALIZAR PRODUCTO
      // =========================================================================
      // Se realiza la actualización física en la tabla 'productos' inyectando el nuevo stock calculado.
      await supabaseAdmin
        .from("productos")
        .update({
          stock: stockNuevo // Objeto con los campos a modificar
        })
        .eq(
          "id_producto",
          producto.id_producto
        ); // Condición WHERE id_producto = id del producto actual en el ciclo

      // =========================================================================
      // MOVIMIENTO (KARDEX / HISTORIAL)
      // =========================================================================
      // Se registra una nueva fila en la tabla de auditoría 'movimientos_inventario' 
      // para dejar constancia histórica de por qué y cuánto varió el stock de este producto.
      await supabaseAdmin
        .from(
          "movimientos_inventario"
        )
        .insert([
          {
            id_producto:
              producto.id_producto, // ID del producto afectado

            id_user:
              pedido.id_user, // ID del usuario que generó el pedido (obtenido al inicio)

            tipo_movimiento:
              "venta", // Se tipifica como "venta" debido a que proviene de un pedido consumado

            cantidad:
              cantidadVendida, // Unidades que salieron del almacén

            stock_anterior:
              stockAnterior, // Captura de pantalla del stock antes de la venta

            stock_nuevo:
              stockNuevo, // Estado del stock después de aplicar la venta

            observacion:
              `Pedido #${idPedido}` // Nota descriptiva de auditoría de inventario
          }
        ]);

    }

    // Si el bucle 'for' finaliza con éxito para todos los productos, se envía respuesta exitosa (HTTP 200)
    res.json({
      message:
        "Inventario actualizado"
    });

  } catch (error) {
    // Si ocurre un error inesperado en el bloque try (como fallo de conexión), se loguea en el servidor
    console.error(error);

    // Se responde al cliente con un estado HTTP 500 Internal Server Error
    res.status(500).json({
      error:
        "Error interno"
    });

  }

};

/**
 * Controlador para registrar movimientos o ajustes manuales de inventario desde el panel de administración.
 * Permite incrementar (entradas) o decrementar (ajustes/mermas) las existencias directamente.
 * 
 * @param {Object} req - Objeto de petición de Express. Contiene los datos del cuerpo de la solicitud (req.body).
 * @param {Object} res - Objeto de respuesta de Express.
 */
export const registrarMovimientoInventario =
async (req, res) => {

  try {
    // Extracción de datos del cuerpo de la petición (JSON enviado desde el frontend)
    const {
      id_producto, // ID del producto que se va a ajustar manualmente
      stock_nuevo, // El nuevo valor de stock que el administrador estableció
      id_user,     // ID del administrador o supervisor que realiza la acción
      observacion  // Justificación del porqué se hace el ajuste (ej: "Producto roto", "Abastecimiento")
    } = req.body;

    // Se consulta el estado actual del producto para conocer su stock previo al ajuste manual
    const {
      data: producto,
      error: productoError
    } =
      await supabaseAdmin
        .from("productos")
        .select("*") // Selecciona todas las columnas del producto
        .eq(
          "id_producto",
          id_producto
        )
        .single(); // Espera una respuesta única

    // Si el producto no se encuentra o la consulta falla, responde inmediatamente con HTTP 400
    if (productoError) {

      return res
        .status(400)
        .json(productoError);

    }

    // Almacena el stock actual recuperado de la base de datos
    const stockAnterior =
      producto.stock;

    // Se calcula la diferencia aritmética para saber si aumentó o disminuyó el stock
    const diferencia =
      stock_nuevo -
      stockAnterior;

    // Validación: Si el administrador guardó el mismo valor que ya existía, no hay nada que actualizar.
    if (diferencia === 0) {

      return res.json({
        message:
          "Sin cambios de stock"
      });

    }

    // Se actualiza el stock del producto en la tabla 'productos' con el valor definitivo enviado en el body
    await supabaseAdmin
      .from("productos")
      .update({
        stock: stock_nuevo
      })
      .eq(
        "id_producto",
        id_producto
      );

    // Se registra el movimiento manual en el historial/kardex ('movimientos_inventario')
    await supabaseAdmin
      .from(
        "movimientos_inventario"
      )
      .insert([
        {
          id_producto, // El ID del producto modificado

          id_user, // El ID del usuario responsable del cambio manual

          // Condicional ternario: Si la diferencia es positiva, el tipo es "entrada" (abastecimiento).
          // Si la diferencia es negativa, se cataloga como un "ajuste" (pérdidas, mermas, corrección de errores).
          tipo_movimiento:
            diferencia > 0
              ? "entrada"
              : "ajuste",

          // Se aplica Math.abs() para guardar siempre un número entero positivo en la columna 'cantidad',
          // sin importar si la diferencia fue una resta (ej. -5 pasa a ser 5 unidades ajustadas).
          cantidad:
            Math.abs(
              diferencia
            ),

          stock_anterior:
            stockAnterior, // El stock real previo a la modificación

          stock_nuevo, // El stock definitivo después de la modificación

          // Se asigna la observación provista por el frontend, o un texto genérico por defecto
          observacion:
            observacion ||
            "Ajuste manual"
        }
      ]);

    // Envío de respuesta exitosa confirmando el registro del movimiento
    res.json({
      message:
        "Movimiento registrado"
    });

  } catch (error) {
    // Captura de errores de servidor fatales
    console.error(error);

    res.status(500).json({
      error:
        "Error interno"
    });

  }

};