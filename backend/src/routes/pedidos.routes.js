import express from "express";
import { 
  crearPedido,
  obtenerPedidoMesa,
  eliminarPedido,
  cerrarPedido,
  agregarProductoPedido, 
  actualizarCantidadDetalle, 
  eliminarDetalle 
} from "../controllers/pedidos.controller.js";

const router = express.Router();

// CRUD Pedido
router.post("/", crearPedido);
router.get("/mesa/:idMesa", obtenerPedidoMesa);
router.delete("/:idPedido", eliminarPedido);
router.post("/:idPedido/cerrar", cerrarPedido);

// CRUD Detalles
router.post("/:idPedido/agregar", agregarProductoPedido);
router.put("/:idPedido/detalle/:idDetalle", actualizarCantidadDetalle);
router.delete("/:idPedido/detalle/:idDetalle", eliminarDetalle);

export default router;