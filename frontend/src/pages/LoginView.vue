<!--
  =====================================================================================
  ARCHIVO: LoginView.vue
  SISTEMA: Aroma & Grano – Plataforma Operativa & BI para Restaurantes
  =====================================================================================
  PROPÓSITO GENERAL:
    Este componente implementa la pantalla de inicio de sesión (Login) del sistema.
    Es el único punto de entrada para todos los empleados del restaurante
    (administradores, supervisores y meseros).

  FLUJO DE AUTENTICACIÓN COMPLETO (5 pasos):
    1. LOGIN SUPABASE (Auth)   → Valida email + contraseña contra Supabase Auth.
    2. OBTENER PERFIL Y ROL    → Cruza el UUID de Auth con la tabla 'users' vía API REST.
    3. VALIDAR ESTADO           → Verifica que el usuario no haya sido desactivado por RRHH.
    4. GUARDAR EN STORE (Pinia) → Almacena el perfil y el rol en el estado global.
    5. REDIRECCIÓN SEGÚN ROL    → Enruta al dashboard correspondiente (RBAC).

  PATRONES DE DISEÑO UTILIZADOS:
    - Patrón Fachada (Facade): La función `login()` orquesta los 5 pasos como una
      única operación, ocultando la complejidad de autenticación + perfil + validación.
    - Patrón Observador (Observer): `authStore.iniciarRealtimeUsuario()` suscribe
      a cambios en tiempo real sobre el estado del usuario (desactivación remota).
    - Control de Acceso Basado en Roles (RBAC): El switch final redirige según el rol.

  TECNOLOGÍAS:
    - Vue 3 Composition API (<script setup>)
    - Supabase Auth (signInWithPassword)
    - Pinia (authStore) – Estado global de autenticación
    - Vue Router – Navegación programática
    - Tailwind CSS – Estilos utilitarios
    - fetchWithAuth – Cliente HTTP con token JWT automático

  DEPENDENCIAS EXTERNAS:
    - Supabase Auth: Servicio de autenticación gestionado (no manejamos contraseñas).
    - API REST del backend: Endpoint `/api/users/perfil/:uuid` para datos de negocio.
  =====================================================================================
-->

<script setup>
// =====================================================================================
// SECCIÓN: IMPORTACIONES
// =====================================================================================

/**
 * @import {ref} from 'vue'
 * @description `ref` es la función fundamental de la reactividad en Vue 3.
 * Envuelve un valor primitivo (string, number, boolean) en un objeto reactivo.
 * Cuando el `.value` de un `ref` cambia, Vue automáticamente re-renderiza
 * cualquier parte del template que lo utilice.
 *
 * Analogía: Es como una celda de una hoja de cálculo — si cambias el valor,
 * todas las fórmulas que dependen de ella se recalculan automáticamente.
 */
import { ref } from "vue";

/**
 * @import {supabase} from '../services/supabase'
 * @description Cliente singleton de Supabase inicializado con la URL del proyecto
 * y la clave anónima (anon key). Este objeto nos da acceso a:
 *   - supabase.auth → Autenticación (login, signup, logout, sesiones)
 *   - supabase.from('tabla') → Consultas a la base de datos PostgreSQL
 *   - supabase.channel() → Suscripciones en tiempo real (WebSockets)
 *   - supabase.storage → Almacenamiento de archivos (imágenes de productos, etc.)
 *
 * SEGURIDAD: La anon key solo permite operaciones definidas por las Row Level
 * Security (RLS) policies en Supabase. No expone acceso total a la DB.
 */
import { supabase } from "../services/supabase";

/**
 * @import {useRouter} from 'vue-router'
 * @description Composable de Vue Router que proporciona el objeto `router`.
 * Permite navegar programáticamente entre rutas (páginas) sin necesidad
 * de que el usuario haga clic en un enlace `<router-link>`.
 *
 * Métodos principales:
 *   - router.push('/ruta') → Navega a una nueva ruta (agrega al historial).
 *   - router.replace('/ruta') → Navega sin agregar al historial.
 *   - router.back() → Regresa a la página anterior.
 */
