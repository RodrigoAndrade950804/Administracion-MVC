import express from "express";
import { 
  getConfiguracionHappyHour, 
  actualizarConfiguracionHappyHour, 
  verificarActivacionHappyHour,
  obtenerVentasSemanales
} from "../controllers/happy_hour.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/config", getConfiguracionHappyHour); // Público (para Login Theme)
router.put("/config/:id", verifyToken, actualizarConfiguracionHappyHour);

router.post("/verificar-activacion", verifyToken, verificarActivacionHappyHour);
router.get("/ventas-semanales", verifyToken, obtenerVentasSemanales);

export default router;
