import express from "express";

import {
  descontarInventarioPedido,
  registrarMovimientoInventario
}
from "../controllers/inventario.controller.js";

const router =
  express.Router();

// =========================
// VENTA DESDE PEDIDO
// =========================

router.post(
  "/pedido/:idPedido",
  descontarInventarioPedido
);

// =========================
// AJUSTE MANUAL INVENTARIO
// =========================

router.post(
  "/movimiento",
  registrarMovimientoInventario
);

export default router;