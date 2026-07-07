<!-- =========================================================================================
  ARCHIVO: UsuariosManager.vue
  UBICACIÓN: frontend/src/components/admin/UsuariosManager.vue
  SISTEMA: Aroma & Grano — Sistema de Gestión de Restaurante

  ========================================================================================
  PROPÓSITO GENERAL:
  ========================================================================================
  Componente Vue 3 de administración que implementa un CRUD completo (Create, Read,
  Update, Delete) para la entidad "Usuarios" del sistema. Este módulo permite al
  administrador:
    1. CREAR nuevos usuarios con rol, salario y credenciales de acceso.
    2. LISTAR todos los usuarios registrados en una tabla detallada.
    3. EDITAR la información de un usuario existente a través de un modal.
    4. ELIMINAR usuarios del sistema previa confirmación.
    5. ACTIVAR/DESACTIVAR usuarios sin eliminarlos (Soft Delete / Toggle).

  ========================================================================================
  PATRÓN ARQUITECTÓNICO — Facade (Fachada) a través de Servicios:
  ========================================================================================
  Este componente NO interactúa directamente con Supabase ni con la base de datos.
  En su lugar, delega TODAS las operaciones de datos a funciones importadas desde
  `usuariosService.js`. Esto aplica el patrón Facade:

    UsuariosManager.vue  →  usuariosService.js  →  Supabase Client  →  PostgreSQL

  Ventajas de este patrón:
    - El componente solo se ocupa de la lógica de presentación (UI).
    - Los detalles de conexión, autenticación y consultas SQL están encapsulados.
    - Si se cambia Supabase por otra API REST, solo se modifica el servicio.

  ========================================================================================
  REGLA DE NEGOCIO — Protección del rol Administrador:
  ========================================================================================
  Los usuarios con rol "admin" están protegidos contra:
    - Desactivación (el botón muestra "Protegido" y está deshabilitado).
    - Eliminación accidental (el template oculta los botones de acción).
  Esto garantiza que siempre exista al menos un administrador activo en el sistema.

  ========================================================================================
  MODELO DE DATOS — Estructura esperada de un objeto `usuario`:
  ========================================================================================
  {
    id_user: number,          // Identificador único (PK en la tabla users)
    email: string,            // Correo electrónico / credencial de login
    first_name: string,       // Nombre de pila
    last_name: string,        // Apellido
    base_salary: number,      // Salario base mensual (usado para cálculos de nómina)
    active: boolean,          // true = activo, false = desactivado (soft delete)
    id_role: number,          // FK hacia la tabla `roles` (1=Admin, 2=Supervisor, 3=Mesero)
    roles: {                  // Relación JOIN con la tabla `roles` (Supabase la resuelve)
      role_name: string       // Nombre legible del rol: 'admin', 'supervisor', 'mesero'
    }
  }

  ========================================================================================
  TECNOLOGÍAS UTILIZADAS:
  ========================================================================================
    - Vue 3 Composition API (<script setup>)
    - ref() para estado reactivo
    - onMounted() para carga inicial de datos
    - Tailwind CSS para estilos (glassmorphism con clase custom `glass-panel`)
    - Servicio Facade (`usuariosService.js`) para operaciones CRUD
========================================================================================= -->

<script setup>
// =========================================================================
// SECCIÓN: IMPORTACIONES
// =========================================================================
// `ref`       → Función de Vue 3 Reactivity API que crea una referencia reactiva.
//               Cualquier cambio en `.value` desencadena la re-renderización del DOM.
// `onMounted` → Lifecycle Hook de Vue 3 que se ejecuta UNA sola vez cuando el
//               componente ha sido insertado en el DOM. Ideal para cargas iniciales.
// =========================================================================
import { ref, onMounted } from "vue";

