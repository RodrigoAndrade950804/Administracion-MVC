<!-- =========================================================================
  ARCHIVO: SupervisorDashboard.vue
  =========================================================================
  PROPÓSITO:
    Panel de control ("Dashboard") para el rol de SUPERVISOR del sistema
    "Aroma & Grano". Este componente proporciona una vista ejecutiva de:
      1. Estado de todas las mesas del restaurante (libre / ocupada).
      2. Ventas del día actual vs. ventas de ayer (comparativa porcentual).
      3. Progreso semanal hacia la meta MADI (Modelo de Asignación
         Dinámica de Incentivos), con barra de progreso visual.
      4. Ranking de meseros ordenados por ventas diarias con categoría
         de bono (Sin Bono, Bronce, Plata, Oro).
      5. Indicador de Happy Hour activo/inactivo con efectos visuales.

  PATRONES APLICADOS:
    ► Observer (Supabase Realtime):
        - Tres canales WebSocket escuchan cambios en las tablas `mesas`,
          `pedidos` y `madi_config` para refrescar la UI automáticamente.
    ► Facade (Servicios):
        - Las funciones de servicio (`getMesas`, `getMeserosConVentas`, etc.)
          encapsulan toda la complejidad de las queries a Supabase, exponiendo
          al componente una interfaz simple tipo `getX()`.
    ► Store (Pinia – happyHourStore):
        - Centraliza el estado del Happy Hour para que múltiples componentes
          (SupervisorDashboard, MeseroPOS, AdminPanel) lean la misma fuente
          de verdad sin duplicar lógica.

  TECNOLOGÍAS:
    Vue 3 Composition API (<script setup>) · Pinia · Supabase Realtime ·
    Tailwind CSS · Vite

  FLUJO DE DATOS:
    ┌─────────────┐    Realtime     ┌───────────────────────┐
    │  Supabase   │ ──────────────► │ SupervisorDashboard   │
    │  (Backend)  │ ◄────────────── │ (Este componente)     │
    └─────────────┘    Queries      └───────────────────────┘
           ▲                                │
           │           ┌────────────────────┘
           │           ▼
    ┌──────────────────────┐
    │  Pinia Stores        │
    │  (happyHourStore,    │
    │   authStore)         │
    └──────────────────────┘
  ========================================================================= -->

<script setup>
// =========================================================================
// SECCIÓN: IMPORTACIONES
// =========================================================================

/**
 * IMPORTACIONES DE VUE 3 (Composition API)
 * -----------------------------------------
 * - ref():        Crea una variable reactiva primitiva. Cuando su `.value`
 *                 cambia, Vue re-renderiza automáticamente los elementos
 *                 del template que la usan.
 * - computed():   Crea una propiedad derivada que se recalcula solo cuando
 *                 sus dependencias reactivas cambian (memoización automática).
 * - onMounted():  Hook del ciclo de vida que se ejecuta UNA VEZ después de
 *                 que el DOM del componente se ha insertado en la página.
 *                 Ideal para cargas iniciales de datos y suscripciones.
 * - onUnmounted():Hook del ciclo de vida que se ejecuta justo ANTES de que
 *                 el componente se destruya. Crítico para liberar recursos
 *                 (canales WebSocket, timers) y evitar fugas de memoria.
 */
import { ref, computed, onMounted, onUnmounted } from "vue";

/**
 * SERVICIO DE MESAS (Patrón Facade)
 * -----------------------------------
 * `getMesas()` encapsula la query `supabase.from('mesas').select('*')`,
 * devolviendo un array de objetos mesa con { id_mesa, numero_mesa, status }.
 * El supervisor NO necesita conocer la estructura de la query SQL.
 */
import { getMesas } from "../services/mesasService";

/**
 * VUE ROUTER – Navegación programática
 * --------------------------------------
 * `useRouter()` provee acceso al router para redirigir al usuario
 * (ej. `router.push('/')` para volver al login tras cerrar sesión).
 */
import { useRouter } from "vue-router";

/**
 * PINIA STORE – Autenticación (authStore)
 * -----------------------------------------
 * Store global que almacena los datos del usuario autenticado:
 *   - `authStore.user`: Objeto con { id_user, first_name, last_name, role }
 *   - `authStore.logout()`: Limpia la sesión y tokens de Supabase Auth.
 * Permite mostrar el nombre del supervisor en turno y cerrar sesión.
 */
import { useAuthStore } from "../stores/authStore";

/**
 * CLIENTE SUPABASE – Acceso directo a la base de datos
 * ------------------------------------------------------
 * Instancia singleton del cliente Supabase configurado con las credenciales
 * del proyecto. Se usa aquí para:
 *   1. Crear canales Realtime (WebSocket) con `supabase.channel()`.
 *   2. Ejecutar queries directas (`supabase.from('pedidos').select(...)`).
 *   3. Limpiar canales al desmontar con `supabase.removeChannel()`.
 */
import { supabase } from "../services/supabase";

/**
 * PINIA STORE – Happy Hour (happyHourStore)
 * -------------------------------------------
 * Store centralizado que gestiona el estado del sistema "Happy Hour":
 *   - `happyHourStore.config`: Configuración actual { is_active, waiter_multiplier, weekly_sales_trigger }
 *   - `happyHourStore.ventasSemanales`: Total acumulado de ventas en la semana actual.
 *   - `happyHourStore.loadConfig()`: Carga la configuración desde Supabase.
 *   - `happyHourStore.loadVentasSemanales()`: Calcula el total semanal de pedidos cerrados.
 *   - `happyHourStore.iniciarRealtimeHappyHour()`: Suscribe a cambios en la tabla de configuración.
 *
 * DISEÑO: Al ser un store Pinia, cualquier componente puede leer `happyHourStore.config.is_active`
 * y reaccionar visualmente (ej. cambio de color neón verde cuando Happy Hour está activo).
 */
