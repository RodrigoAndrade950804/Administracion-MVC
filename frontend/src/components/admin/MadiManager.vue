<!-- ==================================================================================
  COMPONENTE: MadiManager.vue
  ==================================================================================
  PROPÓSITO:
    Panel de administración del sistema "MADI" (Meta de Avance Diario Individual).
    MADI es el sistema de gamificación y bonificación de meseros del restaurante
    "Aroma & Grano". Permite al administrador:
      1. Configurar la meta de ventas diaria que cada mesero debe alcanzar.
      2. Crear, editar y eliminar las reglas de bonos que determinan el porcentaje
         de bonificación que recibe un mesero según su rendimiento.

  ARQUITECTURA:
    - Patrón CRUD completo para las reglas de bonos (Crear, Leer, Actualizar, Eliminar).
    - Patrón Facade: cada función del servicio (madiService) encapsula la complejidad
      de la comunicación con Supabase, exponiendo una interfaz simple al componente.
    - Modal de edición: usa renderizado condicional (v-if) para mostrar/ocultar
      un formulario de edición in-place sin navegación adicional.

  LÓGICA DE NEGOCIO MADI:
    - "personal_daily_goal": Meta diaria en dólares que cada mesero debe alcanzar.
    - Cada "regla de bono" define un rango de porcentaje de cumplimiento
      (min_percentage – max_percentage) y un factor de bonificación (bonus_factor).
    - Ejemplo: Si un mesero alcanza entre 80% y 100% de su meta, recibe un bono
      del 5% sobre sus ventas (bonus_factor = 5).
    - Las reglas son evaluadas por el backend al cerrar el turno del mesero.

  DEPENDENCIAS:
    - madiService.js → funciones de servicio que interactúan con Supabase
    - Vue 3 Composition API (ref, onMounted)
    - Tailwind CSS para estilos (clases utilitarias)
  ================================================================================== -->

<script setup>
// =========================================================================
// SECCIÓN: IMPORTACIONES
// =========================================================================

/**
 * Importación de las funciones de servicio del módulo MADI.
 *
 * Patrón Facade: Cada función actúa como una fachada (Facade) que encapsula
 * la complejidad de las operaciones con Supabase (consultas SQL, manejo de
 * errores, transformación de datos). El componente solo necesita llamar a
 * funciones con nombres descriptivos sin conocer los detalles de la base de datos.
 *
 * @function getConfiguracionMadi  - Obtiene la configuración global MADI (meta diaria).
 * @function actualizarConfiguracionMadi - Actualiza la meta diaria en la tabla de configuración.
 * @function getReglasBonos        - Retorna todas las reglas de bonificación configuradas.
 * @function crearReglaBono        - Inserta una nueva regla de bono en la base de datos.
 * @function actualizarReglaBono   - Modifica una regla de bono existente por su ID.
 * @function eliminarReglaBono     - Elimina una regla de bono por su ID.
 */
import {
  getConfiguracionMadi,
  actualizarConfiguracionMadi,
  getReglasBonos,
  crearReglaBono,
  actualizarReglaBono,
  eliminarReglaBono,
} from "../../services/madiService";

/**
 * Importación de utilidades de Vue 3 (Composition API).
 *
 * @function ref       - Crea una referencia reactiva. Cuando el valor de un ref cambia,
 *                       Vue re-renderiza automáticamente cualquier parte del template
 *                       que dependa de ese valor (reactividad granular).
 * @function onMounted - Hook del ciclo de vida. Se ejecuta una vez que el componente
 *                       ha sido montado en el DOM. Es el lugar ideal para cargar datos
 *                       iniciales desde APIs o bases de datos.
 */
import { ref, onMounted } from "vue";

// =========================================================================
// SECCIÓN: ESTADOS REACTIVOS (ref)
// =========================================================================
// En Vue 3 Composition API, usamos ref() para crear variables reactivas.
// Cada ref() retorna un objeto { value: ... }. En el <script>, accedemos
// al valor con .value; en el <template>, Vue lo desenvuelve automáticamente.
// =========================================================================

/**
 * Almacena la configuración global del sistema MADI.
 *
 * Estructura esperada del objeto (proviene de la tabla 'configuracion_madi'):
 * {
 *   id_madi: number,            - Identificador único del registro de configuración
 *   personal_daily_goal: number  - Meta de ventas diaria por mesero (en dólares)
 * }
 *
 * Se inicializa como null porque aún no se han cargado datos del servidor.
 * El template usa v-if="configuracion" para renderizar solo cuando hay datos.
 */
