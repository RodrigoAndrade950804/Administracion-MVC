import express from "express";

import {
  descontarInventarioPedido
}
from "../controllers/inventario.controller.js";

const router =
  express.Router();

router.post(
  "/pedido/:idPedido",
  descontarInventarioPedido
);

export default router;