import { useHappyHourStore } from "../stores/happyHourStore";

/**
 * SERVICIO MADI – Modelo de Asignación Dinámica de Incentivos
 * -------------------------------------------------------------
 * Funciones que encapsulan la lógica de negocio del sistema de bonificaciones:
 *   - `getConfiguracionMadi()`: Trae la fila activa de la tabla `madi_config`
 *     con campos como `personal_daily_goal` (meta diaria por mesero).
 *   - `suscribirConfiguracionMadi(callback)`: Crea un canal Realtime que
 *     ejecuta el `callback` cada vez que un admin modifica la configuración
 *     MADI (ej. cambia la meta de $100 a $150).
 *     → Patrón Observer: el componente se "suscribe" a cambios externos.
 *   - `getReglasBonos()`: Trae las reglas de niveles de bono (ej. Bronce ≥ 60%,
 *     Plata ≥ 80%, Oro ≥ 100%).
 */
import { getConfiguracionMadi, suscribirConfiguracionMadi, getReglasBonos } from "../services/madiService";

/**
 * SERVICIO DE USUARIOS – Ranking de meseros
 * -------------------------------------------
 * `getMeserosConVentas()` ejecuta una query que trae todos los usuarios con
 * rol "mesero" junto con sus pedidos del día actual (JOIN con tabla `pedidos`).
 * Retorna un array de objetos { first_name, last_name, pedidos: [...] }.
 *
 * LÓGICA DE NEGOCIO: Este componente toma esos datos crudos y calcula:
 *   1. Ventas totales = SUM(pedido.total_amount) por cada mesero.
 *   2. Porcentaje de cumplimiento = (ventas / meta_diaria) * 100.
 *   3. Categoría de bono = determinada por las reglas dinámicas de MADI.
 */
import { getMeserosConVentas } from "../services/usuariosService";

// =========================================================================
// SECCIÓN: ESTADO REACTIVO (Variables de la interfaz)
// =========================================================================

/**
 * @description Array reactivo que almacena todas las mesas del restaurante.
 * Cada objeto tiene: { id_mesa, numero_mesa, status: 'libre'|'ocupada' }.
 * Se actualiza en tiempo real mediante el canal WebSocket de mesas.
 * @type {import('vue').Ref<Array<{id_mesa: number, numero_mesa: string, status: string}>>}
 */
const mesas = ref([]);

/**
 * @description Array reactivo con el ranking de meseros calculado.
 * Cada objeto tiene: { nombre, ventas, porcentaje, categoria }.
 * Se recalcula cada vez que llega un evento de cambio en la tabla `pedidos`.
 * @type {import('vue').Ref<Array<{nombre: string, ventas: number, porcentaje: number, categoria: string}>>}
 */
const meseros = ref([]);

/**
 * @description Objeto reactivo con la configuración MADI activa.
 * Contiene campos como `personal_daily_goal` (meta diaria por mesero)
 * y `is_active` (si el sistema de bonificación está habilitado).
 * @type {import('vue').Ref<Object|null>}
 */
const madiConfig = ref(null);

/**
 * @description Instancia del store Pinia para Happy Hour.
 * Provee acceso reactivo a `config`, `ventasSemanales`, y métodos de carga.
 * Al ser Pinia, su estado persiste mientras la aplicación esté activa,
 * incluso si el usuario navega entre páginas (a diferencia de refs locales).
 */
const happyHourStore = useHappyHourStore();

/**
 * @description Array reactivo con las reglas de bonificación MADI.
 * Cada regla define: { level_name: 'Bronce'|'Plata'|'Oro', min_percentage: number }.
 * Se usa para asignar la categoría del mesero según su porcentaje de cumplimiento.
 * Las reglas son dinámicas: un administrador puede cambiarlas sin tocar código.
 * @type {import('vue').Ref<Array<{level_name: string, min_percentage: number}>>}
 */
const reglas = ref([]);

/**
 * @description Total de ventas (pedidos cerrados) del día actual en curso.
 * Se calcula filtrando pedidos con `pedido_date >= hoy a las 00:00`.
 * @type {import('vue').Ref<number>}
 */
const ventasHoy = ref(0);

/**
 * @description Total de ventas del día anterior (ayer).
 * Sirve para la comparativa porcentual que muestra si las ventas
 * aumentaron o bajaron respecto al día anterior.
 * @type {import('vue').Ref<number>}
 */
const ventasAyer = ref(0);

/**
 * @description Fecha y hora actual formateada en español para mostrar en la UI.
 * Se actualiza cada segundo mediante un `setInterval` iniciado en `onMounted`.
 * Formato ejemplo: "lunes, 7 de julio de 2025, 14:30:22"
 * @type {import('vue').Ref<string>}
 */
const fechaActual = ref(new Date().toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }));

/**
 * @description Referencia al timer de setInterval para actualizar la fecha.
 * Se guarda en variable `let` (no `ref`, porque no necesita reactividad)
 * para poder limpiarlo con `clearInterval(timer)` en `onUnmounted`.
 * @type {number|undefined}
 */
let timer;

// =========================================================================
// SECCIÓN: CANALES REALTIME (Patrón Observer – WebSocket)
// =========================================================================