const configuracion = ref(null);

/**
 * Lista reactiva que mantiene las reglas de bonos cargadas desde la base de datos.
 *
 * Cada elemento del array tiene la estructura:
 * {
 *   id_reglas: number,       - Identificador único de la regla
 *   level_name: string,      - Nombre descriptivo del nivel (ej: "Bronce", "Plata", "Oro")
 *   min_percentage: number,  - Porcentaje mínimo de cumplimiento para aplicar esta regla
 *   max_percentage: number,  - Porcentaje máximo de cumplimiento para aplicar esta regla
 *   bonus_factor: number     - Porcentaje de bonificación otorgado (ej: 5 = 5%)
 * }
 *
 * Se inicializa como array vacío para que el v-for del template no falle.
 */
const reglasBonos = ref([]);

/**
 * Estado temporal para el modal de edición.
 *
 * Cuando el usuario hace clic en "Editar" en una regla, se copia (spread)
 * el objeto de la regla a esta variable. Esto permite editar sin mutar
 * directamente el array original (patrón de edición inmutable).
 *
 * Cuando es null, el modal está oculto (v-if="reglaEditando").
 * Cuando tiene un objeto, el modal se muestra con los datos precargados.
 */
const reglaEditando = ref(null);

/**
 * Objeto reactivo para el formulario de creación de una nueva regla.
 *
 * Contiene los valores por defecto que se muestran en los inputs del formulario
 * de creación. Tras crear la regla exitosamente, este objeto se reinicia
 * a sus valores iniciales para limpiar el formulario.
 *
 * @property {string} level_name      - Nombre del nivel de bonificación
 * @property {number} min_percentage  - Porcentaje mínimo del rango
 * @property {number} max_percentage  - Porcentaje máximo del rango
 * @property {number} bonus_factor    - Factor de bonificación (en %)
 */
const nuevaRegla = ref({
  level_name: "",
  min_percentage: 0,
  max_percentage: 0,
  bonus_factor: 1
});

// =========================================================================
// SECCIÓN: LÓGICA DE NEGOCIO — OPERACIONES CRUD SOBRE REGLAS DE BONOS
// =========================================================================
// Este bloque implementa el patrón CRUD (Create, Read, Update, Delete)
// completo para las reglas de bonificación del sistema MADI.
// Cada operación de escritura (Create/Update/Delete) refresca la lista
// de reglas llamando a loadReglas() para mantener la UI sincronizada.
// =========================================================================

/**
 * Prepara una regla para edición copiándola al estado del modal.
 *
 * Usa el operador spread ({ ...regla }) para crear una copia superficial
 * del objeto. Esto evita que los cambios del usuario en el formulario de
 * edición modifiquen directamente el array reglasBonos (principio de
 * inmutabilidad: no mutar el estado hasta confirmar la operación).
 *
 * @description Copia la regla seleccionada al estado de edición para poblar el modal
 * @param {Object} regla - Objeto de la regla de bono a editar
 * @param {number} regla.id_reglas      - ID único de la regla
 * @param {string} regla.level_name     - Nombre del nivel
 * @param {number} regla.min_percentage - Porcentaje mínimo
 * @param {number} regla.max_percentage - Porcentaje máximo
 * @param {number} regla.bonus_factor   - Factor de bonificación
 */
const editarRegla = (regla) => {
  reglaEditando.value = { ...regla };
};

/**
 * Persiste los cambios de una regla específica en el backend (UPDATE).
 *
 * Flujo:
 * 1. Llama a actualizarReglaBono() con el ID y los campos modificados.
 * 2. Limpia reglaEditando (cierra el modal automáticamente vía v-if).
 * 3. Recarga la lista completa de reglas para reflejar los cambios.
 *
 * @description Guarda los cambios editados de una regla de bono existente
 * @returns {Promise<void>}
 * @throws {Error} Si la actualización en Supabase falla (capturado en catch)
 */
const guardarRegla = async () => {
  try {
    await actualizarReglaBono(
      reglaEditando.value.id_reglas,
      {
        level_name: reglaEditando.value.level_name,
        min_percentage: reglaEditando.value.min_percentage,
        max_percentage: reglaEditando.value.max_percentage,
        bonus_factor: reglaEditando.value.bonus_factor
      }
    );
    // Limpia el estado de edición y refresca la lista de reglas.
    reglaEditando.value = null;
    await loadReglas();
  } catch (error) {
    console.error(error);
  }
};

