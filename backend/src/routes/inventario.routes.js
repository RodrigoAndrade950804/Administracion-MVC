// Importación del framework Express para poder utilizar su sistema de enrutamiento modular.
import express from "express";

// Importación por desestructuración de las funciones controladoras específicas 
// que contienen la lógica de negocio para el manejo del inventario.
import {
  descontarInventarioPedido,
  registrarMovimientoInventario
}
from "../controllers/inventario.controller.js";

// Inicialización del enrutador de Express. 
// Permite agrupar rutas de forma aislada y exportarlas como un mini-módulo de la app principal.
const router =
  express.Router();

// =========================================================================
// VENTA DESDE PEDIDO (DESCUENTO AUTOMÁTICO)
// =========================================================================
/**
 * RUTA: POST /pedido/:idPedido
 * PROPÓSITO: Descuenta de forma automática las existencias del inventario cuando se procesa un pedido.
 * * NOTA DE ARQUITECTURA: 
 * - Usa el método HTTP POST porque genera un impacto/cambio colateral en el estado del servidor (modifica stock).
 * - El segmento ':idPedido' es un parámetro de ruta dinámico (URL Param). Express lo capturará 
 * y se lo entregará al controlador dentro del objeto 'req.params.idPedido'.
 * Ejemplo de llamada real: POST https://aromagranosystem.onrender.com/api/inventario/pedido/45
 */
router.post(
  "/pedido/:idPedido",
  descontarInventarioPedido
);

// =========================================================================
// AJUSTE MANUAL INVENTARIO (KARDEX MANUAL)
// =========================================================================
/**
 * RUTA: POST /movimiento
 * PROPÓSITO: Registra una entrada o un ajuste manual en el stock desde el módulo de administración.
 * * NOTA DE ARQUITECTURA:
 * - Usa el método HTTP POST ya que está "insertando" un nuevo registro histórico en la tabla 
 * de movimientos y "actualizando" el stock del producto.
 * - Los datos de control (id_producto, stock_nuevo, observacion, etc.) no viajan en la URL, 
 * sino encapsulados de forma segura dentro del cuerpo de la petición (req.body) en formato JSON.
 * Ejemplo de llamada real: POST https://aromagranosystem.onrender.com/api/inventario/movimiento
 */
router.post(
  "/movimiento",
  registrarMovimientoInventario
);

// Exportación por defecto del enrutador configurado.
// Permite que el archivo principal del servidor (server.js o app.js) lo importe y lo monte
// bajo un prefijo común, por ejemplo: app.use("/api/inventario", inventarioRoutes);
export default router;