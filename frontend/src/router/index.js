// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                    AROMA & GRANO — SISTEMA DE GESTIÓN                       ║
// ║              Archivo: router/index.js (Configuración del Router)            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  PROPÓSITO DE ESTE ARCHIVO                                                  │
// │  ─────────────────────────────────────────────────────────────────────────── │
// │  Configura el sistema de navegación (routing) de la aplicación SPA.         │
// │  Define QUÉ componente se renderiza para cada URL y establece las           │
// │  reglas de seguridad (guards) que protegen las rutas según:                 │
// │                                                                             │
// │    1. Autenticación: ¿El usuario ha iniciado sesión?                        │
// │    2. Estado activo: ¿La cuenta del usuario está habilitada?                │
// │    3. Autorización por rol: ¿Tiene el rol adecuado para esa ruta?           │
// │                                                                             │
// │  CONCEPTOS CLAVE DE VUE ROUTER:                                             │
// │  • createRouter(): Función factory que crea la instancia del enrutador      │
// │  • createWebHistory(): Usa la API History del navegador (URLs limpias)      │
// │  • routes[]: Array de objetos que mapean paths a componentes                │
// │  • meta: Objeto de metadatos personalizados adjunto a cada ruta             │
// │  • beforeEach(): Navigation Guard global que se ejecuta antes de navegar    │
// │                                                                             │
// │  PATRÓN DE DISEÑO — Middleware Chain (Cadena de Middleware):                 │
// │  El guard beforeEach actúa como una cadena de verificaciones donde cada     │
// │  paso debe aprobar antes de permitir la navegación al destino.              │
// └─────────────────────────────────────────────────────────────────────────────┘

// =========================================================================
// IMPORTACIONES
// =========================================================================

/**
 * createRouter — Función factory que crea la instancia del enrutador de Vue.
 * 
 * CONCEPTO VUE ROUTER: Vue Router es la librería oficial de enrutamiento
 * para Vue.js. En una SPA (Single Page Application), no hay recarga real
 * de página. En su lugar, Vue Router intercepta los cambios de URL y
 * reemplaza el contenido del <router-view /> con el componente apropiado.
 * 
 * createWebHistory — Configura el modo de historial del navegador.
 * 
 * MODOS DE HISTORIAL DISPONIBLES:
 * ┌────────────────────────┬──────────────────────┬──────────────────────────┐
 * │ Modo                   │ URL de ejemplo        │ Requiere servidor        │
 * ├────────────────────────┼──────────────────────┼──────────────────────────┤
 * │ createWebHistory()     │ /admin                │ Sí (fallback a index)    │
 * │ createWebHashHistory() │ /#/admin              │ No                       │
 * │ createMemoryHistory()  │ (sin URL visible)     │ No (para SSR/tests)      │
 * └────────────────────────┴──────────────────────┴──────────────────────────┘
 * 
 * Aroma & Grano usa createWebHistory() para URLs profesionales y limpias
 * (sin el "#" del modo hash), lo cual es mejor para SEO y UX.
 */
import { createRouter, createWebHistory } from "vue-router";

// =========================================================================
// IMPORTACIÓN DE VISTAS (Componentes de Página)
// =========================================================================
// Cada "view" o "page" es un componente Vue que representa una pantalla
// completa de la aplicación. En la arquitectura MVC del frontend:
// - Estos componentes son las VISTAS (View)
// - Los stores de Pinia son los MODELOS (Model)
// - La lógica de interacción son los CONTROLADORES (Controller)

/**
 * LoginView — Página de inicio de sesión.
 * Accesible para todos (no requiere autenticación).
 * Es la ruta por defecto ("/") y el destino de redirección para usuarios no autorizados.
 */
import LoginView from "../pages/LoginView.vue";

/**
 * AdminDashboard — Panel de control del administrador.
 * Solo accesible para usuarios con rol "admin".
 * Permite gestionar usuarios, productos, inventario, y configuraciones del sistema.
 */
import AdminDashboard from "../pages/AdminDashboard.vue";

/**
 * SupervisorDashboard — Panel de supervisión de ventas y empleados.
 * Solo accesible para usuarios con rol "supervisor".
 * Permite ver métricas de ventas, rendimiento de meseros y reportes.
 */
import SupervisorDashboard from "../pages/SupervisorDashboard.vue";