import { useRouter } from "vue-router";

/**
 * @import {useAuthStore} from '../stores/authStore'
 * @description Store de Pinia que centraliza el estado de autenticación de toda
 * la aplicación. Pinia es el gestor de estado oficial de Vue 3 (reemplazo de Vuex).
 *
 * Este store contiene:
 *   - user: Datos del perfil del usuario logueado (nombre, email, estado).
 *   - role: Nombre del rol ('admin', 'supervisor', 'mesero').
 *   - setUser(): Guarda el usuario y su rol tras un login exitoso.
 *   - logout(): Limpia el estado y cierra sesión en Supabase Auth.
 *   - iniciarRealtimeUsuario(): Activa la escucha en tiempo real para
 *     detectar si el administrador desactiva al usuario mientras navega.
 *
 * PATRÓN: Store global (Singleton reactivo compartido entre componentes).
 */
import { useAuthStore } from "../stores/authStore";

/**
 * @import {fetchWithAuth} from '../api/apiClient'
 * @description Función wrapper alrededor de `fetch()` que automáticamente:
 *   1. Obtiene el token JWT de la sesión activa de Supabase Auth.
 *   2. Lo inyecta en el header `Authorization: Bearer <token>`.
 *   3. Realiza la petición HTTP al backend Express/Node.
 *
 * SEGURIDAD: Esto garantiza que TODAS las llamadas al backend están autenticadas.
 * El backend verifica el JWT antes de procesar cualquier request, implementando
 * así una capa de seguridad a nivel de API (middleware de autenticación).
 *
 * PATRÓN: Decorator/Wrapper – Extiende el comportamiento de fetch() nativo.
 */
import { fetchWithAuth } from "../api/apiClient";

// =====================================================================================
// SECCIÓN: INSTANCIAS DE HERRAMIENTAS GLOBALES
// =====================================================================================

/**
 * @constant {Router} router
 * @description Instancia del enrutador de Vue. Se usa para redirigir al usuario
 * tras el login exitoso al dashboard correspondiente según su rol.
 * Internamente, `useRouter()` accede a la instancia global de VueRouter
 * inyectada en `main.js` con `app.use(router)`.
 */
const router = useRouter();       // Para navegar programáticamente entre pantallas

/**
 * @constant {Store} authStore
 * @description Instancia del store de autenticación de Pinia.
 * Al ser un store de Pinia, es un objeto reactivo que se comparte entre
 * TODOS los componentes de la aplicación. Cualquier cambio aquí se refleja
 * automáticamente en NavBar, Guards de rutas, y otros componentes.
 */
const authStore = useAuthStore(); // Para acceder y modificar el estado global del usuario

// ==========================================
// ESTADOS REACTIVOS (Variables de la interfaz)
// ==========================================
// Utilizamos 'ref' para que cualquier cambio en estas variables se refleje
// inmediatamente en el HTML (por ejemplo, mostrando el loader o un texto de error).

/**
 * @type {Ref<string>} email
 * @description Almacena el correo electrónico ingresado por el usuario.
 * Vinculado bidireccionalmente al <input> mediante `v-model="email"`.
 * v-model es azúcar sintáctica (syntactic sugar) que combina:
 *   - :value="email" → Muestra el valor actual en el input
 *   - @input="email = $event.target.value" → Actualiza la ref al escribir
 */
const email = ref("");

/**
 * @type {Ref<string>} password
 * @description Almacena la contraseña ingresada por el usuario.
 * IMPORTANTE: Esta contraseña NUNCA se envía a nuestro backend.
 * Solo viaja directamente a Supabase Auth (servicio externo seguro)
 * a través de `signInWithPassword()`, que usa HTTPS/TLS.
 */
const password = ref("");

/**
 * @type {Ref<boolean>} loading
 * @description Flag que controla el estado visual del botón de login.
 * Cuando es `true`, se podría usar para:
 *   - Deshabilitar el botón (:disabled="loading")
 *   - Mostrar un spinner de carga
 *   - Prevenir doble-click accidental
 * Se activa al inicio del login y se desactiva en el bloque `finally`.
 */