/**
 * @description Referencia al canal WebSocket de la configuración MADI.
 * Se usa para desuscribirse en `onUnmounted` y evitar fugas de memoria.
 * PATRÓN OBSERVER: Supabase actúa como "Subject" (fuente de eventos),
 * y este componente como "Observer" (escucha cambios y reacciona).
 * @type {Object|null}
 */
let canalMadi = null;

/**
 * @description Referencia al canal WebSocket de la tabla `pedidos`.
 * Escucha INSERT, UPDATE y DELETE para refrescar el ranking y ventas.
 * @type {Object|null}
 */
let canalPedidos = null;

// =========================================================================
// SECCIÓN: CARGA DE DATOS (Funciones asíncronas)
// =========================================================================

/**
 * @description Carga la lista completa de mesas desde el backend (Patrón Facade).
 * Llama a `getMesas()` del servicio, que internamente ejecuta:
 *   `supabase.from('mesas').select('*').order('numero_mesa')`
 * El componente solo recibe el array limpio, sin conocer la query.
 *
 * @returns {Promise<void>}
 */
const loadMesas = async () => {
  try {
    mesas.value = await getMesas();
  } catch (error) {
    console.error(error);
  }
};

/**
 * @description Carga la configuración MADI y las reglas de bonificación.
 *
 * FLUJO:
 *   1. `getConfiguracionMadi()` → trae la fila activa de `madi_config`.
 *   2. `getReglasBonos()` → trae las reglas de niveles (Bronce, Plata, Oro)
 *      ordenadas por `min_percentage` ascendente para que la iteración
 *      en `loadRankingMeseros` asigne siempre la categoría más alta alcanzada.
 *
 * LÓGICA DE NEGOCIO:
 *   La separación entre "configuración" y "reglas" permite al administrador
 *   cambiar la meta diaria sin alterar los niveles de bono, y viceversa.
 *
 * @returns {Promise<void>}
 */
const loadMadi = async () => {
  try {
    madiConfig.value = await getConfiguracionMadi();
    reglas.value = await getReglasBonos();
  } catch (error) {
    console.error(error);
  }
};

/**
 * @description Calcula el ranking de meseros basado en ventas actuales vs meta diaria MADI.
 *
 * ALGORITMO:
 *   1. Obtiene todos los meseros con sus pedidos del día (`getMeserosConVentas()`).
 *   2. Para cada mesero, suma el `total_amount` de todos sus pedidos → `ventas`.
 *   3. Calcula `porcentaje = (ventas / meta_diaria) * 100`.
 *   4. Itera las reglas de bonos (ordenadas de menor a mayor porcentaje mínimo).
 *      Si el mesero alcanza el `min_percentage` de una regla, se le asigna ese `level_name`.
 *      Como las reglas están ordenadas ascendentemente, la última regla que "pase"
 *      será la categoría más alta (ej. si pasa Bronce Y Plata, queda en Plata).
 *   5. Ordena el array final por ventas descendentes para crear un ranking visual.
 *
 * EJEMPLO DE REGLAS:
 *   - Bronce: min_percentage = 60  → Vende ≥ 60% de la meta → Bronce
 *   - Plata:  min_percentage = 80  → Vende ≥ 80% de la meta → Plata
 *   - Oro:    min_percentage = 100 → Vende ≥ 100% de la meta → Oro
 *
 * @returns {Promise<void>}
 */
const loadRankingMeseros = async () => {
  try {
    const usuarios = await getMeserosConVentas();
    const meta = Number(madiConfig.value?.personal_daily_goal || 100);

    meseros.value = usuarios.map(usuario => {
      // Suma total de los montos de pedidos del mesero.
      // `reduce()` acumula cada `total_amount` convirtiéndolo a número.
      const ventas = usuario.pedidos?.reduce((total, pedido) => total + Number(pedido.total_amount), 0) || 0;
      const porcentaje = (ventas / meta) * 100;

      // Asignación de categoría basada en cumplimiento dinámico.
      // Se itera secuencialmente: la última regla cuyo `min_percentage`
      // sea ≤ al porcentaje del mesero "gana" y sobrescribe la categoría.
      let categoria = "Sin Bono";
      for (const regla of reglas.value) {
        if (porcentaje >= regla.min_percentage) {
          categoria = regla.level_name;
        }
      }

      return {
        nombre: `${usuario.first_name || ""} ${usuario.last_name || ""}`,
        ventas: Number(ventas || 0),
        porcentaje: Number(porcentaje || 0),
        categoria
      };
    }).sort((a, b) => b.ventas - a.ventas); // Orden descendente por ventas.
  } catch (error) {
    console.error(error);
  }
};

// =========================================================================
// SECCIÓN: CARGA DE DATOS DIARIOS (Comparativa Hoy vs. Ayer)
// =========================================================================

/**
 * @description Calcula las ventas totales de HOY y de AYER para la tarjeta
 * de comparativa porcentual en el dashboard.
 *
 * ESTRATEGIA DE QUERY:
 *   En lugar de hacer 2 queries separadas (una para hoy, otra para ayer),
 *   hace UNA sola query con `gte('pedido_date', ayer.toISOString())` que
 *   trae todos los pedidos cerrados desde ayer a las 00:00. Luego clasifica
 *   cada pedido por fecha en JavaScript (más eficiente en red).
 *
 * FILTROS:
 *   - `.eq("status", "cerrado")`: Solo cuenta pedidos ya cobrados, no los
 *     que aún están abiertos en alguna mesa.
 *   - `.gte("pedido_date", ayer)`: Limita la carga a máximo 48 horas de datos.
 *
 * @returns {Promise<void>}
 */