// =========================================================================
// SECCIÓN: IMPORTACIÓN DEL SERVICIO — Patrón Facade
// =========================================================================
// Importamos las 5 funciones CRUD del servicio de usuarios. Cada función
// encapsula una operación específica contra Supabase:
//
//   • getUsers()         → SELECT * FROM users (con JOIN a roles)
//   • createUser(data)   → INSERT INTO users + creación de auth en Supabase
//   • toggleUserStatus() → UPDATE users SET active = !active WHERE id_user = ?
//   • actualizarUsuario()→ UPDATE users SET ... WHERE id_user = ?
//   • eliminarUsuario()  → DELETE FROM users WHERE id_user = ?
//
// Al centralizar estas operaciones en un servicio, desacoplamos la lógica de
// acceso a datos de la lógica de presentación (Principio de Responsabilidad Única).
// =========================================================================
import { 
  getUsers, 
  createUser, 
  toggleUserStatus, 
  actualizarUsuario, 
  eliminarUsuario 
} from "../../services/usuariosService";

// =========================================================================
// SECCIÓN: ESTADO REACTIVO — Variables de Estado del Componente
// =========================================================================

/**
 * @description Lista reactiva que almacena todos los usuarios obtenidos del backend.
 *              Se utiliza en el template con `v-for` para renderizar la tabla.
 *              Se actualiza cada vez que se ejecuta `loadUsers()`.
 * @type {import('vue').Ref<Array<Object>>}
 *
 * Nota sobre ref([]):
 *   - `ref([])` crea una referencia reactiva inicializada con un arreglo vacío.
 *   - Para acceder/modificar en <script>: `usuarios.value = [...]`
 *   - En <template> se accede directamente: `{{ usuarios }}` (Vue desenvuelve el .value)
 */
const usuarios = ref([]);

/**
 * @description Controla el estado del modal de edición.
 *              - `null` → No se está editando ningún usuario (modal cerrado).
 *              - `{...}` → Contiene una COPIA del objeto usuario que se está editando.
 *
 * Nota sobre el patrón de clonación:
 *   Al editar, se clona el objeto con spread operator `{ ...usuario }` para evitar
 *   modificar directamente el objeto original de la lista. Si el usuario cancela
 *   la edición, los datos originales permanecen intactos.
 * @type {import('vue').Ref<Object|null>}
 */
const usuarioEditando = ref(null);

/**
 * @description Objeto reactivo vinculado al formulario de creación de nuevos usuarios.
 *              Cada propiedad corresponde a un campo del formulario via `v-model`.
 *
 * Valores por defecto:
 *   - `email`, `password`, `first_name`, `last_name` → Cadenas vacías
 *   - `base_salary` → 0 (salario base inicial)
 *   - `id_role` → 3 (Mesero) — El rol más común y con menos privilegios
 *
 * Tras crear un usuario exitosamente, este objeto se reinicia a sus valores
 * por defecto para limpiar el formulario.
 * @type {import('vue').Ref<Object>}
 */
const nuevoUsuario = ref({
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  base_salary: 0,
  id_role: 3 // Por defecto asignamos el rol 'Mesero'.
});

// =========================================================================
// SECCIÓN: LÓGICA DE ESTADO — Toggle Activo/Inactivo
// =========================================================================

/**
 * @description Alterna el estado activo/inactivo de un usuario (Soft Delete Toggle).
 *              Implementa una regla de negocio crítica: los administradores NO pueden
 *              ser desactivados para garantizar la continuidad operativa del sistema.
 *
 * Flujo de ejecución:
 *   1. Valida que el usuario NO sea administrador.
 *   2. Llama al servicio `toggleUserStatus()` invirtiendo el valor actual de `active`.
 *   3. Recarga la lista completa para reflejar el cambio en la UI.
 *
 * @param {Object} usuario - Objeto usuario con sus propiedades (incluye `roles.role_name`)
 * @returns {Promise<void>}
 */
const cambiarEstado = async (usuario) => {
  // Validación de seguridad: Previene que un administrador pueda desactivar su propio rol.
  // Se usa optional chaining (?.) porque la relación `roles` podría no estar cargada.
  if (usuario.roles?.role_name === "admin") {
    alert("No se puede desactivar un administrador");
    return;
  }

  try {
    // Invierte el estado actual: si estaba activo (true), lo pasa a inactivo (false) y viceversa.
    await toggleUserStatus(usuario.id_user, !usuario.active);
    await loadUsers(); // Refresca la lista tras el cambio.
  } catch (error) {
    console.error(error);
  }
};

// =========================================================================
// SECCIÓN: LÓGICA DE CARGA — Obtener Usuarios del Backend
// =========================================================================

