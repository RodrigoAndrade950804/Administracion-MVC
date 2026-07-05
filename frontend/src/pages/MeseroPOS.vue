<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

// Importación de todos los microservicios que componen la lógica del POS
import { getProductos } from "../services/productosService";
import { getMesas, updateMesaStatus } from "../services/mesasService";
import { supabase } from "../services/supabase";
import { useHappyHourStore } from "../stores/happyHourStore";

import {
  getConfiguracionMadi,
  suscribirConfiguracionMadi,
  verificarProgresoPersonal
} from "../services/madiService";

import {
  crearPedido,
  obtenerPedidoAbiertoMesa,
  agregarProductoPedido,
  actualizarDetallePedido,
  eliminarDetallePedido,
  descontarInventarioPedido,
  cerrarPedido,
  eliminarPedido
} from "../services/pedidosService";

// Instancias globales
const router = useRouter();
const authStore = useAuthStore();

// ==========================================
// ESTADO REACTIVO (Variables de la interfaz)
// ==========================================
const productos = ref([]);         // Catálogo de productos disponibles para la venta.
const mesas = ref([]);             // Lista de mesas del restaurante con su estado actual.
const mesaSeleccionada = ref(null);// ID de la mesa que el mesero está atendiendo en este momento.
const pedido = ref([]);            // Array de visualización: Lista de ítems en el carrito de la mesa seleccionada.
const pedidoActivo = ref(null);    // Objeto técnico: Registro principal del pedido abierto en la base de datos.
const madiConfig = ref(null);      // Almacena las reglas de bonificación.
const progresoPersonal = ref({ ventas: 0, meta: 100, porcentaje: 0, categoria: "Sin Bono" });
const happyHourStore = useHappyHourStore();

const nombreMesero = computed(() => {
  return authStore.user?.first_name 
    ? `${authStore.user.first_name} ${authStore.user.last_name || ''}` 
    : 'Mesero';
});

const fechaActual = ref("");
let timerFecha;

// Variables de control para los canales de WebSockets. 
// Guardar la referencia es vital para poder "desconectarlos" al salir de la pantalla.
let canalProductos = null;
let canalMadi = null;
let canalPedidos = null;
let canalMesas = null;

// ==========================================
// CERRAR SESIÓN
// ==========================================
const logout = () => {
  authStore.logout();
  router.push("/");
};

// ==========================================
// CARGA INICIAL DE DATOS
// ==========================================
const loadProductos = async () => {
  productos.value = await getProductos();
};

const loadMesas = async () => {
  mesas.value = await getMesas();
  // Auto-selección: Si el mesero acaba de entrar y no ha elegido mesa,
  // seleccionamos la primera por defecto para evitar una pantalla vacía.
  if (!mesaSeleccionada.value && mesas.value.length > 0) {
    mesaSeleccionada.value = mesas.value[0].id_mesa;
  }
};

const loadMadi = async () => {
  madiConfig.value = await getConfiguracionMadi();
  await loadProgresoPersonal();
};

const loadProgresoPersonal = async () => {
  if (authStore.user) {
    try {
      progresoPersonal.value = await verificarProgresoPersonal(authStore.user.id_user);
    } catch (e) {
      console.error("Error al cargar progreso personal:", e);
    }
  }
};

// ==========================================
// LISTENERS EN TIEMPO REAL (WebSockets)
// ==========================================
// Estas funciones garantizan que el POS nunca muestre información obsoleta.
// Si otro mesero o el administrador cambia algo, esta pantalla se actualiza sola.

