// Importación del framework Express, la herramienta base para la creación de servidores HTTP en Node.js.
import express from "express";

// Importación del middleware CORS (Cross-Origin Resource Sharing).
// Es indispensable para permitir que tu frontend (ej. Vue/Vite o React) se comunique con este backend
// desde un dominio o puerto diferente (ej. de localhost:5173 a localhost:3000) sin ser bloqueado por el navegador.
import cors from "cors";

// Importación de los módulos de enrutamiento personalizados para cada entidad de la aplicación.
import usersRoutes from "./routes/users.routes.js";
import inventarioRoutes from "./routes/inventario.routes.js";

// 1. Importa las rutas de pedidos
// Trae la configuración de los endpoints encargados de gestionar las líneas de detalle de las comandas.
import pedidosRoutes from "./routes/pedidos.routes.js"; 
import productosRoutes from "./routes/productos.routes.js";
import mesasRoutes from "./routes/mesas.routes.js";
import madiRoutes from "./routes/madi.routes.js";
import happyHourRoutes from "./routes/happy_hour.routes.js";
import { verifyToken } from "./middlewares/auth.middleware.js";

// Inicialización de la aplicación Express. 
// 'app' contiene todos los métodos necesarios para levantar rutas, escuchar puertos y configurar middlewares.
const app = express();

// =========================================================================
// CONFIGURACIÓN DE MIDDLEWARES GLOBALES
// =========================================================================

// Activa las políticas CORS globalmente con configuraciones por defecto (permite accesos de cualquier origen).
app.use(cors());

// Middleware nativo de Express para el parseo de cuerpos de peticiones.
// Analiza automáticamente las solicitudes entrantes con cargas útiles JSON y las transforma
// en un objeto JavaScript accesible directamente a través de 'req.body' en tus controladores.
app.use(express.json());

// =========================================================================
// ENRUTAMIENTO Y ASIGNACIÓN DE RUTAS RAÍZ (API PREFIXES)
// =========================================================================

// Acopla el módulo de usuarios bajo el prefijo "/api/users".
// Se añade verifyToken para proteger este y todos los módulos.
app.use("/api/users", verifyToken, usersRoutes);

// Acopla el módulo de inventarios y movimientos de Kardex bajo el prefijo "/api/inventario".
app.use("/api/inventario", verifyToken, inventarioRoutes);

// 2. Usa las rutas de pedidos
app.use("/api/pedidos", verifyToken, pedidosRoutes); 
app.use("/api/productos", verifyToken, productosRoutes);
app.use("/api/mesas", verifyToken, mesasRoutes);
app.use("/api/madi", verifyToken, madiRoutes);
app.use("/api/happy-hour", verifyToken, happyHourRoutes);

// Exportación por defecto de la instancia de la aplicación configurada.
// Siguiendo el principio de separación de conceptos, este archivo solo CONFIGURA la app,
// dejando la responsabilidad de LEVANTAR el puerto (app.listen) a otro archivo raíz (como index.js o server.js).
export default app;