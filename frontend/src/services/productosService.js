import { supabase } from "./supabase";

// =========================
// OBTENER PRODUCTOS
// =========================
/**
 * Recupera la lista completa de productos.
 * Utiliza .order("id_producto") para asegurar que el catálogo tenga una 
 * estructura predecible en la interfaz (importante para evitar saltos visuales).
 */
export const getProductos = async () => {
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .order("id_producto");

  if (error) throw error;
  return data;
};

// =========================
// CREAR PRODUCTO
// =========================
/**
 * Inserta un nuevo producto. 
 * El uso de .select().single() retorna inmediatamente el objeto recién creado, 
 * lo que permite actualizar el estado en el frontend sin tener que recargar toda la lista.
 */
export const crearProducto = async (producto) => {
  const { data, error } = await supabase
    .from("productos")
    .insert([producto])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// =========================
// ACTUALIZAR PRODUCTO (Con Auditoría)
// =========================
/**
 * Esta función es crítica: actualiza el producto y, SI el stock cambió,
 * registra automáticamente un movimiento en la tabla 'movimientos_inventario'.
 */
export const actualizarProducto = async (idProducto, producto, idUser = null) => {
  // 1. Obtenemos el estado actual del producto ANTES del cambio para calcular la diferencia.
  const { data: productoActual, error: errorProducto } = await supabase
    .from("productos")
    .select("*")
    .eq("id_producto", idProducto)
    .single();

  if (errorProducto) throw errorProducto;

  const stockAnterior = Number(productoActual.stock);
  const stockNuevo = Number(producto.stock);

  // 2. Ejecutamos la actualización principal en la tabla de productos.
  const { error } = await supabase
    .from("productos")
    .update(producto)
    .eq("id_producto", idProducto);

  if (error) throw error;

  // 3. LÓGICA DE AUDITORÍA: Si el stock cambió, registramos un movimiento.
  if (stockAnterior !== stockNuevo) {
    const tipoMovimiento = stockNuevo > stockAnterior ? "entrada" : "ajuste";
    const observacion = stockNuevo > stockAnterior 
      ? "Ingreso manual de stock" 
      : "Ajuste manual de stock";
    
    // Calculamos el valor absoluto de la diferencia.
    const cantidad = Math.abs(stockNuevo - stockAnterior);

    const { error: movimientoError } = await supabase
      .from("movimientos_inventario")
      .insert([{
        id_producto: idProducto,
        id_user: idUser,           // Quién hizo el cambio.
        tipo_movimiento,           // 'entrada' o 'ajuste'.
        cantidad,                  // Valor de la diferencia.
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        observacion
      }]);

    if (movimientoError) {
      console.error("Error al registrar movimiento de auditoría:", movimientoError);
    }
  }
};

// =========================
// ELIMINAR PRODUCTO
// =========================
/**
 * Elimina un producto del catálogo permanentemente. 
 * ¡Cuidado! Si existen detalles de pedidos asociados a este ID, la base de datos 
 * podría rechazar la eliminación dependiendo de la configuración de llaves foráneas (Foreign Keys).
 */
export const eliminarProducto = async (idProducto) => {
  const { error } = await supabase
    .from("productos")
    .delete()
    .eq("id_producto", idProducto);

  if (error) throw error;
};