const loadVentasDiarias = async () => {
  try {
    // Calcula los límites de tiempo: "hoy a las 00:00" y "ayer a las 00:00".
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);

    // Query única que trae pedidos cerrados de las últimas 48 horas.
    const { data, error } = await supabase
      .from("pedidos")
      .select("total_amount, pedido_date")
      .eq("status", "cerrado")
      .gte("pedido_date", ayer.toISOString());

    if (error) throw error;

    let totalHoy = 0;
    let totalAyer = 0;

    // Clasifica cada pedido según su fecha: si es de hoy o de ayer.
    data.forEach((p) => {
      const fecha = new Date(p.pedido_date);
      if (fecha >= hoy) {
        totalHoy += Number(p.total_amount);
      } else if (fecha >= ayer && fecha < hoy) {
        totalAyer += Number(p.total_amount);
      }
    });

    ventasHoy.value = totalHoy;
    ventasAyer.value = totalAyer;
  } catch (err) {
    console.error("Error obteniendo ventas diarias:", err);
  }
};

// =========================================================================
// SECCIÓN: SUSCRIPCIONES REALTIME (Patrón Observer – WebSockets)
// =========================================================================
// Estas funciones implementan el PATRÓN OBSERVER mediante Supabase Realtime:
//
// ┌──────────────────┐   INSERT/UPDATE/DELETE   ┌──────────────────────────┐
// │  Tabla Supabase  │ ─────────────────────►   │  Callback del Observer   │
// │  (Subject)       │   vía WebSocket          │  (Este componente)       │
// └──────────────────┘                          └──────────────────────────┘
//
// BENEFICIO: El dashboard NUNCA muestra datos obsoletos. Si otro usuario
// (mesero, admin) realiza un cambio en cualquier pestaña o dispositivo,
// este componente se actualiza automáticamente sin necesidad de "refresh".
// =========================================================================

/**
 * @description Suscribe a cambios en la tabla `pedidos` vía WebSocket.
 *
 * EVENTO ESCUCHADO: `"*"` (INSERT, UPDATE, DELETE – cualquier operación).
 *
 * CALLBACKS ENCADENADOS:
 *   1. `loadRankingMeseros()` → Recalcula el ranking porque un pedido nuevo
 *      o cerrado cambia las ventas totales de algún mesero.
 *   2. `happyHourStore.loadVentasSemanales()` → Recalcula el progreso semanal
 *      porque una venta cerrada suma al acumulado de la semana.
 *   3. `loadVentasDiarias()` → Actualiza la comparativa hoy vs. ayer.
 *
 * @returns {void}
 */
const iniciarRealtimePedidos = () => {
  canalPedidos = supabase
    .channel("pedidos-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, async () => {
      await loadRankingMeseros();
      await happyHourStore.loadVentasSemanales();
      await loadVentasDiarias();
    })
    .subscribe();
};

/**
 * @description Suscribe a cambios en la configuración MADI vía WebSocket.
 *
 * Usa la función `suscribirConfiguracionMadi()` del servicio MADI, que
 * internamente crea un canal sobre la tabla `madi_config`. Cuando un
 * administrador cambia la meta diaria o activa/desactiva MADI, el callback
 * recarga la configuración y recalcula el ranking con las nuevas metas.
 *
 * EJEMPLO DE CASO DE USO:
 *   El admin cambia la meta diaria de $100 a $150 → el canal dispara →
 *   `loadMadi()` trae la nueva meta → `loadRankingMeseros()` recalcula
 *   los porcentajes → las categorías de los meseros pueden cambiar.
 *
 * @returns {void}
 */
const iniciarRealtimeMadi = () => {
  canalMadi = suscribirConfiguracionMadi(async () => {
    await loadMadi();
    await loadRankingMeseros();
  });
};

/**
 * @description Suscribe a cambios en la tabla `mesas` vía WebSocket.
 *
 * Refresca el grid visual de mesas cuando alguna mesa cambia de estado
 * (ej. un mesero abre un pedido y la mesa pasa de 'libre' a 'ocupada').
 * El canal escucha TODOS los eventos (`"*"`) de la tabla `mesas`.
 *
 * NOTA: Este canal NO se guarda en variable porque no requiere lógica
 * de desuscripción especial (se limpia automáticamente al destruir el componente
 * si se necesitase, pero por consistencia se podría guardar en una variable).
 *
 * @returns {void}
 */
const iniciarRealtime = () => {
  supabase
    .channel("mesas-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "mesas" }, async () => {
      await loadMesas();
    })
    .subscribe();
};

// =========================================================================
// SECCIÓN: CICLO DE VIDA DE VUE (Lifecycle Hooks)
// =========================================================================

/**
 * onMounted – Se ejecuta UNA VEZ cuando el componente se monta en el DOM.
 *
 * SECUENCIA DE INICIALIZACIÓN:
 *   1. Carga datos estáticos (mesas, MADI, ranking, Happy Hour, ventas).
 *   2. Inicia las 4 suscripciones Realtime (mesas, pedidos, MADI, Happy Hour).
 *   3. Inicia el timer para actualizar la fecha/hora cada segundo.
 *
 * ORDEN IMPORTANTE:
 *   - `loadMadi()` ANTES de `loadRankingMeseros()` porque el ranking necesita
 *     la meta diaria que viene de MADI para calcular porcentajes.
 *   - Los canales Realtime se inician DESPUÉS de la carga inicial para evitar
 *     que un evento llegue antes de que los datos base estén listos.
 */