const iniciarRealtimeProductos = () => {
  // Escucha cambios en el catálogo (ej. cambio de precio o stock agotado)
  canalProductos = supabase
    .channel("productos-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "productos" }, loadProductos)
    .subscribe();
};

const iniciarRealtimeMadi = () => {
  // Escucha si el sistema activa el Happy Hour automáticamente
  canalMadi = suscribirConfiguracionMadi(loadMadi);
};

const iniciarRealtimePedidos = () => {
  // Doble escucha: Monitorea tanto la creación de pedidos (cabeceras) 
  // como la adición de productos a esos pedidos (detalles).
  canalPedidos = supabase
    .channel("pedidos-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, async () => {
      await loadMesas();        // Refresca colores de las mesas (Libre/Ocupada)
      await cargarPedidoMesa(); // Refresca el ticket en pantalla
      await loadProgresoPersonal(); // Refresca el progreso si hubo alteraciones a las ventas cerradas
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "detalle_pedidos" }, async () => {
      await cargarPedidoMesa(); // Refresca las cantidades y subtotales en el ticket
    })
    .subscribe();
};

const iniciarRealtimeMesas = () => {
  // Escucha si una mesa cambia de estado (ej. alguien más la ocupó)
  canalMesas = supabase
    .channel("mesas-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "mesas" }, loadMesas)
    .subscribe();
};

// ==========================================
// GESTIÓN DEL PEDIDO Y CARRITO
// ==========================================

/**
 * Busca en la base de datos si la mesa seleccionada ya tiene clientes consumiendo.
 * Si los tiene, reconstruye el carrito visual (`pedido.value`).
 * Si no los tiene, limpia la pantalla para un pedido nuevo.
 */
const cargarPedidoMesa = async () => {
  if (!mesaSeleccionada.value) return;

  const data = await obtenerPedidoAbiertoMesa(mesaSeleccionada.value);

  if (!data) {
    // La mesa está vacía.
    pedidoActivo.value = null;
    pedido.value = [];
    return;
  }

  // Hay un pedido en curso. Mapeamos la respuesta anidada de Supabase 
  // a un formato plano y fácil de renderizar en el HTML.
  pedidoActivo.value = data;
  pedido.value = data.detalle_pedidos.map(d => ({
    ...d.productos,            // Trae nombre y precio base del producto
    id_detalle: d.id_detalle,  // ID vital para poder borrarlo o modificarlo después
    id_producto: d.id_producto,
    quantity: d.quantity,
    subtotal: d.subtotal
  }));
};

/**
 * Propiedad computada: Recalcula automáticamente el Total a pagar
 * cada vez que cambia la cantidad o los ítems del array `pedido`.
 */
const total = computed(() =>
  pedido.value.reduce((acc, i) => acc + Number(i.subtotal), 0)
);

const isHappyHourActive = computed(() => happyHourStore.config.is_active);

// ==========================================
// TRANSACCIONES COMPLEJAS (Agregar/Quitar)
// ==========================================

/**
 * Lógica crítica: Agrega un producto a la mesa.
 * Maneja el escenario donde la mesa estaba libre (crea pedido) 
 * o ya estaba ocupada (suma al pedido existente).
 */
const agregarProducto = async (producto) => {
  let pedidoCreadoTemporalmente = false;
  let pedidoTemporal = null;

  try {
    if (!mesaSeleccionada.value) {
      alert("Seleccione una mesa");
      return;
    }

    // PASO 1: Si la mesa no tiene un pedido abierto, lo creamos primero.
    if (!pedidoActivo.value) {
      pedidoTemporal = await crearPedido(mesaSeleccionada.value, authStore.user.id_user);
      pedidoCreadoTemporalmente = true;
    } else {
      pedidoTemporal = pedidoActivo.value;
    }

    // PASO 2: Verificamos si este producto ya estaba en la cuenta de esta mesa.
    const existente = pedido.value.find(i => i.id_producto === producto.id_producto);

    // PASO 3: Ejecutamos la petición al backend (que validará el stock en bodega).
    if (existente) {
      // Ya existía: sumamos 1 a la cantidad.
      await actualizarDetallePedido(pedidoTemporal.id_pedido, existente.id_detalle, existente.quantity + 1);
    } else {
      // Es nuevo: lo insertamos en la base de datos.
      await agregarProductoPedido(pedidoTemporal.id_pedido, producto);
    }

    // PASO 4: Si acabamos de crear el pedido, bloqueamos la mesa visualmente.
    if (pedidoCreadoTemporalmente) {
      pedidoActivo.value = pedidoTemporal;
      await updateMesaStatus(mesaSeleccionada.value, "ocupada");
    }

    // PASO 5: Todo salió bien, recargamos la vista y verificamos si llegamos a la meta de bonos.
    await cargarPedidoMesa();
    await loadProgresoPersonal();

  } catch (error) {
    // ==========================================
    // SISTEMA DE ROLLBACK (Prevención de errores catastróficos)
    // ==========================================
    // Si el backend rechazó el producto (ej. por falta de stock), y nosotros 
    // acabábamos de crear un pedido vacío para esta mesa, debemos eliminar ese 
    // pedido vacío para no dejar "basura" en la base de datos ni bloquear la mesa.
    if (pedidoCreadoTemporalmente && pedidoTemporal) {
      try { 
        await eliminarPedido(pedidoTemporal.id_pedido); 
      } catch (e) { 
        console.error("Error crítico en Rollback:", e); 
      }
    }
    alert(error.message || "Stock insuficiente");
  }
};

const aumentarCantidad = async (item) => {
  try {
    await actualizarDetallePedido(pedidoActivo.value.id_pedido, item.id_detalle, item.quantity + 1);
    await cargarPedidoMesa();
  } catch (error) {
    alert(error.message || "Stock insuficiente");
  }
};

const removerProducto = async (index) => {
  try {
    const item = pedido.value[index];
    
    // Si hay más de 1, solo restamos la cantidad.
    if (item.quantity > 1) {
      await actualizarDetallePedido(pedidoActivo.value.id_pedido, item.id_detalle, item.quantity - 1);
    } else {
      // Si era el último de su tipo, borramos la fila completa del ticket.
      const res = await eliminarDetallePedido(pedidoActivo.value.id_pedido, item.id_detalle);
      
      // Lógica de limpieza: El backend nos avisa (`orderDeleted`) si al borrar este producto, 
      // el ticket quedó totalmente vacío y por ende fue eliminado. Si es así, liberamos la mesa.
      if (res?.orderDeleted) {
        mesaSeleccionada.value = null;
        await loadMesas();
      }
    }
    await cargarPedidoMesa();
  } catch (error) {
    alert("Error al modificar pedido");
  }
};

// ==========================================
// FINALIZAR TRANSACCIÓN (COBRAR)
// ==========================================
const loading = ref(false);

const cobrarPedido = async () => {
  try {
    if (!pedidoActivo.value) return;
    loading.value = true;

    // 1. Ejecuta el descuento duro en la bodega (Backend API).
    await descontarInventarioPedido(pedidoActivo.value.id_pedido);
    
    // 2. Cambia el estado del pedido a 'cerrado' para que no salga más en el POS.
    await cerrarPedido(pedidoActivo.value.id_pedido);
    
    // 3. Verifica si esta venta hizo que se alcanzara la meta diaria.
    await loadProgresoPersonal();
    
    // 4. Libera la mesa para nuevos clientes.
    await updateMesaStatus(mesaSeleccionada.value, "libre");

    // 5. Resetea la interfaz del mesero.
    pedido.value = [];
    pedidoActivo.value = null;
    mesaSeleccionada.value = null;

    alert("Pedido cobrado correctamente");
  } catch {
    alert("Error al cobrar pedido");
  } finally {
    loading.value = false;
  }
};

// ==========================================
// CICLO DE VIDA DE VUE (LIFECYCLE HOOKS)
// ==========================================

// Observador (Watch): Si el mesero hace clic en otra mesa en el select (HTML),
// disparamos automáticamente la función para cargar el ticket de esa nueva mesa.
watch(mesaSeleccionada, cargarPedidoMesa);

// onMounted: Se ejecuta una única vez en el milisegundo en que la pantalla se dibuja.
onMounted(async () => {
  // Primero cargamos los datos estáticos...
  await loadProductos();
  await loadMesas();
  await loadMadi();
  await cargarPedidoMesa();
  await happyHourStore.loadConfig();
  
  timerFecha = setInterval(() => {
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    fechaActual.value = new Date().toLocaleDateString('es-ES', opciones);
  }, 1000);
  
  // ...Y luego encendemos los "radares" para mantenerlos actualizados en vivo.
  iniciarRealtimeProductos();
  iniciarRealtimeMadi();
  iniciarRealtimePedidos();
  iniciarRealtimeMesas();
  happyHourStore.iniciarRealtimeHappyHour();
});

// onUnmounted: Se ejecuta justo antes de que el usuario cambie a otra pantalla.
// CRÍTICO: Previene "Fugas de Memoria" (Memory Leaks). Destruye las conexiones 
// de WebSocket para no saturar el servidor ni ralentizar el navegador del usuario.
onUnmounted(() => {
  if (canalProductos) supabase.removeChannel(canalProductos);
  if (canalMadi) supabase.removeChannel(canalMadi);
  if (canalPedidos) supabase.removeChannel(canalPedidos);
  if (canalMesas) supabase.removeChannel(canalMesas);
  if (timerFecha) clearInterval(timerFecha);
});
</script>

<template>
  <div
    class="min-h-screen bg-[#111111] text-white p-6 transition-colors duration-500"
    :class="happyHourStore.config.is_active ? 'shadow-[inset_0_0_80px_rgba(0,255,120,0.2)] border border-green-500/20' : ''"
  >

    <!-- HEADER -->

    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
    >

      <div>

        <h2 :class="['text-xl font-bold mb-4 z-10 relative flex items-center justify-between', isHappyHourActive ? 'text-neon-green' : 'text-gray-100']">
          Gestión de Pedidos
        </h2>

      </div>

      <div class="flex flex-wrap gap-4 w-full md:w-auto">

        <div
          v-if="
            happyHourStore.config.is_active
          "
          class="px-6 py-3 rounded-2xl font-bold bg-green-500 text-black shadow-[0_0_20px_rgba(0,255,120,0.7)]"
        >
          HAPPY HOUR x{{ happyHourStore.config.waiter_multiplier }}
        </div>

        <div
          v-else
          class="px-6 py-3 rounded-2xl font-bold bg-gray-700"
        >
          MADI INACTIVO
        </div>

        <button
          @click="logout"
          class="bg-red-600 hover:bg-red-500 transition px-5 py-3 rounded-2xl font-bold"
        >
          Cerrar Sesión
        </button>

      </div>

    </div>

    <!-- TARJETA IDENTIDAD Y FECHA -->
    <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 border-emerald-500 mb-8">
      <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Mesero en Turno</span>
      <span class="font-bold text-2xl text-white">{{ nombreMesero }}</span>
      <span class="text-sm text-gray-400 mt-2">{{ fechaActual }}</span>
    </div>

    <!-- WIDGET PROGRESO PERSONAL -->
    <div class="mb-8 glass-panel shadow-xl rounded-3xl p-6 transition-colors duration-500">
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-xl font-bold">Tu Progreso de Ventas Diarias</h3>
        <span class="font-bold px-3 py-1 rounded-full"
          :class="{
            'bg-gray-700 text-red-400': progresoPersonal.categoria === 'Sin Bono',
            'bg-amber-900 text-amber-400': progresoPersonal.categoria === 'Bronce',
            'bg-gray-600 text-gray-200': progresoPersonal.categoria === 'Plata',
            'bg-yellow-600 text-yellow-300': progresoPersonal.categoria === 'Oro',
          }"
        >
          {{ progresoPersonal.categoria }}
        </span>
      </div>
      
      <div class="w-full bg-gray-700 rounded-full h-4 mb-2">
        <div
          class="bg-green-500 h-4 rounded-full transition-all duration-500"
          :style="`width: ${Math.min(progresoPersonal.porcentaje, 100)}%`"
        ></div>
      </div>
      
      <div :class="['flex justify-between text-sm', isHappyHourActive ? 'text-neon-green font-bold' : 'text-gray-300 font-semibold']">
        <span>Ventas: ${{ Number(progresoPersonal.ventas).toFixed(2) }}</span>
        <span>Meta: ${{ Number(progresoPersonal.meta).toFixed(2) }}</span>
      </div>

      <div 
        v-if="progresoPersonal.bonoExtra > 0" 
        class="mt-2 pt-2 border-t border-white/10 text-center font-bold text-lg"
        :class="happyHourStore.config.is_active ? 'text-green-300 drop-shadow-[0_0_8px_rgba(0,255,120,0.8)]' : 'text-green-400'"
      >
        ¡Bono Extra Acumulado: ${{ Number(progresoPersonal.bonoExtra).toFixed(2) }}!
      </div>
    </div>

    <!-- GRID -->

    <div
      class="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >

      <!-- PRODUCTOS -->

      <div class="lg:col-span-2">

        <div
          class="glass-panel shadow-xl rounded-3xl p-6 transition-colors duration-500"
        >

          <h2
            class="text-2xl font-bold mb-6"
          >
            Productos
          </h2>

          <div
            class="grid grid-cols-2 md:grid-cols-3 gap-5"
          >

            <div
              v-for="producto in productos"
              :key="producto.id_producto"
              @click="agregarProducto(producto)"
              class="bg-[#2a2a2a] rounded-2xl p-5 cursor-pointer hover:bg-amber-700 transition"
            >

              <h3
                class="text-xl font-bold mb-3"
              >
                {{ producto.name }}
              </h3>

              <p
                class="text-green-400 text-lg"
              >
                $ {{ Number(producto.sale_price).toFixed(2) }}
              </p>

              <p
                class="text-gray-400 text-sm mt-2"
              >
                Stock:
                {{ producto.stock }}
              </p>

            </div>

          </div>

        </div>

      </div>

      <!-- PEDIDO -->

      <div>

        <div
          class="glass-panel shadow-xl rounded-3xl p-6 transition-colors duration-500"
        >

          <div class="mb-6">

            <label
              class="block text-gray-400 mb-2"
            >
              Seleccionar Mesa
            </label>

            <select
              v-model="mesaSeleccionada"
              class="w-full bg-[#2a2a2a] p-3 rounded-xl"
            >

              <option
                v-for="mesa in mesas"
                :key="mesa.id_mesa"
                :value="mesa.id_mesa"
              >
                {{ mesa.numero_mesa }}
              </option>

            </select>

          </div>

          <div
            v-if="pedido.length === 0"
            class="text-center text-gray-500 py-10"
          >
            No hay productos agregados
          </div>

          <div
            v-for="(item, index) in pedido"
            :key="index"
            class="flex justify-between items-center bg-[#2a2a2a] p-4 rounded-xl mb-3"
          >

            <div>

              <p>
                {{ item.name }}
              </p>

              <p
                class="text-gray-400 text-sm"
              >
                Cantidad:
                {{ item.quantity }}
              </p>

              <p
                class="text-amber-400 text-sm"
              >
                Subtotal:
                $
                {{ Number(item.subtotal).toFixed(2) }}
              </p>

              <p
                class="text-green-400 text-sm"
              >
                $
                {{ Number(item.sale_price).toFixed(2) }}
              </p>

            </div>

            <div class="flex items-center gap-2">

              <button
                @click="removerProducto(index)"
                class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-xl"
              >
                -
              </button>

              <span
                class="font-bold text-lg"
              >
                {{ item.quantity }}
              </span>

              <button
                @click="aumentarCantidad(item)"
                class="bg-green-600 hover:bg-green-500 px-3 py-2 rounded-xl"
              >
                +
              </button>

            </div>

          </div>

          <div
            class="border-t border-gray-700 pt-4 mt-4"
          >

            <div
              class="flex justify-between text-2xl font-bold mb-6"
            >

              <span>Total</span>

              <span
                class="text-green-400"
              >
                $
                {{ Number(total).toFixed(2) }}
              </span>

            </div>

            <button 
              @click="cobrarPedido" 
              class="w-full btn-primary text-white font-bold py-4 rounded-xl shadow transition-all flex items-center justify-center space-x-2 text-lg disabled:opacity-50"
              :disabled="loading"
            >
              Cerrar Pedido / Cobrar
            </button>

          </div>

        </div>

      </div>

    </div>

  </div>
</template>
```