/**
 * @description Recupera la lista completa de usuarios desde el backend a través
 *              del servicio Facade `getUsers()`. Los datos incluyen la relación
 *              JOIN con la tabla `roles` para mostrar el nombre del rol.
 *
 * Se invoca en los siguientes escenarios:
 *   - Al montar el componente (onMounted)
 *   - Después de crear un usuario
 *   - Después de editar un usuario
 *   - Después de eliminar un usuario
 *   - Después de cambiar el estado activo/inactivo
 *
 * @returns {Promise<void>}
 */
const loadUsers = async () => {
  try {
    usuarios.value = await getUsers();
  } catch (error) {
    console.error(error);
  }
};

// =========================================================================
// SECCIÓN: LÓGICA CRUD DE USUARIOS
// =========================================================================

/**
 * @description Crea un nuevo usuario en el sistema y reinicia el formulario.
 *
 * Flujo de ejecución:
 *   1. Envía los datos del formulario (`nuevoUsuario.value`) al servicio `createUser()`.
 *   2. Recarga la lista de usuarios para incluir el nuevo registro.
 *   3. Reinicia el formulario a valores por defecto (limpia los campos).
 *   4. Muestra una alerta de confirmación al administrador.
 *
 * Nota sobre createUser():
 *   En Supabase, la creación de un usuario involucra DOS operaciones:
 *     a) Crear la entrada de autenticación en `auth.users` (Supabase Auth)
 *     b) Crear el perfil en la tabla pública `users` (datos del negocio)
 *   Ambas están orquestadas dentro del servicio (patrón Facade).
 *
 * @returns {Promise<void>}
 */
const crearNuevoUsuario = async () => {
  try {
    await createUser(nuevoUsuario.value);
    await loadUsers();
    
    // Reinicio del formulario — Restablece todos los campos a sus valores iniciales.
    nuevoUsuario.value = {
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      base_salary: 0,
      id_role: 3
    };
    alert("Usuario creado correctamente");
  } catch (error) {
    console.error(error);
  }
};

/**
 * @description Prepara el modal de edición clonando los datos del usuario seleccionado.
 *              Utiliza el spread operator `{...}` para crear una copia superficial,
 *              evitando que los cambios en el formulario modifiquen el objeto original
 *              de la lista antes de confirmar la edición.
 *
 * Al asignar un valor no-null a `usuarioEditando`, el `v-if` en el template
 * hace visible el modal de edición automáticamente (reactividad de Vue).
 *
 * @param {Object} usuario - Objeto usuario completo a editar
 * @returns {void}
 */
const editarUsuario = (usuario) => {
  usuarioEditando.value = { ...usuario };
};

/**
 * @description Envía la actualización de los datos editados al backend y cierra el modal.
 *
 * Flujo de ejecución:
 *   1. Llama a `actualizarUsuario()` con el ID y los datos modificados.
 *   2. Establece `usuarioEditando = null` para cerrar el modal (el `v-if` lo oculta).
 *   3. Recarga la lista de usuarios para reflejar los cambios en la tabla.
 *
 * @returns {Promise<void>}
 */
const guardarEdicion = async () => {
  try {
    await actualizarUsuario(usuarioEditando.value.id_user, usuarioEditando.value);
    usuarioEditando.value = null; // Cierra el modal.
    await loadUsers();
  } catch (error) {
    console.error(error);
  }
};

/**
 * @description Ejecuta la eliminación permanente de un usuario tras solicitar
 *              confirmación explícita con `confirm()`.
 *
 * Nota sobre confirm():
 *   `confirm()` es una función nativa del navegador que muestra un diálogo
 *   modal con botones "Aceptar" y "Cancelar". Retorna `true` si el usuario
 *   acepta y `false` si cancela. Esto previene eliminaciones accidentales.
 *
 * @param {Object} usuario - Objeto usuario con al menos `id_user`, `first_name`, `last_name`
 * @returns {Promise<void>}
 */
const eliminarUsuarioSistema = async (usuario) => {
  try {
    // Template literal para mostrar el nombre completo en el diálogo de confirmación.
    const confirmar = confirm(`¿Eliminar a ${usuario.first_name} ${usuario.last_name}?`);
    if (!confirmar) return;

    await eliminarUsuario(usuario.id_user);
    await loadUsers();
    alert("Usuario eliminado");
  } catch (error) {
    console.error(error);
  }
};

