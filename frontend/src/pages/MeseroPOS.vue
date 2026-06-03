<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import { getProductos } from "../services/productosService";
import { getMesas, updateMesaStatus } from "../services/mesasService";
import { supabase } from "../services/supabase";

import {
  getConfiguracionMadi,
  suscribirConfiguracionMadi,
  verificarActivacionMadi
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

const router = useRouter();
const authStore = useAuthStore();

// =========================
// STATE
// =========================
const productos = ref([]);
const mesas = ref([]);
const mesaSeleccionada = ref(null);
const pedido = ref([]);
const pedidoActivo = ref(null);
const madiConfig = ref(null);

let canalProductos = null;
let canalMadi = null;

// =========================
// LOGOUT
// =========================
const logout = () => {
  authStore.logout();
  router.push("/");
};

// =========================
// LOAD DATA
// =========================
const loadProductos = async () => {
  productos.value = await getProductos();
};

const loadMesas = async () => {
  mesas.value = await getMesas();
  if (!mesaSeleccionada.value && mesas.value.length > 0) {
    mesaSeleccionada.value = mesas.value[0].id_mesa;
  }
};

const loadMadi = async () => {
  madiConfig.value = await getConfiguracionMadi();
};

// =========================
// REALTIME
// =========================
const iniciarRealtimeProductos = () => {
  canalProductos = supabase
    .channel("productos-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "productos" },
      loadProductos
    )
    .subscribe();
};

const iniciarRealtimeMadi = () => {
  canalMadi = suscribirConfiguracionMadi(loadMadi);
};

// =========================
// PEDIDOS
// =========================
const cargarPedidoMesa = async () => {
  if (!mesaSeleccionada.value) return;

  const data = await obtenerPedidoAbiertoMesa(mesaSeleccionada.value);

  if (!data) {
    pedidoActivo.value = null;
    pedido.value = [];
    return;
  }

  pedidoActivo.value = data;
  pedido.value = data.detalle_pedidos.map(d => ({
    ...d.productos,
    id_detalle: d.id_detalle,
    id_producto: d.id_producto,
    quantity: d.quantity,
    subtotal: d.subtotal
  }));
};

const total = computed(() =>
  pedido.value.reduce((acc, i) => acc + Number(i.subtotal), 0)
);

// =========================
// AGREGAR / MODIFICAR
// =========================
const agregarProducto = async (producto) => {
  let pedidoCreadoTemporalmente = false;
  let pedidoTemporal = null;

  try {

    if (!mesaSeleccionada.value) {
      alert("Seleccione una mesa");
      return;
    }

    // Si no existe pedido abierto, crearlo temporalmente
    if (!pedidoActivo.value) {

      pedidoTemporal = await crearPedido(
        mesaSeleccionada.value,
        authStore.user.id_user
      );

      pedidoCreadoTemporalmente = true;

    } else {

      pedidoTemporal = pedidoActivo.value;

    }

    const existente = pedido.value.find(
      i => i.id_producto === producto.id_producto
    );

    if (existente) {

      await actualizarDetallePedido(
        pedidoTemporal.id_pedido,
        existente.id_detalle,
        existente.quantity + 1
      );

    } else {

      await agregarProductoPedido(
        pedidoTemporal.id_pedido,
        producto
      );

    }

    // Solo si todo salió bien:
    // se guarda el pedido activo y se ocupa la mesa

    if (pedidoCreadoTemporalmente) {

      pedidoActivo.value = pedidoTemporal;

      await updateMesaStatus(
        mesaSeleccionada.value,
        "ocupada"
      );

    }

    await cargarPedidoMesa();

    await verificarActivacionMadi();

  } catch (error) {

    // Si el pedido fue creado pero no se pudo agregar el producto
    // (por ejemplo por falta de stock), lo eliminamos

    if (
      pedidoCreadoTemporalmente &&
      pedidoTemporal
    ) {

      try {

        await eliminarPedido(
          pedidoTemporal.id_pedido
        );

      } catch (e) {

        console.error(
          "Error eliminando pedido temporal:",
          e
        );

      }

    }

    alert(
      error.message ||
      "Stock insuficiente"
    );

  }
};

const aumentarCantidad = async (item) => {
  try {
    await actualizarDetallePedido(
      pedidoActivo.value.id_pedido,
      item.id_detalle,
      item.quantity + 1
    );
    await cargarPedidoMesa();
  } catch (error) {

    if (
      pedidoActivo.value &&
      pedido.value.length === 0
    ) {

      await eliminarPedido(
        pedidoActivo.value.id_pedido
      );

      await updateMesaStatus(
        mesaSeleccionada.value,
        "libre"
      );

      pedidoActivo.value = null;
    }

    alert(
      error.message ||
      "Stock insuficiente"
    );
  }
};

const removerProducto = async (index) => {
  try {
    const item = pedido.value[index];

    if (item.quantity > 1) {
      await actualizarDetallePedido(
        pedidoActivo.value.id_pedido,
        item.id_detalle,
        item.quantity - 1
      );
    } else {
      const res = await eliminarDetallePedido(
        pedidoActivo.value.id_pedido,
        item.id_detalle
      );

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

// =========================
// COBRAR
// =========================
const cobrarPedido = async () => {
  try {
    if (!pedidoActivo.value) return;

    await descontarInventarioPedido(pedidoActivo.value.id_pedido);
    await cerrarPedido(pedidoActivo.value.id_pedido);
    await verificarActivacionMadi();
    await updateMesaStatus(mesaSeleccionada.value, "libre");

    pedido.value = [];
    pedidoActivo.value = null;
    mesaSeleccionada.value = null;

    alert("Pedido cobrado correctamente");
  } catch {
    alert("Error al cobrar pedido");
  }
};

// =========================
// WATCH / INIT
// =========================
watch(mesaSeleccionada, cargarPedidoMesa);

onMounted(async () => {
  await loadProductos();
  await loadMesas();
  await loadMadi();
  await cargarPedidoMesa();
  iniciarRealtimeProductos();
  iniciarRealtimeMadi();
});

onUnmounted(() => {
  if (canalProductos) supabase.removeChannel(canalProductos);
  if (canalMadi) supabase.removeChannel(canalMadi);
});
</script>

<template>
  <div
    class="min-h-screen bg-[#111111] text-white p-6"
  >

    <!-- HEADER -->

    <div
      class="flex justify-between items-center mb-8"
    >

      <div>

        <h1
          class="text-4xl font-bold"
        >
          POS Mesero
        </h1>

        <p class="text-gray-400">
          Gestión de Pedidos
        </p>

      </div>

      <div class="flex gap-4">

        <div
          v-if="
            madiConfig?.is_active
          "
          class="px-6 py-3 rounded-2xl font-bold bg-green-500 text-black shadow-[0_0_20px_rgba(0,255,120,0.7)]"
        >
          HAPPY HOUR x{{ madiConfig?.madi_multiplier }}
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

    <!-- GRID -->

    <div
      class="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >

      <!-- PRODUCTOS -->

      <div class="lg:col-span-2">

        <div
          class="bg-[#1b1b1b] rounded-3xl p-6"
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
          class="bg-[#1b1b1b] rounded-3xl p-6"
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
              :disabled="pedido.length === 0"
              class="w-full font-bold py-4 rounded-2xl transition"
              :class="
                pedido.length === 0
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-green-500 text-black hover:bg-green-400'
              "
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
