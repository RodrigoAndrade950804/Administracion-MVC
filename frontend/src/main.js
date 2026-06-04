import { createApp } from "vue";
import App from "./App.vue";
import "./style.css"; // Importa los estilos globales (usualmente configurados con Tailwind CSS)

import router from "./router";
import { createPinia } from "pinia";
import { useAuthStore } from "./stores/authStore";

// =========================
// 1. CREACIÓN DE LA INSTANCIA
// =========================
// Se crea la instancia principal de la aplicación utilizando el componente raíz 'App.vue'.
// Todo el contenido visual de la app se renderizará dentro de este componente.
const app = createApp(App);

// =========================
// 2. INICIALIZACIÓN DE PINIA
// =========================
// Pinia es el estándar moderno en Vue para manejar el estado global (variables que se 
// comparten entre múltiples pantallas, como los datos del usuario o el carrito).
const pinia = createPinia();

// =========================
// 3. REGISTRO DE PLUGINS
// =========================
// Conectamos el enrutador (para la navegación entre URLs) y Pinia a la aplicación.
// El orden es importante: la app debe conocer a Pinia antes de que intentemos usar un Store.
app.use(router);
app.use(pinia);

// =========================
// 4. CARGA DE SESIÓN
// =========================
// Instanciamos el store de autenticación. 
// Nota: Solo se puede llamar a useAuthStore() DESPUÉS de haber ejecutado app.use(pinia).
const authStore = useAuthStore();

// Restauramos la sesión desde el localStorage del navegador.
// Esto evita que el usuario tenga que volver a iniciar sesión si presiona F5 o recarga la pestaña.
authStore.loadSession();

// =========================
// 5. ESCUCHA EN TIEMPO REAL (Seguridad)
// =========================
// Verificamos si, tras cargar la sesión, existe un usuario activo.
if (authStore.user) {
  // Si hay un usuario logueado, iniciamos inmediatamente un canal de "Realtime" (usualmente vía Supabase).
  // Esto sirve para que el sistema escuche cambios directos en el perfil de este usuario en la base de datos.
  // Ejemplo vital: Si el administrador desactiva a este empleado desde el panel de control, 
  // este canal detectará el cambio en tiempo real y cerrará la sesión del empleado instantáneamente, 
  // incluso si no ha recargado la página.
  authStore.iniciarRealtimeUsuario();
}

// =========================
// 6. MONTAJE DE LA APLICACIÓN
// =========================
// Finalmente, tomamos toda esta configuración y la inyectamos en el elemento 
// HTML que tenga el id "app" (generalmente ubicado en el archivo index.html de la carpeta public).
app.mount("#app");