import express from "express";
import { 
  getConfiguracionHappyHour, 
  actualizarConfiguracionHappyHour, 
  verificarActivacionHappyHour,
  obtenerVentasSemanales
} from "../controllers/happy_hour.controller.js";

const router = express.Router();

router.get("/config", getConfiguracionHappyHour);
router.put("/config/:id", actualizarConfiguracionHappyHour);

router.post("/verificar-activacion", verificarActivacionHappyHour);
router.get("/ventas-semanales", obtenerVentasSemanales);

export default router;