/**
 * Elimina una regla de bono previa confirmación del usuario (DELETE).
 *
 * Usa window.confirm() como salvaguarda UX para evitar eliminaciones
 * accidentales. Si el usuario cancela, la función retorna sin ejecutar.
 *
 * @description Solicita confirmación al usuario antes de eliminar una regla de bono
 * @param {number} id - El id_reglas del registro a eliminar
 * @returns {Promise<void>}
 * @throws {Error} Si la eliminación en Supabase falla (capturado en catch)
 */
const eliminarRegla = async (id) => {
  const confirmar = confirm("¿Eliminar esta regla?");
  if (!confirmar) return;

  try {
    await eliminarReglaBono(id);
    await loadReglas(); // Refresca la tabla tras la eliminación.
  } catch (error) {
    console.error(error);
  }
};

// =========================================================================
// SECCIÓN: FUNCIONES DE CARGA DE DATOS (READ)
// =========================================================================
// Estas funciones obtienen datos desde el backend a través del servicio
// (Patrón Facade). Son llamadas tanto en onMounted() como después de
// cada operación de escritura para mantener la interfaz actualizada.
// =========================================================================

/**
 * Carga la configuración global del sistema MADI desde el servicio.
 *
 * Obtiene el registro único de la tabla 'configuracion_madi' que contiene
 * la meta de ventas diaria (personal_daily_goal). El resultado se asigna
 * a la ref reactiva 'configuracion', lo que desencadena el renderizado
 * del formulario de configuración en el template (v-if="configuracion").
 *
 * @description Obtiene la configuración general del sistema MADI desde el servicio
 * @returns {Promise<void>}
 */
const loadConfiguracion = async () => {
  try {
    configuracion.value = await getConfiguracionMadi();
  } catch (error) {
    console.error(error);
  }
};

/**
 * Crea una nueva regla de bono en la base de datos (CREATE).
 *
 * Flujo:
 * 1. Envía los datos del formulario (nuevaRegla) al servicio crearReglaBono().
 * 2. Reinicia el formulario a valores por defecto para que el usuario pueda
 *    crear otra regla inmediatamente (mejora UX).
 * 3. Recarga la lista de reglas para mostrar la regla recién creada.
 *
 * @description Crea una nueva regla de bono y reinicia el formulario
 * @returns {Promise<void>}
 * @throws {Error} Si la inserción en Supabase falla (capturado en catch)
 */
const crearRegla = async () => {
  try {
    await crearReglaBono(nuevaRegla.value);
    nuevaRegla.value = {
      level_name: "",
      min_percentage: 0,
      max_percentage: 0,
      bonus_factor: 1
    };
    await loadReglas(); // Actualiza la vista de la tabla.
  } catch (error) {
    console.error(error);
  }
};

/**
 * Obtiene la lista completa de reglas de bonos configuradas (READ).
 *
 * Consulta todas las reglas de la tabla 'reglas_bonos' a través del servicio.
 * El resultado se asigna al ref reglasBonos, que alimenta el v-for en el
 * template para renderizar cada fila de la tabla de reglas.
 *
 * @description Obtiene todas las reglas de bonos desde el servicio
 * @returns {Promise<void>}
 */
const loadReglas = async () => {
  try {
    reglasBonos.value = await getReglasBonos();
  } catch (error) {
    console.error(error);
  }
};

// =========================================================================
// SECCIÓN: GUARDAR CONFIGURACIÓN GLOBAL
// =========================================================================

/**
 * Envía la configuración global actualizada al backend (UPDATE).
 *
 * Actualiza únicamente el campo 'personal_daily_goal' en la tabla
 * 'configuracion_madi', identificado por 'id_madi'. Este valor determina
 * la meta de ventas que cada mesero debe alcanzar diariamente para que
 * el sistema MADI calcule sus bonificaciones.
 *
 * Muestra un alert() nativo como retroalimentación al administrador.
 *
 * @description Envía la meta diaria actualizada al backend
 * @returns {Promise<void>}
 * @throws {Error} Si la actualización en Supabase falla (capturado en catch)
 */
const guardarConfiguracion = async () => {
  try {
    await actualizarConfiguracionMadi(
      configuracion.value.id_madi,
      {
        personal_daily_goal: configuracion.value.personal_daily_goal
      }
    );
    alert("Configuración actualizada");
  } catch (error) {
    console.error(error);
  }
};

// =========================================================================
// SECCIÓN: CICLO DE VIDA DEL COMPONENTE
// =========================================================================

