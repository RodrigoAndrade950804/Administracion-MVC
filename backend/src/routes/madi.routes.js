import express from "express";
import { 
  getConfiguracionMadi, 
  actualizarConfiguracionMadi, 
  getReglasBonos, 
  crearReglaBono, 
  actualizarReglaBono, 
  eliminarReglaBono, 
  verificarProgresoPersonal 
} from "../controllers/madi.controller.js";

const router = express.Router();

router.get("/config", getConfiguracionMadi);
router.put("/config/:id", actualizarConfiguracionMadi);

router.get("/reglas", getReglasBonos);
router.post("/reglas", crearReglaBono);
router.put("/reglas/:id", actualizarReglaBono);
router.delete("/reglas/:id", eliminarReglaBono);

router.get("/progreso/:idUser", verificarProgresoPersonal);

export default router;
