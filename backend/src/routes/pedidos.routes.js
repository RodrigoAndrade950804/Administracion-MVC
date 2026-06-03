// backend/src/routes/pedidos.routes.js
import express from "express";
import { 
  agregarProductoPedido, 
  actualizarCantidadDetalle, 
  eliminarDetalle 
} from "../controllers/pedidos.controller.js";

const router = express.Router();

router.post("/:idPedido/agregar", agregarProductoPedido);
router.put("/:idPedido/detalle/:idDetalle", actualizarCantidadDetalle);
router.delete("/:idPedido/detalle/:idDetalle", eliminarDetalle);

export default router;