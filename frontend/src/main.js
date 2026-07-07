// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                    AROMA & GRANO — SISTEMA DE GESTIÓN                       ║
// ║                  Archivo: main.js (Punto de Entrada)                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  PROPÓSITO DE ESTE ARCHIVO                                                  │
// │  ─────────────────────────────────────────────────────────────────────────── │
// │  Este es el "punto de entrada" (entry point) de toda la aplicación Vue 3.   │
// │  Aquí se ejecuta la secuencia de arranque (bootstrap) que:                  │
// │                                                                             │
// │    1. Crea la instancia raíz de Vue con createApp()                         │
// │    2. Registra los plugins globales (Router + Pinia)                        │
// │    3. Restaura la sesión del usuario desde localStorage                     │
// │    4. Inicia la escucha en tiempo real (Realtime) para seguridad            │
// │    5. Monta la aplicación en el DOM del navegador                           │
// │                                                                             │
// │  CONCEPTOS CLAVE DE VUE 3:                                                  │
// │  • createApp(Component): Crea una instancia de aplicación Vue. Recibe el    │
// │    componente raíz (App.vue) que será el contenedor de TODA la UI.          │
// │  • app.use(plugin): Instala un plugin en la aplicación. Los plugins son     │
// │    extensiones que añaden funcionalidad global (enrutamiento, estado, etc.). │
// │  • app.mount(selector): Inyecta la aplicación en un elemento del DOM HTML.  │
// │    A partir de este punto, Vue toma el control del renderizado.             │
// └─────────────────────────────────────────────────────────────────────────────┘

// =========================================================================
// IMPORTACIONES PRINCIPALES
// =========================================================================

/**
 * createApp — Función fábrica de Vue 3 que instancia la aplicación.
 * 
 * CONCEPTO VUE 3: En Vue 2 se usaba `new Vue({})`. En Vue 3 se migró a una
 * función factory `createApp()` para permitir múltiples instancias de Vue
 * en la misma página sin que compartan configuración global (aislamiento).
 */
import { createApp } from "vue";

/**
 * App.vue — Componente raíz de la aplicación.
 * 
 * CONCEPTO SFC (Single File Component): En Vue, cada archivo .vue contiene
 * tres secciones: <template> (HTML), <script> (lógica JS), <style> (CSS).
 * App.vue es el "contenedor maestro" donde se renderiza <router-view />.
 */
import App from "./App.vue";

/**
 * Importación de estilos globales CSS.
 * 
 * CONCEPTO VITE: Cuando importamos un archivo .css directamente en JS,
 * Vite lo procesa automáticamente y lo inyecta como un <style> en el <head>
 * del documento HTML. Esto aplica los estilos de forma global a toda la app.
 */
import "./style.css"; // Importa los estilos globales (usualmente configurados con Tailwind CSS)

/**
 * Router — Sistema de navegación SPA (Single Page Application).
 * 
 * CONCEPTO VUE ROUTER: Permite navegar entre "páginas" (componentes) sin
 * recargar el navegador. Intercepta los cambios de URL y renderiza el
 * componente correspondiente dentro de <router-view />.
 */
import router from "./router";

/**
 * createPinia — Función factory para crear la instancia del store global.
 * 
 * CONCEPTO PINIA: Pinia es el sucesor oficial de Vuex para Vue 3.
 * Proporciona un sistema de "stores" (almacenes) donde se guardan datos
 * que necesitan ser compartidos entre múltiples componentes de la aplicación.
 * 
 * Ventajas de Pinia sobre Vuex:
 * - Tipado TypeScript nativo sin configuración extra
 * - No necesita mutations (solo state + actions)
 * - Soporta Composition API y Options API
 * - Modular por diseño (cada store es independiente)
 * - DevTools integradas para depuración
 */
import { createPinia } from "pinia";

/**
 * useAuthStore — Store de autenticación definido con Pinia.
 * 
 * CONVENCIÓN PINIA: Todos los stores comienzan con "use" y terminan con "Store"
 * (ej: useAuthStore, useCartStore). Esto sigue el patrón de "composables"
 * de Vue 3 donde las funciones reutilizables empiezan con "use".
 */
import { useAuthStore } from "./stores/authStore";

// =========================================================================
// 1. CREACIÓN DE LA INSTANCIA DE VUE
// =========================================================================
/**
 * Se crea la instancia principal de la aplicación utilizando el componente raíz 'App.vue'.
 * Todo el contenido visual de la app se renderizará dentro de este componente.
 * 
 * PATRÓN DE DISEÑO — Factory Pattern:
 * createApp() es una función fábrica que encapsula la complejidad de crear
 * una instancia Vue configurada correctamente. Retorna un objeto "app"
 * con métodos para registrar plugins (.use), componentes (.component),
 * directivas (.directive) y finalmente montar (.mount).
 */
const app = createApp(App);

// =========================================================================
// 2. INICIALIZACIÓN DE PINIA (Estado Global)
// =========================================================================
/**
 * Pinia es el estándar moderno en Vue para manejar el estado global (variables que se 
 * comparten entre múltiples pantallas, como los datos del usuario o el carrito).
 * 
 * ANALOGÍA: Piensa en Pinia como un "pizarrón central" del restaurante.
 * Cualquier mesero (componente) puede leer o escribir en él, y todos ven
 * los cambios al instante. Sin Pinia, cada componente tendría su propia
 * copia de los datos y se desincronizarían fácilmente.
 * 
 * CONCEPTO — Inyección de Dependencias (Dependency Injection):
 * Al crear la instancia con createPinia(), se prepara un contenedor de
 * inyección de dependencias. Cuando un componente llame a useAuthStore(),
 * Pinia le proporcionará automáticamente la misma instancia del store
 * sin necesidad de importaciones circulares o variables globales.
 */