/**
 * MeseroPOS — Punto de Venta (POS) para meseros.
 * Solo accesible para usuarios con rol "mesero".
 * Permite tomar pedidos, asignar mesas y gestionar cuentas de clientes.
 */
import MeseroPOS from "../pages/MeseroPOS.vue";

/**
 * useAuthStore — Store de autenticación de Pinia.
 * Se importa aquí para poder verificar el estado de sesión del usuario
 * dentro del navigation guard (beforeEach).
 */
import { useAuthStore } from "../stores/authStore";

// =========================================================================
// DEFINICIÓN DE RUTAS CON METADATOS (Meta Fields)
// =========================================================================
/**
 * CONCEPTO — Route Records (Registros de Ruta):
 * Cada objeto en el array 'routes' es un "Route Record" que define:
 * 
 * • path (string):     La URL que activa esta ruta (ej: "/admin")
 * • component:         El componente Vue que se renderiza en <router-view>
 * • meta (object):     Objeto de metadatos personalizados (opcional)
 * 
 * CONCEPTO — Meta Fields (Campos de Metadatos):
 * El objeto 'meta' es un espacio libre donde puedes adjuntar datos
 * personalizados a cada ruta. Vue Router NO usa estos datos internamente,
 * pero los pone disponibles dentro de los navigation guards y los
 * componentes a través de route.meta.
 * 
 * En Aroma & Grano usamos dos meta fields:
 * • requiresAuth (boolean): Indica si el usuario debe estar logueado
 * • role (string):           Indica qué rol puede acceder a esta ruta
 * 
 * EJEMPLO DE ACCESO:
 * router.beforeEach((to) => {
 *   console.log(to.meta.requiresAuth); // true o undefined
 *   console.log(to.meta.role);          // "admin", "supervisor", "mesero"
 * });
 */
const routes = [
  {
    // Ruta raíz — Página de Login (pública, sin restricciones)
    // No tiene meta.requiresAuth, por lo que el guard la dejará pasar siempre.
    path: "/",
    component: LoginView,
  },
  {
    // Panel de Administración — Solo para administradores
    // meta.requiresAuth: true  → Requiere sesión activa
    // meta.role: "admin"       → Solo usuarios con rol "admin" pueden acceder
    path: "/admin",
    component: AdminDashboard,
    meta: { requiresAuth: true, role: "admin" },
  },
  {
    // Panel de Supervisión — Solo para supervisores
    // Un supervisor que intente acceder a /admin será redirigido a "/"
    path: "/supervisor",
    component: SupervisorDashboard,
    meta: { requiresAuth: true, role: "supervisor" },
  },
  {
    // Punto de Venta (POS) — Solo para meseros
    // Un mesero que intente acceder a /admin o /supervisor será bloqueado
    path: "/mesero",
    component: MeseroPOS,
    meta: { requiresAuth: true, role: "mesero" },
  },
];

// =========================================================================
// CREACIÓN DE LA INSTANCIA DEL ROUTER
// =========================================================================
/**
 * Se crea el router con:
 * 
 * • history: createWebHistory() → Modo de historial HTML5.
 *   Usa la API pushState/replaceState del navegador para navegar
 *   sin recargar la página. Las URLs se ven limpias: /admin, /mesero.
 * 
 *   NOTA DE PRODUCCIÓN: Al usar createWebHistory(), el servidor web
 *   (Nginx, Apache, etc.) debe configurarse para devolver index.html
 *   para TODAS las rutas, ya que las URLs como "/admin" no corresponden
 *   a archivos reales en el servidor.
 * 
 * • routes: El array de registros de ruta definido arriba.
 */
const router = createRouter({
  history: createWebHistory(),
  routes,
});

