import express from "express";
import { getProductos, crearProducto, actualizarProducto, eliminarProducto } from "../controllers/productos.controller.js";

const router = express.Router();

router.get("/", getProductos);
router.post("/", crearProducto);
router.put("/:id", actualizarProducto);
router.delete("/:id", eliminarProducto);

export default router;