/**
 * Hook onMounted — Se ejecuta una sola vez cuando el componente se monta en el DOM.
 *
 * Carga los datos iniciales necesarios para renderizar la interfaz:
 * 1. loadConfiguracion() → Obtiene la meta diaria actual.
 * 2. loadReglas()        → Obtiene la lista de reglas de bonos.
 *
 * Ambas llamadas son await secuenciales para garantizar que la configuración
 * se cargue antes que las reglas (aunque en este caso no hay dependencia
 * directa, es una buena práctica para orden y legibilidad).
 */
onMounted(async () => {
  await loadConfiguracion();
  await loadReglas();
});
</script>

<template>

  <!-- ========================================================================= -->
  <!-- SECCIÓN: CONTENEDOR PRINCIPAL                                             -->
  <!-- ========================================================================= -->
  <!-- Panel principal con efecto "glassmorphism" (glass-panel bg-white/5).      -->
  <!-- rounded-3xl: bordes muy redondeados para estética moderna.                -->
  <!-- transition-colors duration-500: transición suave al cambiar tema/colores. -->
  <div
    class="glass-panel bg-white/5 shadow-xl rounded-3xl p-6 transition-colors duration-500"
  >

    <!-- ========================================================================= -->
    <!-- SECCIÓN: CONFIGURACIÓN GLOBAL MADI                                        -->
    <!-- ========================================================================= -->
    <!-- Título del panel de configuración MADI.                                   -->
    <h2
      class="text-2xl font-bold mb-6"
    >
      Configuración MADI
    </h2>

    <!-- ========================================================================= -->
    <!-- SECCIÓN: FORMULARIO DE META DIARIA                                        -->
    <!-- ========================================================================= -->
    <!-- v-if="configuracion": Renderizado condicional — solo muestra el formulario -->
    <!-- cuando los datos de configuración se han cargado exitosamente del servidor. -->
    <!-- Esto evita errores de acceso a propiedades de null y muestra un estado      -->
    <!-- vacío mientras se carga.                                                    -->
    <!-- grid md:grid-cols-2: Layout responsivo — 1 columna en móvil, 2 en desktop. -->
    <div
      v-if="configuracion"
      class="grid md:grid-cols-2 gap-4"
    >
      <div>

        <!-- Label descriptivo del campo de meta diaria. -->
        <label class="block mb-2">
          Meta Ventas Mesero Diaria ($)
        </label>

        <!-- Input numérico vinculado bidireccionalmente (v-model) con la propiedad -->
        <!-- personal_daily_goal del objeto configuración.                           -->
        <!-- v-model: Directiva de Vue que crea binding bidireccional — cuando el    -->
        <!-- usuario cambia el valor del input, se actualiza configuracion.value      -->
        <!-- .personal_daily_goal automáticamente, y viceversa.                      -->
        <!-- step="0.01": Permite valores decimales (centavos) en la meta.           -->
        <input
          v-model="configuracion.personal_daily_goal"
          type="number"
          step="0.01"
          class="w-full bg-black/20 p-3 rounded-xl border border-white/10"
        />

      </div>

    </div>

    <!-- ========================================================================= -->
    <!-- SECCIÓN: BOTÓN GUARDAR CONFIGURACIÓN                                      -->
    <!-- ========================================================================= -->
    <!-- @click="guardarConfiguracion": Escucha el evento click y llama a la       -->
    <!-- función guardarConfiguracion() que envía la meta actualizada al backend.   -->
    <!-- Estilos: fondo verde con efecto hover más claro, bordes redondeados.      -->
    <button
      @click="guardarConfiguracion"
      class="mt-6 bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold"
    >
      Guardar Configuración
    </button>

    <!-- Separador visual entre la configuración global y la sección de reglas. -->
    <hr class="my-8 border-gray-700">

      <!-- ========================================================================= -->
      <!-- SECCIÓN: REGLAS DE BONOS — TÍTULO                                         -->
      <!-- ========================================================================= -->
      <h3
        class="text-xl font-bold mb-4"
      >
        Reglas de Bonos
      </h3>

      <!-- ========================================================================= -->
      <!-- SECCIÓN: FORMULARIO DE CREACIÓN DE NUEVA REGLA                            -->
      <!-- ========================================================================= -->
      <!-- Grid de 4 columnas (en desktop) con los campos necesarios para definir    -->
      <!-- una nueva regla de bonificación. Cada input usa v-model para binding       -->
      <!-- bidireccional con las propiedades del objeto reactivo nuevaRegla.          -->
      <div
        class="grid md:grid-cols-4 gap-3 mb-6"
      >

        <!-- Input: Nombre del nivel de bonificación (ej: "Bronce", "Plata", "Oro") -->
        <!-- v-model="nuevaRegla.level_name": vincula el valor al estado reactivo.   -->
        <input
          v-model="
            nuevaRegla.level_name
          "
          placeholder="Nivel"
          class="glass-panel p-6 shadow-xl p-3 rounded-xl"
        />

        <!-- Input: Porcentaje mínimo de cumplimiento de meta para aplicar esta regla -->
        <input
          v-model="
            nuevaRegla.min_percentage
          "
          type="number"
          placeholder="% mínimo"
          class="glass-panel p-6 shadow-xl p-3 rounded-xl"
        />

        <!-- Input: Porcentaje máximo de cumplimiento de meta para aplicar esta regla -->
        <input
          v-model="
            nuevaRegla.max_percentage
          "
          type="number"
          placeholder="% máximo"
          class="glass-panel p-6 shadow-xl p-3 rounded-xl"
        />

        <!-- Input: Factor de bonificación en porcentaje (ej: 5 = 5% de bono)        -->
        <!-- step="1": solo permite valores enteros para el factor.                   -->
        <input
          v-model="
            nuevaRegla.bonus_factor
          "
          type="number"
          step="1"
          placeholder="Factor (%)"
          class="glass-panel p-6 shadow-xl p-3 rounded-xl"
        />

      </div>

      <!-- ========================================================================= -->
      <!-- SECCIÓN: BOTÓN CREAR NUEVA REGLA                                          -->
      <!-- ========================================================================= -->
      <!-- @click="crearRegla": Llama a la función que inserta la nueva regla en la  -->
      <!-- base de datos, limpia el formulario y recarga la tabla de reglas.          -->
      <button
        @click="crearRegla"
        class="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold mb-6"
      >
        Agregar Regla
      </button>
      
      <!-- ========================================================================= -->
      <!-- SECCIÓN: TABLA DE REGLAS DE BONOS EXISTENTES                              -->
      <!-- ========================================================================= -->
      <!-- overflow-auto: Permite scroll horizontal si la tabla excede el ancho       -->
      <!-- disponible en pantallas pequeñas (diseño responsivo).                      -->

    <div class="overflow-auto">

      <!-- Tabla HTML estándar para mostrar las reglas de bonos configuradas. -->
      <table class="w-full">

        <!-- Encabezados de la tabla con las columnas de cada propiedad de la regla. -->
        <thead>

          <tr
            class="text-left border-b border-gray-700"
          >

            <th class="p-3">
              Nivel
            </th>

            <th class="p-3">
              % Mínimo
            </th>

            <th class="p-3">
              % Máximo
            </th>

            <th class="p-3">
              Factor Bono (%)
            </th>

            <th class="p-3">
              Acciones
            </th>

          </tr>

        </thead>

        <!-- ====================================================================== -->
        <!-- SECCIÓN: CUERPO DE LA TABLA — ITERACIÓN CON v-for                      -->
        <!-- ====================================================================== -->
        <tbody>

          <!-- v-for="regla in reglasBonos": Directiva de iteración de Vue.          -->
          <!-- Renderiza un <tr> por cada elemento del array reactivo reglasBonos.    -->
          <!-- :key="regla.id_reglas": Clave única obligatoria para que Vue pueda     -->
          <!-- rastrear eficientemente cada fila en el DOM virtual (Virtual DOM) y    -->
          <!-- aplicar actualizaciones mínimas al DOM real (algoritmo de diffing).    -->
          <tr
            v-for="regla in reglasBonos"
            :key="regla.id_reglas"
            class="border-b border-gray-800"
          >

            <!-- Columna: Nombre del nivel con badge visual (fondo ámbar redondeado) -->
            <td class="p-3">

              <span
                class="bg-amber-600 px-3 py-1 rounded-full font-bold"
              >
                {{ regla.level_name }}
              </span>

            </td>

            <!-- Columna: Porcentaje mínimo — Interpolación {{ }} para mostrar datos -->
            <td class="p-3">
              {{ regla.min_percentage }}%
            </td>

            <!-- Columna: Porcentaje máximo -->
            <td class="p-3">
              {{ regla.max_percentage }}%
            </td>

            <!-- Columna: Factor de bono — text-green-400 para destacar visualmente -->
            <td class="p-3 text-green-400 font-bold">
              {{ regla.bonus_factor }}%
            </td>

            <!-- ================================================================== -->
            <!-- Columna: Botones de acción (Editar / Eliminar)                     -->
            <!-- ================================================================== -->
            <!-- flex gap-2: Layout horizontal con espaciado entre botones.         -->
            <td class="p-3 flex gap-2">

              <!-- @click="editarRegla(regla)": Pasa el objeto completo de la regla -->
              <!-- a la función editarRegla(), que lo copia al estado del modal.     -->
              <button
                @click="editarRegla(regla)"
                class="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-xl font-bold"
              >
                Editar
              </button>

              <!-- @click="eliminarRegla(regla.id_reglas)": Pasa solo el ID para    -->
              <!-- identificar la regla a eliminar. La función pide confirmación.    -->
              <button
                @click="eliminarRegla(regla.id_reglas)"
                class="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-xl font-bold"
              >
                Eliminar
              </button>

            </td>

          </tr>

        </tbody>

      </table>

    </div>

    <!-- ========================================================================= -->
    <!-- SECCIÓN: MODAL DE EDICIÓN DE REGLA                                        -->
    <!-- ========================================================================= -->
    <!-- Patrón Modal: Un overlay a pantalla completa con un formulario centrado.   -->
    <!--                                                                           -->
    <!-- v-if="reglaEditando": El modal solo se renderiza en el DOM cuando hay una  -->
    <!-- regla en estado de edición. Cuando reglaEditando es null (al cancelar o    -->
    <!-- guardar), Vue destruye completamente el nodo del DOM (a diferencia de      -->
    <!-- v-show que solo lo oculta con CSS display:none).                           -->
    <!--                                                                           -->
    <!-- fixed inset-0: Posiciona el overlay sobre toda la ventana del navegador.   -->
    <!-- bg-black/70: Fondo semitransparente oscuro (70% opacidad) para dar         -->
    <!-- contraste y enfoque al formulario del modal.                              -->
    <!-- z-50: Z-index alto para asegurar que el modal esté por encima de todo.    -->
    <!-- flex items-center justify-center: Centra el contenido del modal.          -->

    <div
      v-if="reglaEditando"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >

      <!-- Contenedor del formulario del modal con fondo oscuro sólido. -->
      <!-- w-[500px]: Ancho fijo usando la sintaxis de valores arbitrarios de Tailwind. -->
      <div
        class="bg-[#1b1b1b] p-8 rounded-3xl w-[500px]"
      >

        <h2
          class="text-2xl font-bold mb-6"
        >
          Editar Regla
        </h2>

        <!-- Formulario de edición con espaciado vertical entre campos (space-y-4). -->
        <div class="space-y-4">

          <!-- Input: Nombre del nivel — v-model vinculado a reglaEditando.level_name -->
          <!-- que es la copia de la regla original (edición no destructiva).          -->
          <input
            v-model="reglaEditando.level_name"
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          />

          <!-- Input: Porcentaje mínimo de la regla en edición. -->
          <input
            v-model="reglaEditando.min_percentage"
            type="number"
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          />

          <!-- Input: Porcentaje máximo de la regla en edición. -->
          <input
            v-model="reglaEditando.max_percentage"
            type="number"
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          />

          <!-- Label y Input: Factor de bonificación de la regla en edición. -->
          <label class="block text-gray-400">Factor Bono (%)</label>
          <input
            v-model="reglaEditando.bonus_factor"
            type="number"
            step="1"
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          />

          <!-- ================================================================== -->
          <!-- Botones de acción del modal: Guardar y Cancelar                    -->
          <!-- ================================================================== -->
          <!-- flex gap-3: Distribuye los botones horizontalmente con espaciado.   -->
          <!-- flex-1: Cada botón ocupa el mismo ancho (distribución equitativa).  -->
          <div class="flex gap-3">

            <!-- @click="guardarRegla": Persiste los cambios y cierra el modal.   -->
            <button
              @click="guardarRegla"
              class="flex-1 bg-green-600 py-3 rounded-xl font-bold"
            >
              Guardar
            </button>

            <!-- @click="reglaEditando = null": Cierra el modal sin guardar       -->
            <!-- descartando los cambios. Al poner null, v-if destruye el modal.  -->
            <button
              @click="reglaEditando = null"
              class="flex-1 bg-red-600 py-3 rounded-xl font-bold"
            >
              Cancelar
            </button>

          </div>

        </div>

      </div>

    </div>

  </div>

</template>