const pinia = createPinia();

// =========================================================================
// 3. REGISTRO DE PLUGINS EN LA APLICACIÓN
// =========================================================================
/**
 * Conectamos el enrutador (para la navegación entre URLs) y Pinia a la aplicación.
 * 
 * ORDEN IMPORTANTE:
 * - El Router puede registrarse en cualquier orden con Pinia.
 * - PERO: Pinia DEBE registrarse ANTES de intentar usar cualquier store.
 *   Si llamáramos a useAuthStore() antes de app.use(pinia), obtendríamos
 *   el error: "getActivePinia was called with no active Pinia".
 * 
 * CONCEPTO — Plugin System de Vue:
 * app.use(plugin) llama internamente al método install() del plugin,
 * que registra funcionalidades globales disponibles para todos los componentes:
 * - Router registra: <router-view>, <router-link>, useRouter(), useRoute()
 * - Pinia registra: la capacidad de crear y acceder stores con defineStore()
 */
app.use(router);
app.use(pinia);

// =========================================================================
// 4. CARGA DE SESIÓN DESDE ALMACENAMIENTO LOCAL
// =========================================================================
/**
 * Instanciamos el store de autenticación. 
 * 
 * CONCEPTO — Composable Pattern:
 * useAuthStore() es un "composable" — una función que encapsula lógica
 * reactiva reutilizable. Al llamarla, Pinia busca si ya existe una instancia
 * del store "auth". Si existe, retorna la misma (Singleton). Si no, la crea.
 * 
 * NOTA CRÍTICA: Solo se puede llamar a useAuthStore() DESPUÉS de haber
 * ejecutado app.use(pinia), porque la función necesita acceder a la
 * instancia de Pinia registrada en el contexto de la aplicación.
 */
const authStore = useAuthStore();

/**
 * Restauramos la sesión desde el localStorage del navegador.
 * 
 * CONCEPTO — Persistencia de Estado:
 * localStorage es una API del navegador que almacena datos como pares
 * clave-valor en formato string. Los datos persisten incluso después
 * de cerrar el navegador. Esto evita que el usuario tenga que volver
 * a iniciar sesión si presiona F5 o recarga la pestaña.
 * 
 * FLUJO DE RESTAURACIÓN:
 * 1. loadSession() busca la clave "auth" en localStorage
 * 2. Si existe, deserializa el JSON con JSON.parse()
 * 3. Restaura user, role e isAuthenticated en el store reactivo
 * 4. Si no existe, el usuario permanece como "no autenticado"
 */
authStore.loadSession();

// =========================================================================
// 5. ESCUCHA EN TIEMPO REAL — SEGURIDAD REACTIVA
// =========================================================================
/**
 * Verificamos si, tras cargar la sesión, existe un usuario activo.
 * Si hay sesión, activamos la escucha en tiempo real de Supabase.
 * 
 * CONCEPTO — Patrón Observer (Observador):
 * Supabase Realtime implementa el patrón Observer usando WebSockets.
 * La aplicación se "suscribe" a cambios en la base de datos y recibe
 * notificaciones push instantáneas cuando algo cambia, sin necesidad
 * de hacer polling (consultas periódicas).
 * 
 * CASO DE USO DE SEGURIDAD:
 * Si el administrador desactiva a este empleado desde el panel de control, 
 * este canal detectará el cambio en tiempo real y cerrará la sesión del 
 * empleado instantáneamente, incluso si no ha recargado la página.
 * 
 * ¿POR QUÉ SE VERIFICA AQUÍ Y NO EN App.vue?
 * Porque main.js se ejecuta UNA sola vez al arrancar. Si el usuario
 * ya tiene sesión guardada, necesitamos activar la vigilancia antes
 * de que cualquier componente se monte en pantalla.
 */
if (authStore.user) {
  // Si hay un usuario logueado, iniciamos inmediatamente un canal de "Realtime" (usualmente vía Supabase).
  // Esto sirve para que el sistema escuche cambios directos en el perfil de este usuario en la base de datos.
  // Ejemplo vital: Si el administrador desactiva a este empleado desde el panel de control, 
  // este canal detectará el cambio en tiempo real y cerrará la sesión del empleado instantáneamente, 
  // incluso si no ha recargado la página.
  authStore.iniciarRealtimeUsuario();
}

// =========================================================================
// 6. MONTAJE DE LA APLICACIÓN EN EL DOM
// =========================================================================
/**
 * Finalmente, tomamos toda esta configuración y la inyectamos en el elemento 
 * HTML que tenga el id "app" (generalmente ubicado en el archivo index.html de la carpeta public).
 * 
 * CONCEPTO — Virtual DOM y Montaje:
 * Vue 3 utiliza un Virtual DOM (representación en memoria del DOM real).
 * Al llamar a mount("#app"):
 * 1. Vue compila las plantillas de los componentes
 * 2. Crea el Virtual DOM inicial
 * 3. Lo compara con el DOM real (diffing)
 * 4. Inyecta los nodos necesarios en el elemento #app
 * 5. A partir de aquí, Vue maneja todas las actualizaciones del DOM
 *    de forma reactiva y eficiente (solo actualiza lo que cambió).
 * 
 * IMPORTANTE: mount() debe ser la ÚLTIMA instrucción de configuración.
 * Una vez montada, la app ya no puede registrar nuevos plugins globales.
 */
app.mount("#app");