// =========================================================================
// SECCIÓN: LIFECYCLE HOOK — Inicialización del Componente
// =========================================================================
// `onMounted()` se ejecuta después de que Vue ha renderizado el componente
// en el DOM por primera vez. Es el momento ideal para realizar peticiones
// HTTP/fetch iniciales, ya que la interfaz ya está visible y puede mostrar
// un estado de carga mientras los datos se obtienen del servidor.
// =========================================================================
onMounted(() => {
  loadUsers();
});
</script>

<template>

  <!-- ========================================================================
    SECCIÓN: CONTENEDOR PRINCIPAL — Panel Glassmorphism
    ==========================================================================
    Contenedor raíz del componente con estilo glassmorphism (efecto vidrio).
    Clases Tailwind aplicadas:
      - `glass-panel`  → Clase personalizada (definida en CSS global) para efecto vidrio
      - `bg-white/5`   → Fondo blanco con 5% de opacidad (transparencia)
      - `shadow-xl`    → Sombra extra-grande para efecto de elevación
      - `rounded-3xl`  → Bordes redondeados de 1.5rem (24px)
      - `p-6`          → Padding de 1.5rem en todos los lados
      - `transition-colors duration-500` → Transición suave de 500ms al cambiar colores
    ======================================================================== -->
  <div
    class="glass-panel bg-white/5 shadow-xl rounded-3xl p-6 transition-colors duration-500"
  >

    <!-- Título principal del módulo de administración de usuarios -->
    <h2
      class="text-2xl font-bold mb-6"
    >
      Gestión de Usuarios
    </h2>

    <!-- ========================================================================
      SECCIÓN: FORMULARIO DE CREACIÓN DE USUARIO
      ==========================================================================
      Grid responsive de 2 columnas (en pantallas md+) con los campos necesarios
      para registrar un nuevo usuario en el sistema.

      Cada input utiliza `v-model` para crear un data binding bidireccional:
        - Cuando el usuario escribe → se actualiza `nuevoUsuario.propiedad`
        - Cuando cambia `nuevoUsuario.propiedad` programáticamente → se actualiza el input

      Campos:
        1. first_name  → Nombre de pila
        2. last_name   → Apellido
        3. email       → Correo electrónico (credencial de login)
        4. password    → Contraseña (type="password" para ocultarla)
        5. base_salary → Salario base (type="number" para solo permitir números)
        6. id_role     → Selector de rol (Admin=1, Supervisor=2, Mesero=3)
      ======================================================================== -->

    <div
      class="grid md:grid-cols-2 gap-4 mb-8"
    >

      <!-- Campo: Nombre — v-model vincula el valor al estado reactivo nuevoUsuario.first_name -->
      <input
        v-model="nuevoUsuario.first_name"
        placeholder="Nombre"
        class="glass-panel p-6 shadow-xl p-3 rounded-xl"
      />

      <!-- Campo: Apellido -->
      <input
        v-model="nuevoUsuario.last_name"
        placeholder="Apellido"
        class="glass-panel p-6 shadow-xl p-3 rounded-xl"
      />

      <!-- Campo: Correo electrónico — Se usa como credencial de login en Supabase Auth -->
      <input
        v-model="nuevoUsuario.email"
        placeholder="Correo"
        class="glass-panel p-6 shadow-xl p-3 rounded-xl"
      />

      <!-- Campo: Contraseña — type="password" enmascara los caracteres por seguridad -->
      <input
        v-model="nuevoUsuario.password"
        type="password"
        placeholder="Contraseña"
        class="glass-panel p-6 shadow-xl p-3 rounded-xl"
      />

      <!-- Campo: Salario Base — type="number" restringe la entrada a valores numéricos -->
      <input
        v-model="nuevoUsuario.base_salary"
        type="number"
        placeholder="Salario"
        class="glass-panel p-6 shadow-xl p-3 rounded-xl"
      />

      <!-- ====================================================================
        CAMPO: Selector de Rol
        ======================================================================
        `<select>` con `v-model` vinculado a `nuevoUsuario.id_role`.
        Cada `<option>` usa `:value` (v-bind) para asignar el ID numérico del rol.
        El `:value` con dos puntos (:) indica que es una expresión JavaScript,
        no un string, lo que permite pasar el número 1, 2 o 3.
        
        Mapeo de roles en la base de datos:
          1 → Admin      (acceso total al sistema)
          2 → Supervisor  (gestión operativa)
          3 → Mesero      (operación de mesas y pedidos)
      ==================================================================== -->
      <select
        v-model="nuevoUsuario.id_role"
        class="glass-panel p-6 shadow-xl p-3 rounded-xl"
      >

        <option :value="1">
          Admin
        </option>

        <option :value="2">
          Supervisor
        </option>

        <option :value="3">
          Mesero
        </option>

      </select>

    </div>

    <!-- ====================================================================
      BOTÓN: Crear Usuario
      ======================================================================
      `@click` → Directiva de evento que ejecuta `crearNuevoUsuario()` al hacer clic.
      Estilos del botón:
        - `bg-green-600`          → Fondo verde (color de acción positiva/crear)
        - `hover:bg-green-500`    → Verde más claro al pasar el mouse (feedback visual)
        - `font-bold`             → Texto en negrita para mayor visibilidad
    ==================================================================== -->
    <button
      @click="crearNuevoUsuario"
      class="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold mb-8"
    >
      Crear Usuario
    </button>

    <!-- ========================================================================
      SECCIÓN: TABLA DE USUARIOS — Listado CRUD
      ==========================================================================
      Tabla HTML responsiva (envuelta en `overflow-auto` para scroll horizontal
      en pantallas pequeñas) que muestra todos los usuarios registrados.

      Columnas: ID | Nombre | Email | Rol | Salario | Estado | Acciones
      ======================================================================== -->

    <div class="overflow-auto">

      <table class="w-full">

        <!-- Encabezados de la tabla — border-b crea una línea separadora inferior -->
        <thead>

          <tr
            class="text-left border-b border-gray-700"
          >

            <th class="p-3">
              ID
            </th>

            <th class="p-3">
              Nombre
            </th>

            <th class="p-3">
              Email
            </th>

            <th class="p-3">
              Rol
            </th>

            <th class="p-3">
              Salario
            </th>

            <th class="p-3">
              Estado
            </th>

            <th class="p-3">
              Acciones
            </th>

          </tr>

        </thead>

        <!-- ================================================================
          CUERPO DE LA TABLA — Iteración con v-for
          ==================================================================
          `v-for="usuario in usuarios"` → Directiva de iteración de Vue 3.
          Recorre el arreglo reactivo `usuarios` y renderiza una fila `<tr>`
          por cada elemento.

          `:key="usuario.id_user"` → Propiedad obligatoria en v-for.
          Vue usa esta key única para rastrear cada nodo del DOM y optimizar
          las actualizaciones (algoritmo de reconciliación / virtual DOM diff).
          Sin :key, Vue usaría el índice del arreglo, lo cual puede causar
          bugs al reordenar o eliminar elementos.
        ================================================================ -->
        <tbody>

          <tr
            v-for="usuario in usuarios"
            :key="usuario.id_user"
            class="border-b border-gray-800"
          >

            <!-- Columna: ID del usuario -->
            <td class="p-3">
              {{ usuario.id_user }}
            </td>

            <!-- Columna: Nombre completo — Concatena first_name + last_name con interpolación -->
            <td class="p-3">
              {{ usuario.first_name }}
              {{ usuario.last_name }}
            </td>

            <!-- Columna: Email -->
            <td class="p-3">
              {{ usuario.email }}
            </td>

            <!-- ============================================================
              COLUMNA: Rol del Usuario — Renderizado Condicional con v-if/v-else-if/v-else
              ==============================================================
              Se utiliza una cadena de directivas condicionales para mostrar
              el rol con un badge (pill/pastilla) de color diferente según
              el tipo de rol:
                - Admin      → Badge púrpura (bg-purple-600)
                - Supervisor → Badge azul (bg-blue-600)
                - Mesero     → Badge ámbar (bg-amber-600)

              `usuario.roles?.role_name` → Optional chaining para acceder
              de forma segura a la propiedad anidada del JOIN con la tabla roles.
              Si `roles` es null/undefined, retorna undefined sin error.
            ============================================================ -->
            <td class="p-3">

              <!-- Badge: Admin — v-if evalúa si el rol es 'admin' -->
              <span
                v-if="usuario.roles?.role_name === 'admin'"
                class="bg-purple-600 px-3 py-1 rounded-full text-sm font-bold"
              >
                Admin
              </span>

              <!-- Badge: Supervisor — v-else-if solo se evalúa si v-if fue false -->
              <span
                v-else-if="usuario.roles?.role_name === 'supervisor'"
                class="bg-blue-600 px-3 py-1 rounded-full text-sm font-bold"
              >
                Supervisor
              </span>

              <!-- Badge: Mesero — v-else se muestra si ninguna condición anterior fue true -->
              <span
                v-else
                class="bg-amber-600 px-3 py-1 rounded-full text-sm font-bold"
              >
                Mesero
              </span>

            </td>

            <!-- Columna: Salario — Formatea el número a 2 decimales con Number().toFixed(2) -->
            <td class="p-3">
              $
              {{ Number(usuario.base_salary).toFixed(2) }}
            </td>

            <!-- ============================================================
              COLUMNA: Estado Activo/Inactivo — Indicador Visual
              ==============================================================
              Muestra un indicador visual con color y texto según el estado:
                - Activo   → Punto verde (●) + texto "Activo" en verde (text-green-400)
                - Inactivo → Punto rojo (●) + texto "Inactivo" en rojo (text-red-400)
            ============================================================ -->
            <td class="p-3">

              <span
                v-if="usuario.active"
                class="text-green-400 font-bold"
              >
                ● Activo
              </span>

              <span
                v-else
                class="text-red-400 font-bold"
              >
                ● Inactivo
              </span>

            </td>

            <!-- ============================================================
              COLUMNA: Acciones — Botones de Operación CRUD
              ==============================================================
              Se divide en dos secciones mediante `<template>` con v-if/v-else:

              1. ADMINISTRADOR PROTEGIDO (v-if rol === 'admin'):
                 Solo muestra un botón "Protegido" deshabilitado. Esto
                 implementa la regla de negocio que impide modificar admins.

              2. USUARIO REGULAR (v-else):
                 Muestra tres botones de acción:
                   a) Activar/Desactivar → Toggle con clase dinámica (:class)
                   b) Editar             → Abre el modal de edición
                   c) Eliminar           → Solicita confirmación y elimina

              `<template>` como wrapper:
                Vue permite usar `<template>` como contenedor lógico para
                v-if sin renderizar un elemento HTML adicional en el DOM.
            ============================================================ -->
            <td class="p-3">

              <div class="flex gap-2">

                <!-- CASO: Usuario es ADMINISTRADOR — Botón protegido -->

                <template
                  v-if="
                    usuario.roles?.role_name === 'admin'
                  "
                >

                  <!-- `disabled` → Atributo HTML que deshabilita la interacción.
                       `cursor-not-allowed` → Muestra el cursor de "no permitido" al pasar el mouse. -->
                  <button
                    disabled
                    class="bg-gray-700 px-4 py-2 rounded-xl font-bold cursor-not-allowed"
                  >
                    Protegido
                  </button>

                </template>

                <!-- CASO: Usuario NO es administrador — Acciones completas -->

                <template
                  v-else
                >

                  <!-- ========================================================
                    BOTÓN: Activar/Desactivar — Clase Dinámica con :class
                    ==========================================================
                    `:class` (v-bind:class) permite aplicar clases CSS condicionalmente.
                    Usa un operador ternario:
                      - Si `usuario.active` es true  → clases rojas (para desactivar)
                      - Si `usuario.active` es false → clases verdes (para activar)

                    El texto del botón también es dinámico con el mismo ternario:
                      - Activo   → muestra "Desactivar"
                      - Inactivo → muestra "Activar"
                  ======================================================== -->
                  <button
                    @click="
                      cambiarEstado(usuario)
                    "
                    class="px-4 py-2 rounded-xl font-bold transition"
                    :class="
                      usuario.active
                        ? 'bg-red-600 hover:bg-red-500'
                        : 'bg-green-600 hover:bg-green-500'
                    "
                  >
                    {{
                      usuario.active
                        ? 'Desactivar'
                        : 'Activar'
                    }}
                  </button>

                  <!-- BOTÓN: Editar — @click ejecuta `editarUsuario()` que abre el modal -->
                  <button
                    @click="
                      editarUsuario(usuario)
                    "
                    class="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-xl font-bold"
                  >
                    Editar
                  </button>

                  <!-- BOTÓN: Eliminar — @click ejecuta `eliminarUsuarioSistema()` con confirm() -->
                  <button
                    @click="
                      eliminarUsuarioSistema(
                        usuario
                      )
                    "
                    class="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl font-bold"
                  >
                    Eliminar
                  </button>

                </template>

              </div>

            </td>

          </tr>

        </tbody>

      </table>

    </div>

    <!-- ========================================================================
      SECCIÓN: MODAL DE EDICIÓN DE USUARIO
      ==========================================================================
      Modal flotante que aparece cuando `usuarioEditando` tiene un valor no-null.

      Patrón de Modal en Vue:
        - `v-if="usuarioEditando"` → Renderiza el modal SOLO cuando hay un usuario
          en edición. Cuando es null, Vue destruye completamente el nodo del DOM.
        - El overlay (`bg-black/70`) cubre toda la pantalla (fixed inset-0).
        - `z-50` garantiza que el modal esté por encima de todos los otros elementos.
        - `flex items-center justify-center` centra el contenido vertical y horizontalmente.

      Formulario de edición:
        - Campos: Nombre, Apellido, Salario, Rol (el email NO se edita)
        - El rol "Admin" está deshabilitado (`disabled`) para prevenir escalada
          de privilegios accidental.
        - Botón "Guardar" → Ejecuta `guardarEdicion()` y cierra el modal.
        - Botón "Cancelar" → Asigna `null` directamente con `@click`, lo que
          destruye el modal sin guardar cambios (los datos originales persisten
          porque trabajamos con una copia clonada).
    ======================================================================== -->

    <div
      v-if="usuarioEditando"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >

      <!-- Contenedor del modal — Ancho fijo de 500px con estilo glassmorphism -->
      <div
        class="glass-panel bg-white/5 shadow-xl p-8 rounded-3xl w-[500px]"
      >

        <h2
          class="text-2xl font-bold mb-6"
        >
          Editar Usuario
        </h2>

        <!-- Campos de edición — `v-model` vinculado a las propiedades del clon -->
        <div class="space-y-4">

          <!-- Campo: Nombre del usuario en edición -->
          <input
            v-model="
              usuarioEditando.first_name
            "
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          />

          <!-- Campo: Apellido del usuario en edición -->
          <input
            v-model="
              usuarioEditando.last_name
            "
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          />

          <!-- Campo: Salario base — type="number" para validación numérica del navegador -->
          <input
            v-model="
              usuarioEditando.base_salary
            "
            type="number"
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          />

          <!-- Selector de Rol en edición — Admin (1) está deshabilitado por seguridad -->
          <select
            v-model="
              usuarioEditando.id_role
            "
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          >

            <!-- `disabled` en la opción Admin previene que un no-admin se auto-promueva -->
            <option
              :value="1"
              disabled
            >
              Admin
            </option>

            <option :value="2">
              Supervisor
            </option>

            <option :value="3">
              Mesero
            </option>

          </select>

          <!-- Botones de acción del modal — Guardar y Cancelar -->
          <div class="flex gap-3">

            <!-- @click="guardarEdicion" → Persiste los cambios en el backend y cierra el modal -->
            <button
              @click="guardarEdicion"
              class="flex-1 bg-green-600 hover:bg-green-500 py-3 rounded-xl font-bold"
            >
              Guardar
            </button>

            <!-- @click inline → Asigna null directamente para cerrar el modal sin guardar.
                 Esta es una técnica común en Vue: expresiones simples directamente en @click. -->
            <button
              @click="
                usuarioEditando = null
              "
              class="flex-1 bg-red-600 hover:bg-red-500 py-3 rounded-xl font-bold"
            >
              Cancelar
            </button>

          </div>

        </div>

      </div>

    </div>

  </div>

</template>
