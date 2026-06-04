// 1. IMPORTACIÓN MANDATORIA EN PRIMERA LÍNEA
// Importa el módulo que carga las variables de entorno (.env). 
// Es crítico que sea la primera instrucción de todo el proyecto para garantizar que 
// configuraciones como la URL de Supabase o las llaves secretas ya existan en 'process.env' 
// antes de que se inicialice cualquier otro servicio o archivo (como app.js).
import "./config/env.js";

// Importa la instancia de la aplicación Express previamente configurada con sus 
// middlewares globales (CORS, JSON) y todas las rutas del negocio (usuarios, pedidos, inventario).
import app from "./app.js";

// =========================================================================
// ASIGNACIÓN DEL PUERTO DE RED
// =========================================================================
/**
 * Define el puerto en el cual el servidor backend escuchará las peticiones entrantes.
 * Utiliza un operador lógico de cortocircuito (OR '||'):
 * - En producción (ej. Render, Heroku, AWS), leerá el puerto asignado dinámicamente por la plataforma (process.env.PORT).
 * - En entorno de desarrollo local, si la variable no está definida, por defecto levantará en el puerto 3000.
 */
const PORT =
  process.env.PORT || 3000;

// =========================================================================
// ARRANQUE OFICIAL DEL SERVIDOR HTTP
// =========================================================================
/**
 * Levanta formalmente el proceso del servidor y lo pone en modo "escucha" (Listen).
 * Recibe el puerto asignado y un callback (función anónima de retorno) que se ejecuta 
 * inmediatamente cuando el servidor se ha inicializado con éxito y sin colisiones de red.
 */
app.listen(PORT, () => {

  // Envía un mensaje informativo a la consola del terminal del desarrollador o a los logs del servidor.
  // Es la confirmación visual de que el backend de AromaGrano está operativo y listo para recibir peticiones REST.
  console.log(
    `Servidor ejecutándose en puerto ${PORT}`
  );

});