const loading = ref(false);       // Controla el estado del botón (cargando...)

/**
 * @type {Ref<string>} errorMessage
 * @description Almacena mensajes de error para mostrar al usuario.
 * Se renderiza condicionalmente con `v-if="errorMessage"` en el template.
 * Posibles valores:
 *   - "": Sin error (el <p> no se muestra gracias a v-if).
 *   - Mensaje de Supabase Auth (credenciales inválidas).
 *   - "Error obteniendo el perfil del usuario." (fallo en API).
 *   - "Usuario inactivo. Contacte al administrador." (usuario desactivado).
 *   - "Error inesperado" (error catastrófico no manejado).
 */
const errorMessage = ref("");     // Almacena y muestra errores visuales al usuario

// ==========================================
// FLUJO PRINCIPAL DE AUTENTICACIÓN
// ==========================================

/**
 * @async
 * @function login
 * @description Función principal que orquesta todo el flujo de autenticación
 * del sistema Aroma & Grano. Implementa el **Patrón Fachada (Facade)**:
 * una sola función expone una operación simple al template (`@click="login"`),
 * pero internamente coordina 5 pasos complejos:
 *
 *   1. LOGIN SUPABASE → Validación de credenciales.
 *   2. OBTENER PERFIL  → Consulta a la API para datos de negocio.
 *   3. VALIDAR ESTADO  → Verificación de cuenta activa.
 *   4. GUARDAR STORE   → Persistencia en Pinia + activación de Realtime.
 *   5. REDIRIGIR       → Navegación basada en RBAC.
 *
 * MANEJO DE ERRORES:
 *   - Cada paso valida su resultado antes de continuar (fail-fast).
 *   - El bloque `catch` captura errores inesperados (red, servidor caído).
 *   - El bloque `finally` garantiza que el botón se desbloquee siempre.
 *
 * SEGURIDAD:
 *   - Las contraseñas las valida Supabase Auth (nunca nuestro código).
 *   - Si el usuario fue desactivado por RRHH, se destruye la sesión inmediatamente.
 *   - Tras guardar en el store, se activa la escucha Realtime para expulsión remota.
 *
 * @returns {Promise<void>} No retorna valor; navega o muestra error.
 */