onMounted(async () => {
  await loadMesas();
  await loadMadi();
  await loadRankingMeseros();
  await happyHourStore.loadConfig();
  await happyHourStore.loadVentasSemanales();
  await loadVentasDiarias();
  iniciarRealtime();
  iniciarRealtimePedidos();
  iniciarRealtimeMadi();
  happyHourStore.iniciarRealtimeHappyHour();

  // Timer que actualiza el reloj de la UI cada segundo.
  // Se formatea en español con día de la semana, fecha completa y hora.
  timer = setInterval(() => {
    fechaActual.value = new Date().toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);
});

/**
 * onUnmounted – Se ejecuta justo ANTES de que el componente se destruya.
 *
 * PREVENCIÓN DE MEMORY LEAKS:
 *   - `supabase.removeChannel()`: Cierra la conexión WebSocket del canal.
 *     Sin esto, el canal seguiría activo en memoria ejecutando callbacks
 *     sobre un componente que ya no existe (Memory Leak clásico en SPAs).
 *   - `clearInterval(timer)`: Detiene el timer del reloj.
 *
 * BUENA PRÁCTICA: Siempre limpiar suscripciones y timers en `onUnmounted`.
 */
onUnmounted(() => {
  if (canalPedidos) supabase.removeChannel(canalPedidos);
  if (canalMadi) supabase.removeChannel(canalMadi);
  if (timer) clearInterval(timer);
});

// =========================================================================
// SECCIÓN: UTILIDADES Y NAVEGACIÓN
// =========================================================================

/**
 * @description Instancia del Vue Router para navegación programática.
 * Se usa en `logout()` para redirigir al usuario a la página de login.
 */
const router = useRouter();

/**
 * @description Instancia del store de autenticación (Pinia).
 * Provee acceso al usuario actual y método de cierre de sesión.
 */
const authStore = useAuthStore();

/**
 * @description Cierra la sesión del supervisor y redirige al login.
 * Primero limpia la sesión en el store (tokens, datos del usuario),
 * luego redirige a la ruta raíz "/" que es la página de login.
 * @returns {void}
 */
const logout = () => {
  authStore.logout();
  router.push("/");
};

// =========================================================================
// SECCIÓN: PROPIEDADES COMPUTADAS (Derivaciones reactivas)
// =========================================================================
// Las `computed()` son funciones que se recalculan AUTOMÁTICAMENTE cuando
// sus dependencias reactivas cambian. Vue las cachea internamente (memoización)
// para evitar recálculos innecesarios. Son ideales para transformaciones de
// datos que dependen del estado reactivo.
// =========================================================================

/**
 * @description Progreso porcentual de la meta de ventas semanal para la barra
 * de progreso MADI del panel lateral.
 *
 * CÁLCULO: (ventasSemanales / weekly_sales_trigger) * 100, con tope en 100%.
 *
 * DEPENDENCIAS REACTIVAS:
 *   - `happyHourStore.config` → si la configuración cambia (ej. nueva meta).
 *   - `happyHourStore.ventasSemanales` → si se cierra un nuevo pedido.
 *
 * `Math.min(..., 100)` evita que la barra visual se desborde más allá del 100%.
 *
 * @returns {number} Porcentaje de 0 a 100.
 */
const progresoVentas = computed(() => {
  if (!happyHourStore.config) return 0;
  const totalVentas = Number(happyHourStore.ventasSemanales || 0);
  const meta = Number(happyHourStore.config.weekly_sales_trigger || 100);
  if (meta <= 0) return 0;
  return Math.min((totalVentas / meta) * 100, 100);
});

/**
 * @description Calcula la comparativa de ventas de hoy vs. ayer y devuelve
 * un objeto con texto descriptivo y clase CSS para el color.
 *
 * CASOS:
 *   1. Ayer no hubo ventas → texto neutral gris.
 *   2. Hoy > Ayer → texto verde con porcentaje de aumento y emoji 📈.
 *   3. Hoy < Ayer → texto rojo con porcentaje de disminución y emoji 📉.
 *   4. Hoy === Ayer → texto amarillo indicando igualdad ➖.
 *
 * FÓRMULA: diff = ventasHoy - ventasAyer; porcentaje = (diff / ventasAyer) * 100
 *
 * @returns {{texto: string, clase: string}} Objeto con texto y clase CSS Tailwind.
 */
const comparativaVentas = computed(() => {
  if (ventasAyer.value === 0) return { texto: 'Sin ventas ayer para comparar', clase: 'text-gray-400' };
  const diff = ventasHoy.value - ventasAyer.value;
  const porcentaje = (diff / ventasAyer.value) * 100;
  if (diff > 0) {
    return { texto: `Aumentó ${porcentaje.toFixed(1)}% 📈`, clase: 'text-green-500 font-bold' };
  } else if (diff < 0) {
    return { texto: `Bajó ${Math.abs(porcentaje).toFixed(1)}% 📉`, clase: 'text-red-500 font-bold' };
  } else {
    return { texto: `Igual que ayer ➖`, clase: 'text-yellow-500 font-bold' };
  }
});

/**
 * @description Genera el nombre completo del supervisor para mostrarlo en el header.
 * Si el usuario no tiene `first_name` (dato incompleto), muestra "Supervisor" por defecto.
 *
 * DEPENDENCIA REACTIVA: `authStore.user` → si el usuario cambia (poco probable
 * en esta vista, pero la computed lo soporta).
 *
 * @returns {string} Nombre completo o "Supervisor" como fallback.
 */
const nombreSupervisor = computed(() => {
  return authStore.user?.first_name 
    ? `${authStore.user.first_name} ${authStore.user.last_name || ''}` 
    : 'Supervisor';
});

/**
 * @description Calcula cuánto falta para alcanzar la meta semanal MADI.
 * Si ya se superó la meta (faltante negativo), retorna 0.
 *
 * FÓRMULA: faltante = meta_semanal - ventas_acumuladas
 *
 * CASO ESPECIAL: Cuando `faltante <= 0`, significa que la meta ya se alcanzó
 * y el Happy Hour debería estar (o haber sido) activado automáticamente.
 *
 * @returns {number} Monto en dólares que falta para la meta, o 0 si ya se alcanzó.
 */
const faltanteMadi = computed(() => {
  const meta = Number(happyHourStore.config?.weekly_sales_trigger || 0);
  const ventas = Number(happyHourStore.ventasSemanales || 0);
  const faltante = meta - ventas;
  return faltante > 0 ? faltante : 0;
});
</script>


<template>
  <!-- ========================================================================= -->
  <!-- SECCIÓN: CONTENEDOR PRINCIPAL DEL DASHBOARD                               -->
  <!-- ========================================================================= -->
  <!-- :class → Binding dinámico de clase: cuando Happy Hour está activo,         -->
  <!-- agrega un efecto de brillo verde (shadow) alrededor de toda la página      -->
  <!-- para dar feedback visual inmediato al supervisor.                          -->
  <div
    class="min-h-screen transition-colors duration-500 text-current p-6"
    :class="happyHourStore.config.is_active ? 'shadow-[0_0_60px_rgba(0,255,120,0.15)]' : ''"
  >

    <!-- ========================================================================= -->
    <!-- SECCIÓN: HEADER (Barra superior con título, indicador MADI y logout)      -->
    <!-- ========================================================================= -->
    <!-- Layout responsivo: en móvil es columna (flex-col), en desktop es fila     -->
    <!-- (md:flex-row). `gap-4` mantiene separación entre elementos.               -->

    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">

      <!-- Título principal del dashboard -->
      <div>
        <h1 class="text-4xl font-bold">
          Dashboard Supervisor
        </h1>

        <p class="text-gray-400">
          Monitoreo Operativo en Tiempo Real
        </p>

      </div>

    <!-- Contenedor de indicadores y acciones del header -->
    <div class="flex flex-wrap gap-4 w-full md:w-auto">

      <!-- ====== INDICADOR HAPPY HOUR ====== -->
      <!-- v-if: Renderiza este div SOLO si el Happy Hour está activo.               -->
      <!-- Muestra el multiplicador de bonos del mesero (ej. "x2", "x3").            -->
      <!-- El efecto `shadow-[0_0_20px_rgba(0,255,120,0.7)]` crea un brillo neón    -->
      <!-- verde que llama la atención del supervisor inmediatamente.                 -->
      <div
        v-if="
          happyHourStore.config.is_active
        "
        class="px-6 py-3 rounded-2xl font-bold bg-green-500 text-black shadow-[0_0_20px_rgba(0,255,120,0.7)]"
      >
        HAPPY HOUR x{{ happyHourStore.config.waiter_multiplier }}
      </div>

      <!-- v-else: Alternativa cuando Happy Hour NO está activo.                     -->
      <!-- Muestra un badge gris neutro indicando que MADI no ha sido activado aún.  -->
      <div
        v-else
        class="px-6 py-3 rounded-2xl font-bold bg-gray-700"
      >
        MADI INACTIVO
      </div>

      <!-- ====== BOTÓN CERRAR SESIÓN ====== -->
      <!-- @click: Ejecuta `logout()` que limpia authStore y redirige a "/".         -->
      <!-- Estilos: bg-red-600 con hover a bg-red-500, transición suave,             -->
      <!-- rounded-2xl para bordes redondeados consistentes con el diseño.           -->
      <button
        @click="logout"
        class="bg-red-600 hover:bg-red-500 transition px-5 py-3 rounded-2xl font-bold"
      >
        Cerrar Sesión
      </button>

    </div>

    </div>

    <!-- ========================================================================= -->
    <!-- SECCIÓN: TARJETAS MÉTRICAS DEL HEADER (4 KPIs principales)                -->
    <!-- ========================================================================= -->
    <!-- Grid responsivo: 1 columna en móvil, 2 en tablet, 4 en desktop (xl).      -->
    <!-- Cada tarjeta usa `glass-panel` (clase CSS global con efecto glassmorphism) -->
    <!-- y `border-l-4` con un color distinto para diferenciación visual rápida.    -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
      
      <!-- ====== CARD 1: Supervisor en Turno ====== -->
      <!-- Muestra el nombre del supervisor autenticado y la fecha/hora actual.       -->
      <!-- border-l-4 border-blue-500: Línea vertical azul para identificación.       -->
      <!-- `nombreSupervisor`: Computed que extrae first_name + last_name del auth.    -->
      <!-- `fechaActual`: Ref actualizada cada segundo con setInterval.                -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 border-blue-500">
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Supervisor en Turno</span>
        <span class="font-bold text-2xl text-white">{{ nombreSupervisor }}</span>
        <span class="text-sm text-gray-500 mt-2">{{ fechaActual }}</span>
      </div>

      <!-- ====== CARD 2: Ventas del Día ====== -->
      <!-- Muestra el total acumulado de ventas del día actual.                       -->
      <!-- `ventasHoy.toFixed(2)`: Formatea a 2 decimales (ej. "$1,234.56").          -->
      <!-- border-l-4 border-green-500: Línea vertical verde (positivo).              -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 border-green-500">
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Ventas del Día</span>
        <span class="font-bold text-3xl text-white">${{ ventasHoy.toFixed(2) }}</span>
      </div>

      <!-- ====== CARD 3: Comparativa Hoy vs. Ayer ====== -->
      <!-- Muestra si las ventas de hoy son mayores, menores o iguales a las de ayer. -->
      <!-- :class dinámico en border-l: Verde si vamos mejor que ayer, rojo si peor.  -->
      <!-- `comparativaVentas`: Computed que retorna {texto, clase} según la diff.     -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4" :class="ventasHoy - ventasAyer > 0 ? 'border-green-500' : 'border-red-500'">
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Rendimiento vs Ayer</span>
        <span class="font-bold text-xl mt-1" :class="comparativaVentas.clase">
          {{ comparativaVentas.texto }}
        </span>
        <span class="text-sm text-gray-500 mt-2">Ventas ayer: ${{ ventasAyer.toFixed(2) }}</span>
      </div>
      
      <!-- ====== CARD 4: Estado MADI Semanal ====== -->
      <!-- Tarjeta con efectos visuales especiales según el estado de MADI:           -->
      <!--   - ACTIVO: borde neón verde + sombra luminosa + fondo semitransparente.   -->
      <!--   - INACTIVO: borde ámbar con el monto faltante para alcanzar la meta.     -->
      <!-- `relative overflow-hidden`: Permite el overlay verde con `absolute inset-0`-->
      <!-- `pointer-events-none`: El overlay NO captura clicks (deja pasar al fondo). -->
      <!-- `z-10` en los spans: Asegura que el texto quede ENCIMA del overlay verde.  -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 relative overflow-hidden transition-colors duration-500"
           :class="happyHourStore.config.is_active ? 'border-neon-green shadow-[0_0_15px_rgba(0,255,120,0.4)]' : 'border-amber-500'">
        <!-- Overlay verde semitransparente cuando Happy Hour está activo -->
        <div v-if="happyHourStore.config.is_active" class="absolute inset-0 bg-green-500/10 pointer-events-none"></div>
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1 relative z-10">Estado MADI Semanal</span>
        <!-- v-if/v-else: Muestra "Activado 🔥" o el monto faltante según el estado -->
        <span v-if="happyHourStore.config.is_active" class="font-bold text-2xl text-neon-green relative z-10 mt-1 drop-shadow-md">Activado 🔥</span>
        <span v-else class="font-bold text-xl text-amber-500 relative z-10 mt-1">Faltan ${{ faltanteMadi.toFixed(2) }}</span>
        <span class="text-sm text-gray-500 mt-2 relative z-10">Ventas actuales: ${{ Number(happyHourStore.ventasSemanales || 0).toFixed(2) }}</span>
      </div>

    </div>

    <!-- ========================================================================= -->
    <!-- SECCIÓN: GRID PRINCIPAL (Mesas + Panel Lateral)                           -->
    <!-- ========================================================================= -->
    <!-- Layout de 3 columnas en desktop: mesas ocupa 2, panel lateral ocupa 1.    -->

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- ====================================================================== -->
      <!-- SECCIÓN: ESTADO DE MESAS (Columna izquierda, 2/3 del ancho)            -->
      <!-- ====================================================================== -->
      <!-- `lg:col-span-2`: En desktop ocupa 2 de las 3 columnas del grid.         -->

      <div class="lg:col-span-2">

        <div class="glass-panel transition-colors duration-500 rounded-3xl p-6">

          <h2 class="text-2xl font-bold mb-6">
            Estado de Mesas
          </h2>

          <!-- Grid de mesas: 2 columnas en móvil, 3 en tablet/desktop.            -->
          <div class="grid grid-cols-2 md:grid-cols-3 gap-5">

            <!-- ====== ITERACIÓN DE MESAS (v-for) ====== -->
            <!-- v-for: Itera sobre el array reactivo `mesas` y renderiza una       -->
            <!-- tarjeta visual por cada mesa del restaurante.                       -->
            <!-- :key: Vue necesita un identificador único para cada elemento        -->
            <!-- iterado. `id_mesa` garantiza que Vue reutilice y actualice los      -->
            <!-- nodos DOM correctamente cuando el array cambia.                     -->
            <!-- :class dinámico: Verde (bg-green-600) si la mesa está 'libre',     -->
            <!-- ámbar (bg-amber-500) si está 'ocupada'. Feedback visual inmediato.  -->
            <div
              v-for="mesa in mesas"
              :key="mesa.id_mesa"
              class="h-32 rounded-2xl flex flex-col items-center justify-center text-xl font-bold transition"
              :class="
                mesa.status === 'libre'
                  ? 'bg-green-600'
                  : 'bg-amber-500'
              "
            >
              <!-- Número de la mesa (ej. "Mesa 1", "Mesa 2") -->
              {{ mesa.numero_mesa }}

              <!-- Estado textual debajo del número -->
              <span class="text-sm mt-2">
                {{ mesa.status }}
              </span>

            </div>

          </div>

        </div>

      </div>

      <!-- ====================================================================== -->
      <!-- SECCIÓN: PANEL DERECHO (Progreso MADI + Ranking de Meseros)            -->
      <!-- ====================================================================== -->
      <!-- Ocupa la tercera columna del grid. `space-y-6` separa los 2 paneles.    -->

      <div class="space-y-6">

        <!-- ====== PANEL: PROGRESO MADI SEMANAL ====== -->
        <!-- Barra de progreso que muestra cuánto falta para alcanzar la meta       -->
        <!-- semanal de ventas que activa el Happy Hour automáticamente.             -->

        <div class="glass-panel transition-colors duration-500 rounded-3xl p-6">

          <!-- Título: se ilumina en verde neón cuando Happy Hour está activo -->
          <h2 :class="['text-xl font-bold mb-4', happyHourStore.config.is_active ? 'text-neon-green' : '']">
            Progreso MADI
          </h2>

          <!-- ====== BARRA DE PROGRESO VISUAL ====== -->
          <!-- Contenedor gris (bg-gray-700) con barra interna verde (bg-green-500). -->
          <!-- `:style="width:${progresoVentas}%"`: El ancho de la barra interna     -->
          <!-- se vincula dinámicamente al porcentaje calculado por la computed.       -->
          <!-- `transition-all duration-500`: Anima suavemente el cambio de ancho.    -->
          <div class="w-full bg-gray-700 rounded-full h-5">

          <div
            class="bg-green-500 h-5 rounded-full transition-all duration-500"
            :style="`width:${progresoVentas}%`"
          ></div>

        </div>

          <!-- Porcentaje numérico debajo de la barra -->
          <p :class="['text-center mt-3 text-sm font-bold', happyHourStore.config.is_active ? 'text-neon-green' : 'text-gray-400']">
            {{ Number(progresoVentas || 0).toFixed(0) }}%
            de la meta global de ventas
          </p>

          <!-- ====== DESGLOSE NUMÉRICO DEL PROGRESO ====== -->
          <!-- Tres filas con detalles: ventas acumuladas, meta y faltante.           -->
          <div class="mt-4 pt-4 border-t border-gray-700 text-sm space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-400">Ventas Acumuladas Semanales:</span>
              <span class="font-bold text-white">${{ Number(happyHourStore.ventasSemanales || 0).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Meta MADI Semanal:</span>
              <span class="font-bold text-white">${{ Number(happyHourStore.config.weekly_sales_trigger || 0).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Faltante para MADI:</span>
              <span class="font-bold text-amber-500">${{ faltanteMadi.toFixed(2) }}</span>
            </div>
          </div>
          
        </div>

        <!-- ====== PANEL: RANKING DE MESEROS ====== -->
        <!-- Muestra a cada mesero con su barra de progreso individual y categoría   -->
        <!-- de bono (Sin Bono, Bronce, Plata, Oro) basada en las reglas MADI.       -->

        <div class="glass-panel transition-colors duration-500 rounded-3xl p-6">

          <!-- Título: se ilumina en verde neón durante Happy Hour -->
          <h2 :class="['text-xl font-bold mb-6', happyHourStore.config.is_active ? 'text-neon-green' : '']">
            Ranking Meseros
          </h2>

          <!-- ====== ITERACIÓN DE MESEROS (v-for) ====== -->
          <!-- v-for: Itera sobre `meseros` (ya ordenados por ventas desc).          -->
          <!-- :key: Usa el nombre del mesero como identificador único.               -->
          <div
            v-for="mesero in meseros"
            :key="mesero.nombre"
            class="mb-5"
          >

          <!-- Ventas y porcentaje del mesero (texto pequeño gris) -->
          <div class="text-xs text-gray-400">

            ${{ Number(mesero.ventas || 0).toFixed(2) }}
            ·
            {{ Number(mesero.porcentaje || 0).toFixed(0) }}%
            
          </div>

            <!-- Fila con nombre del mesero y su categoría de bono -->
            <div class="flex justify-between mb-2">

              <span>
                {{ mesero.nombre }}
              </span>

              <!-- ====== CATEGORÍA DE BONO CON COLOR DINÁMICO ====== -->
              <!-- :class con objeto: Aplica una clase CSS diferente según el valor   -->
              <!-- de `mesero.categoria`. Esto crea un "semáforo" visual:             -->
              <!--   - 'Sin Bono' → rojo (text-red-400)                              -->
              <!--   - 'Bronce'   → ámbar (text-amber-400)                           -->
              <!--   - 'Plata'    → gris claro (text-gray-300)                       -->
              <!--   - 'Oro'      → dorado (text-yellow-400)                         -->
              <span
                :class="{
                  'text-red-400':
                    mesero.categoria === 'Sin Bono',

                  'text-amber-400':
                    mesero.categoria === 'Bronce',

                  'text-gray-300':
                    mesero.categoria === 'Plata',

                  'text-yellow-400':
                    mesero.categoria === 'Oro'
                }"
              >
                {{ mesero.categoria }}
              </span>

            </div>

            <!-- ====== BARRA DE PROGRESO INDIVIDUAL DEL MESERO ====== -->
            <!-- Similar a la barra MADI pero para cada mesero individual.            -->
            <!-- `:style` vincula el ancho al porcentaje de cumplimiento.              -->
            <!-- `Math.min(mesero.porcentaje, 100)`: Evita desbordamiento visual.     -->
            <div class="w-full bg-gray-700 rounded-full h-4">

              <div
                class="bg-amber-500 h-4 rounded-full"
                :style="`width: ${Math.min(mesero.porcentaje, 100)}%`"
              ></div>

            </div>

          </div>

        </div>

      </div>

    </div>

  </div>
</template>