import express from "express";
import cors from "cors";
import usersRoutes from "./routes/users.routes.js";
import inventarioRoutes from "./routes/inventario.routes.js";
// 1. Importa las rutas de pedidos
import pedidosRoutes from "./routes/pedidos.routes.js"; 

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/users", usersRoutes);
app.use("/api/inventario", inventarioRoutes);
// 2. Usa las rutas de pedidos
app.use("/api/pedidos", pedidosRoutes); 

export default app;