const login = async () => {
  try {
    // 0. Preparación: Bloqueamos el botón y limpiamos errores previos
    loading.value = true;
    errorMessage.value = "";

    // =========================
    // 1. LOGIN SUPABASE (Auth)
    // =========================
    // Delegamos la validación del email y la contraseña al microservicio de
    // autenticación nativo de Supabase. Esto es súper seguro porque nunca
    // manejamos ni comparamos contraseñas manualmente.
    //
    // ¿Qué devuelve signInWithPassword()?
    //   - data.user → Objeto con id (UUID), email, metadata, etc.
    //   - data.session → Objeto con access_token (JWT), refresh_token, expires_at.
    //   - error → Objeto de error si las credenciales son incorrectas o hay fallo de red.
    //
    // PATRÓN: Delegación de responsabilidad – La autenticación se delega
    // completamente a un servicio especializado (Supabase Auth), siguiendo
    // el principio de responsabilidad única (SRP).
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    });

    // Si las credenciales son incorrectas, detenemos la ejecución y mostramos el error.
    if (error) {
      errorMessage.value = error.message;
      return;
    }

    // Extraemos el Identificador Único Universal (UUID) que Supabase Auth le asignó.
    // Este UUID es la "llave maestra" que conecta el sistema de Auth con nuestras
    // tablas de negocio (users, pedidos, etc.) en la base de datos PostgreSQL.
    const userId = data.user.id;

    // =========================
    // 2. OBTENER PERFIL Y ROL (Base de Datos a través de API)
    // =========================
    // Supabase Auth solo maneja el "acceso". Ahora cruzamos ese UUID con nuestra
    // tabla pública 'users' para obtener los datos de negocio (nombre, estado, rol).
    //
    // ¿Por qué usamos fetchWithAuth en vez de supabase.from('users')?
    //   - Porque la lógica de negocio (joins con la tabla 'roles', validaciones
    //     adicionales) está centralizada en el backend Express/Node.
    //   - El backend actúa como una capa de abstracción (patrón Fachada) que
    //     nos devuelve un objeto ya procesado con los datos que necesitamos.
    //
    // VARIABLE DE ENTORNO: `import.meta.env.VITE_API_URL` contiene la URL base
    // del servidor backend (ej: "http://localhost:3000" en desarrollo).
    // Vite expone solo variables que empiezan con VITE_ por seguridad.
    const apiResponse = await fetchWithAuth(`${import.meta.env.VITE_API_URL}/api/users/perfil/${userId}`);
    
    if (!apiResponse.ok) {
      errorMessage.value = "Error obteniendo el perfil del usuario.";
      return;
    }

    // Parseamos el cuerpo de la respuesta HTTP de JSON a un objeto JavaScript.
    // Estructura esperada de userData:
    //   {
    //     id_user: 1,
    //     auth_uid: "uuid-xxx",
    //     first_name: "Juan",
    //     last_name: "Pérez",
    //     active: true,
    //     roles: { role_name: "admin" }
    //   }
    const userData = await apiResponse.json();

    // =========================
    // 3. VALIDAR ESTADO (Seguridad)
    // =========================
    // Control interno de RRHH: Si el administrador marcó a este usuario como inactivo,
    // destruimos inmediatamente la sesión que Supabase Auth acaba de crear y lo bloqueamos.
    //
    // IMPORTANCIA DE SEGURIDAD: Sin esta validación, un empleado despedido podría
    // seguir accediendo al sistema con sus credenciales hasta que se elimine su
    // cuenta de Supabase Auth. Con este control, basta con marcarlo como `active=false`
    // en la tabla 'users' para bloquear el acceso instantáneamente.
    if (!userData.active) {
      await supabase.auth.signOut();
      errorMessage.value = "Usuario inactivo. Contacte al administrador.";
      return;
    }

    // =========================
    // 4. GUARDAR EN STORE Y ACTIVAR SEGURIDAD
    // =========================
    // El usuario es válido y está activo. Guardamos su perfil y su nombre de rol
    // (ej. "admin") en Pinia para que toda la aplicación sepa quién está navegando.
    //
    // ¿Por qué Pinia y no localStorage directamente?
    //   - Pinia es REACTIVO: Cualquier componente que lea authStore.user se
    //     actualiza automáticamente cuando cambia el valor.
    //   - Pinia es CENTRALIZADO: Un solo punto de verdad (Single Source of Truth).
    //   - Pinia soporta DEVTOOLS: Se pueden inspeccionar los stores en Vue DevTools.
    //   - El store puede además persistir en localStorage si se configura un plugin.
    authStore.setUser(
      userData,
      userData.roles.role_name
    );

    // Activamos la escucha en tiempo real. A partir de este momento, si un admin
    // lo desactiva en la base de datos, el sistema lo expulsará automáticamente.
    //
    // PATRÓN OBSERVADOR (Observer): El cliente se "suscribe" a cambios en la
    // tabla 'users' filtrados por su propio UUID. Cuando Supabase detecta un
    // UPDATE en esa fila (ej: active=false), envía una notificación por WebSocket,
    // y el store ejecuta el logout automáticamente.
    authStore.iniciarRealtimeUsuario();

    // =========================
    // 5. REDIRECCIÓN SEGÚN ROL (RBAC)
    // =========================
    // Actuamos como un "semáforo", enviando a cada empleado a su área de trabajo
    // correspondiente según el rol extraído de la base de datos.
    //
    // RBAC (Role-Based Access Control): Modelo de control de acceso donde los
    // permisos se asignan a roles, y los roles se asignan a usuarios.
    //   - "admin"      → /admin      → Dashboard BI completo con gestión total.
    //   - "supervisor"  → /supervisor → Vista intermedia de supervisión.
    //   - "mesero"      → /mesero     → Vista operativa para tomar pedidos.
    //
    // NOTA: Las rutas también están protegidas por Navigation Guards en el router,
    // así que aunque alguien modifique la URL manualmente, será redirigido si no
    // tiene el rol correcto. Esta redirección es solo para la experiencia de usuario.
    switch (userData.roles.role_name) {
      case "admin":
        router.push("/admin");
        break;
      case "supervisor":
        router.push("/supervisor");
        break;
      case "mesero":
        router.push("/mesero");
        break;
      default:
        // Si por error de DB el rol es desconocido, lo devolvemos al inicio
        router.push("/");
    }
  } catch (error) {
    // Captura errores catastróficos (ej. caída de internet a mitad del proceso)
    console.error(error);
    errorMessage.value = "Error inesperado";
  } finally {
    // Independientemente del resultado (éxito o fallo), desbloqueamos el botón de login
    // El bloque `finally` SIEMPRE se ejecuta, garantizando que el UI no quede bloqueado.
    loading.value = false;
  }
};
</script>

