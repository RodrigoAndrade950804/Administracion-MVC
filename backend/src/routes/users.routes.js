import express from "express";

import { crearUsuario, actualizarUsuario, obtenerUsuarios, toggleUsuario, eliminarUsuario }
from "../controllers/users.controller.js";

const router =
  express.Router();

router.get(
  "/",
  obtenerUsuarios
);

router.post(
  "/",
  crearUsuario
);

router.put(
  "/:id",
  actualizarUsuario
);


router.patch(
  "/:id/status",
  toggleUsuario
);

router.delete(
  "/:id",
  eliminarUsuario
);

export default router;