// =========================================================================
// NAVIGATION GUARD GLOBAL — MIDDLEWARE DE SEGURIDAD
// =========================================================================
/**
 * CONCEPTO — Navigation Guards (Guardias de Navegación):
 * Son funciones que se ejecutan ANTES de que Vue Router complete una
 * navegación. Permiten aceptar, rechazar o redirigir la navegación.
 * 
 * TIPOS DE GUARDS:
 * ┌─────────────────────────┬────────────────────────────────────────────────┐
 * │ Tipo                    │ Descripción                                    │
 * ├─────────────────────────┼────────────────────────────────────────────────┤
 * │ Global (beforeEach)     │ Se ejecuta en TODAS las navegaciones ✅        │
 * │ Per-Route (beforeEnter) │ Se ejecuta solo para UNA ruta específica       │
 * │ In-Component            │ Se ejecuta dentro del componente destino       │
 * │  (onBeforeRouteLeave)   │                                               │
 * └─────────────────────────┴────────────────────────────────────────────────┘
 * 
 * PARÁMETROS DEL GUARD:
 * • to:   Objeto Route de la ruta DESTINO (a dónde quiere ir el usuario)
 * • from: Objeto Route de la ruta ORIGEN (de dónde viene el usuario)
 * 
 * VALORES DE RETORNO:
 * • true o undefined → Permite la navegación (continúa al destino)
 * • false           → Cancela la navegación (se queda donde está)
 * • "/" (string)    → Redirige a esa ruta
 * • { name: 'ruta' } → Redirige a una ruta nombrada
 * 
 * PATRÓN DE DISEÑO — Chain of Responsibility (Cadena de Responsabilidad):
 * Las tres verificaciones se ejecutan en secuencia. Si alguna falla,
 * la navegación se rechaza y el usuario es redirigido. Esto implementa
 * un sistema de autorización en capas:
 * 
 *   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
 *   │  ¿Está logueado? │───►│  ¿Está activo?   │───►│  ¿Tiene el rol?  │───► ✅ Acceso
 *   └──────────────────┘    └──────────────────┘    └──────────────────┘
 *          │ No                    │ No                    │ No
 *          ▼                      ▼                      ▼
 *        🚫 → "/"              🚫 → "/"              🚫 → "/"
 */
// Definición de rutas con metadatos (meta) para control de acceso.
router.beforeEach((to, from) => {
  /**
   * Accedemos al store de autenticación para leer el estado actual del usuario.
   * 
   * NOTA: Es seguro llamar a useAuthStore() aquí porque el guard se ejecuta
   * DESPUÉS de que main.js ha registrado Pinia con app.use(pinia).
   */
  const authStore = useAuthStore();

  // ─────────────────────────────────────────────────────────────────────
  // CAPA 1: Verificación de Autenticación
  // ─────────────────────────────────────────────────────────────────────
  // Si la ruta requiere sesión (meta.requiresAuth === true) y el usuario
  // NO está autenticado, se redirige inmediatamente al login ("/").
  // Ejemplo: Un visitante sin sesión intenta acceder a "/admin" → se va a "/"
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return "/";
  }

  // ─────────────────────────────────────────────────────────────────────
  // CAPA 2: Verificación de Usuario Activo
  // ─────────────────────────────────────────────────────────────────────
  // Verifica que el usuario no haya sido desactivado por un administrador.
  // El operador ?. (optional chaining) previene errores si user es null.
  // Ejemplo: Un admin desactivó a un mesero → cuando el mesero navega, se cierra su sesión
  if (authStore.user?.active === false) {
    authStore.logout();
    return "/";
  }

  // ─────────────────────────────────────────────────────────────────────
  // CAPA 3: Verificación de Rol (Autorización)
  // ─────────────────────────────────────────────────────────────────────
  // Compara el rol requerido por la ruta (meta.role) con el rol del usuario
  // almacenado en el store. Si no coinciden, se bloquea el acceso.
  // Ejemplo: Un mesero intenta acceder a "/admin" → su rol es "mesero", 
  //          la ruta requiere "admin" → no coinciden → redirigido a "/"
  if (to.meta.role && authStore.role !== to.meta.role) {
    return "/";
  }

  // ─────────────────────────────────────────────────────────────────────
  // ACCESO PERMITIDO
  // ─────────────────────────────────────────────────────────────────────
  // Si pasó las tres capas de verificación, retornamos true para permitir
  // la navegación. Vue Router renderizará el componente de destino.
  // Si pasa todas las validaciones, permite el acceso devolviendo undefined implícitamente
  return true;
});

// =========================================================================
// EXPORTACIÓN DEL ROUTER
// =========================================================================
/**
 * Se exporta la instancia configurada del router para que main.js
 * pueda registrarla con app.use(router).
 * 
 * CONCEPTO — Módulos ES6 (import/export):
 * 'export default' permite que otros archivos importen este módulo
 * sin necesidad de usar llaves:
 *   import router from './router'    ← export default
 *   import { router } from './router' ← export const (named export)
 */
export default router;