<!-- ===================================================================================
     SECCIÓN: TEMPLATE (Interfaz de Usuario)
     ===================================================================================
     Esta sección define la estructura visual de la pantalla de Login.
     Utiliza Tailwind CSS para el diseño, con un estilo "Glassmorphism"
     (cristal esmerilado) que combina:
       - backdrop-blur-xl: Desenfoque del fondo visible a través del panel.
       - bg-white/10: Fondo blanco con 10% de opacidad.
       - border-white/20: Borde semi-transparente que simula reflejo de luz.

     RESPONSIVE: El diseño está centrado con `flex items-center justify-center`
     y el panel tiene ancho fijo de 400px (`w-[400px]`).
     =================================================================================== -->
<template>

  <!-- ========= SECCIÓN: CONTENEDOR PRINCIPAL CON FONDO ========= -->
  <!--
    Este <div> ocupa toda la pantalla (min-h-screen) y centra su contenido.
    El fondo combina dos capas usando CSS:
      1. linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)): Overlay oscuro
         que mejora la legibilidad del texto sobre la imagen.
      2. url('...unsplash...'): Imagen de café de Unsplash como fondo decorativo.
    Tailwind: bg-cover (la imagen cubre todo) + bg-center (centrada).
  -->
  <div
    class="min-h-screen bg-cover bg-center flex items-center justify-center"
    style="
      background-image:
      linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)),
      url('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085');
    "
  >

    <!-- ========= SECCIÓN: PANEL DE LOGIN (Glassmorphism) ========= -->
    <!--
      Contenedor del formulario con efecto cristal esmerilado (Glassmorphism):
        - w-[400px]: Ancho fijo personalizado de Tailwind (valor arbitrario).
        - backdrop-blur-xl: Desenfoque fuerte del fondo que se ve a través.
        - bg-white/10: Fondo blanco con 10% opacidad → efecto translúcido.
        - border border-white/20: Borde sutil que simula brillo/reflejo.
        - rounded-3xl: Bordes redondeados extra grandes (24px de radio).
        - shadow-2xl: Sombra profunda para dar sensación de elevación (depth).
    -->
    <div
      class="w-[400px] backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-10 shadow-2xl"
    >

      <!-- ========= SECCIÓN: ENCABEZADO / BRANDING ========= -->
      <!--
        Área de identidad visual del restaurante.
        - text-center: Centra el texto horizontalmente.
        - mb-8: Margen inferior de 2rem (32px) para separar del formulario.
      -->
      <div class="text-center mb-8">
        <!-- Nombre del restaurante como título principal (<h1> para SEO) -->
        <h1 class="text-4xl font-bold text-white mb-2">
          Aroma & Grano
        </h1>

        <!-- Subtítulo descriptivo del sistema -->
        <p class="text-gray-300 text-sm">
          Plataforma Operativa & BI
        </p>
      </div>

      <!-- ========= SECCIÓN: FORMULARIO DE LOGIN ========= -->
      <!--
        Contenedor del formulario con espaciado vertical automático.
        - space-y-5: Agrega 1.25rem (20px) de margen vertical entre cada hijo directo.
        NOTA: No usamos un <form> HTML nativo para evitar el reload del navegador
        al presionar Enter. En su lugar, usamos @click en el botón.
      -->
      <div class="space-y-5">

        <!-- ========= CAMPO: CORREO ELECTRÓNICO ========= -->
        <!--
          v-model="email": Vinculación bidireccional (two-way binding) con la ref `email`.
            → Cuando el usuario escribe, `email.value` se actualiza automáticamente.
            → Si `email.value` cambia desde el script, el input refleja el nuevo valor.
          type="email": Activa validación nativa del navegador y teclado de email en móvil.
          Estilos Tailwind:
            - bg-white/10: Fondo semi-transparente consistente con el diseño glassmorphism.
            - outline-none: Elimina el borde azul por defecto del navegador al hacer focus.
        -->
        <input
          v-model="email"
          type="email"
          placeholder="Correo electrónico"
          class="w-full p-4 rounded-xl bg-white/10 border border-white/20 text-white outline-none"
        />

        <!-- ========= CAMPO: CONTRASEÑA ========= -->
        <!--
          v-model="password": Vinculación con la ref `password`.
          type="password": Oculta los caracteres con puntos/asteriscos por seguridad visual.
          SEGURIDAD: La contraseña solo se envía a Supabase Auth vía HTTPS, nunca a nuestro backend.
        -->
        <input
          v-model="password"
          type="password"
          placeholder="Contraseña"
          class="w-full p-4 rounded-xl bg-white/10 border border-white/20 text-white outline-none"
        />

        <!-- ========= BOTÓN: INICIAR SESIÓN ========= -->
        <!--
          @click="login": Directiva de evento de Vue. Al hacer clic, ejecuta la función `login()`.
            → Equivalente a: addEventListener('click', login)
            → Vue automáticamente pasa el evento DOM, pero aquí no lo necesitamos.
          Estilos Tailwind:
            - bg-amber-700: Color de fondo ámbar oscuro (acorde a la temática del café).
            - hover:bg-amber-600: Al pasar el mouse, se ilumina ligeramente.
            - transition: Suaviza el cambio de color hover con animación CSS.
        -->
        <button
          @click="login"
          class="w-full p-4 rounded-xl bg-amber-700 hover:bg-amber-600 transition text-white font-bold"
        >
          Iniciar Sesión
        </button>

        <!-- ========= SECCIÓN: MENSAJE DE ERROR CONDICIONAL ========= -->
        <!--
          v-if="errorMessage": Directiva condicional de Vue.
            → Si errorMessage.value es un string vacío (""), es falsy → el <p> NO se renderiza.
            → Si tiene contenido (ej: "Credenciales incorrectas"), es truthy → el <p> SÍ se muestra.
          IMPORTANTE: v-if remueve/agrega el elemento del DOM, a diferencia de v-show que
          solo lo oculta con `display: none`. Usamos v-if porque el error no se muestra
          la mayoría del tiempo, así que es más eficiente no tenerlo en el DOM.

          {{ errorMessage }}: Interpolación de texto de Vue (Mustache syntax).
          Muestra el contenido de la ref `errorMessage` como texto plano (escaped, seguro contra XSS).
        -->
        <p v-if="errorMessage" class="text-red-400 text-sm text-center">
          {{ errorMessage }}
        </p>

      </div>

      <!-- ========= SECCIÓN: INDICADOR DE SEGURIDAD SSL ========= -->
      <!--
        Indicador visual de confianza para el usuario.
        Muestra un candado (🔒) y texto que confirma que la conexión es segura.
        NOTA: Supabase Auth siempre usa HTTPS/TLS para transmitir credenciales.
      -->
      <div class="mt-6 text-center text-sm text-green-400">
        🔒 Conexión Segura SSL
      </div>
    </div>
  </div>
</template>