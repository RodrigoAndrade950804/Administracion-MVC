import express from "express";
import { getMesas, updateMesaStatus } from "../controllers/mesas.controller.js";

const router = express.Router();

router.get("/", getMesas);
router.patch("/:idMesa/status", updateMesaStatus);

export default router;
