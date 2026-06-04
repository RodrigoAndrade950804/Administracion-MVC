// backend/src/routes/pedidos.routes.js
// Importación del framework Express para gestionar el sistema de rutas del servidor HTTP.
import express from "express";

// Importación por desestructuración de los métodos del controlador de pedidos.
// Cada función contiene la validación de inventario y las reglas de negocio asociadas.
import { 
  agregarProductoPedido, 
  actualizarCantidadDetalle, 
  eliminarDetalle 
} from "../controllers/pedidos.controller.js";

// Inicialización del objeto Router de Express.
// Funciona como un enrutador aislado que encapsula las rutas específicas de la sección de pedidos.
const router = express.Router();

// =========================================================================
// RUTA 1: AGREGAR PRODUCTO AL PEDIDO (CREACIÓN DE DETALLE)
// =========================================================================
/**
 * RUTA: POST /:idPedido/agregar
 * PROPÓSITO: Añade un nuevo ítem (café, postre, etc.) a un pedido existente en una mesa.
 * EXPLICACIÓN TÉCNICA:
 * - Método POST: Se utiliza porque estamos insertando una nueva fila en la tabla 'detalle_pedidos'.
 * - Parámetro ':idPedido': Segmento dinámico en la URL que identifica qué comanda se va a modificar.
 * Ejemplo de uso real: POST https://aromagranosystem.onrender.com/api/pedidos/102/agregar
 */
router.post("/:idPedido/agregar", agregarProductoPedido);

// =========================================================================
// RUTA 2: ACTUALIZAR CANTIDAD DE UN ÍTEM (MODIFICACIÓN DE DETALLE)
// =========================================================================
/**
 * RUTA: PUT /:idPedido/detalle/:idDetalle
 * PROPÓSITO: Incrementa o decrementa las unidades pedidas de un producto en específico.
 * EXPLICACIÓN TÉCNICA:
 * - Método PUT: Se utiliza bajo la semántica REST para actualizar de forma integral un recurso existente.
 * - Doble parámetro dinámico:
 * 1. ':idPedido' -> Para identificar la comanda principal y poder recalcular los totales de dinero.
 * 2. ':idDetalle' -> Para saber exactamente qué fila de la base de datos se debe modificar.
 * Ejemplo de uso real: PUT https://aromagranosystem.onrender.com/api/pedidos/102/detalle/405
 */
router.put("/:idPedido/detalle/:idDetalle", actualizarCantidadDetalle);

// =========================================================================
// RUTA 3: ELIMINAR UN ÍTEM DEL PEDIDO (BORRADO DE DETALLE)
// =========================================================================
/**
 * RUTA: DELETE /:idPedido/detalle/:idDetalle
 * PROPÓSITO: Elimina por completo un producto de la comanda de la mesa.
 * EXPLICACIÓN TÉCNICA:
 * - Método DELETE: Indica explícitamente una acción de remoción física de un recurso.
 * - Doble parámetro dinámico: Recibe el ID de la orden principal y el ID de la línea de detalle a remover.
 * - NOTA EXTRA DE OPERACIÓN: Recuerda que este endpoint ejecuta una lógica especial; si borras el último 
 * producto del carrito, el backend destruirá automáticamente el pedido vacío y liberará la mesa asignada.
 * Ejemplo de uso real: DELETE https://aromagranosystem.onrender.com/api/pedidos/102/detalle/405
 */
router.delete("/:idPedido/detalle/:idDetalle", eliminarDetalle);

// Exportación del módulo para que pueda ser montado en el servidor principal (ej. server.js)
// Normalmente se expone bajo un prefijo de API global como: app.use("/api/pedidos", pedidosRoutes);
export default router;