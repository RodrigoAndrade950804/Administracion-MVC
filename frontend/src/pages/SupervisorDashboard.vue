<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { getMesas } from "../services/mesasService";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import { supabase } from "../services/supabase";
import { useHappyHourStore } from "../stores/happyHourStore";
import { getConfiguracionMadi, suscribirConfiguracionMadi, getReglasBonos } from "../services/madiService";
import { getMeserosConVentas } from "../services/usuariosService";

// Estados reactivos: mesas activas, ranking de meseros y configuración MADI.
const mesas = ref([]);
const meseros = ref([]);
const madiConfig = ref(null);
const happyHourStore = useHappyHourStore();
const reglas = ref([]);

// Canales para las suscripciones Realtime.
let canalMadi = null;
let canalPedidos = null;

// =========================
// CARGA DE DATOS
// =========================

const loadMesas = async () => {
  try {
    mesas.value = await getMesas();
  } catch (error) {
    console.error(error);
  }
};

const loadMadi = async () => {
  try {
    madiConfig.value = await getConfiguracionMadi();
    reglas.value = await getReglasBonos();
  } catch (error) {
    console.error(error);
  }
};

// Calcula el ranking de meseros basado en ventas actuales vs meta diaria definida en MADI.
const loadRankingMeseros = async () => {
  try {
    const usuarios = await getMeserosConVentas();
    const meta = Number(madiConfig.value?.personal_daily_goal || 100);

    meseros.value = usuarios.map(usuario => {
      // Suma total de los montos de pedidos del mesero.
      const ventas = usuario.pedidos?.reduce((total, pedido) => total + Number(pedido.total_amount), 0) || 0;
      const porcentaje = (ventas / meta) * 100;

      // Asignación de categoría basada en cumplimiento dinámico
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

// =========================
// REALTIME (Suscripciones)
// =========================

// Refresca el ranking cuando ocurre cualquier cambio en la tabla de pedidos.
const iniciarRealtimePedidos = () => {
  canalPedidos = supabase
    .channel("pedidos-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, async () => {
      await loadRankingMeseros();
      await happyHourStore.loadVentasSemanales();
    })
    .subscribe();
};

// Refresca configuraciones y ranking si cambia MADI (ej. cambio de metas o activación).
const iniciarRealtimeMadi = () => {
  canalMadi = suscribirConfiguracionMadi(async () => {
    await loadMadi();
    await loadRankingMeseros();
  });
};

// Refresca el estado de las mesas en tiempo real.
const iniciarRealtime = () => {
  supabase
    .channel("mesas-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "mesas" }, async () => {
      await loadMesas();
    })
    .subscribe();
};

// Inicialización de datos y suscripciones al montar el componente.
onMounted(async () => {
  await loadMesas();
  await loadMadi();
  await loadRankingMeseros();
  await happyHourStore.loadConfig();
  await happyHourStore.loadVentasSemanales();
  iniciarRealtime();
  iniciarRealtimePedidos();
  iniciarRealtimeMadi();
  happyHourStore.iniciarRealtimeHappyHour();
});

// Limpieza de canales al destruir el componente para evitar fugas de memoria.
onUnmounted(() => {
  if (canalPedidos) supabase.removeChannel(canalPedidos);
  if (canalMadi) supabase.removeChannel(canalMadi);
});

// =========================
// UTILIDADES
// =========================

const router = useRouter();
const authStore = useAuthStore();

const logout = () => {
  authStore.logout();
  router.push("/");
};

// Progreso porcentual de la meta de ventas global (SEMANAL) para la barra superior.
const progresoVentas = computed(() => {
  if (!happyHourStore.config) return 0;
  const totalVentas = Number(happyHourStore.ventasSemanales || 0);
  const meta = Number(happyHourStore.config.weekly_sales_trigger || 100);
  if (meta <= 0) return 0;
  return Math.min((totalVentas / meta) * 100, 100);
});
</script>


<template>
  <div
    class="min-h-screen transition-colors duration-500 text-current p-6"
    :class="happyHourStore.config.is_active ? 'shadow-[0_0_60px_rgba(0,255,120,0.15)]' : ''"
  >

    <!-- HEADER -->

    <div class="flex justify-between items-start mb-8">

      <div>
        <h1 class="text-4xl font-bold">
          Dashboard Supervisor
        </h1>

        <p class="text-gray-400">
          Monitoreo Operativo en Tiempo Real
        </p>
      </div>

    <div class="flex gap-4">

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

    <!-- GRID -->

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- MESAS -->

      <div class="lg:col-span-2">

        <div class="glass-panel transition-colors duration-500 rounded-3xl p-6">

          <h2 class="text-2xl font-bold mb-6">
            Estado de Mesas
          </h2>

          <div class="grid grid-cols-2 md:grid-cols-3 gap-5">

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
              {{ mesa.numero_mesa }}

              <span class="text-sm mt-2">
                {{ mesa.status }}
              </span>

            </div>

          </div>

        </div>

      </div>

      <!-- PANEL DERECHO -->

      <div class="space-y-6">

        <!-- ALERTA -->

        <div class="glass-panel transition-colors duration-500 rounded-3xl p-6">

          <h2 :class="['text-xl font-bold mb-4', happyHourStore.config.is_active ? 'text-neon-green' : '']">
            Progreso MADI
          </h2>

          <div class="w-full bg-gray-700 rounded-full h-5">

          <div
            class="bg-green-500 h-5 rounded-full transition-all duration-500"
            :style="`width:${progresoVentas}%`"
          ></div>

        </div>

          <p :class="['text-center mt-3 text-sm font-bold', happyHourStore.config.is_active ? 'text-neon-green' : 'text-gray-400']">
            {{ Number(progresoVentas || 0).toFixed(0) }}%
            de la meta global de ventas
          </p>
          
        </div>
        <!-- RANKING -->

        <div class="glass-panel transition-colors duration-500 rounded-3xl p-6">

          <h2 :class="['text-xl font-bold mb-6', happyHourStore.config.is_active ? 'text-neon-green' : '']">
            Ranking Meseros
          </h2>

          <div
            v-for="mesero in meseros"
            :key="mesero.nombre"
            class="mb-5"
          >

          <div class="text-xs text-gray-400">

            ${{ Number(mesero.ventas || 0).toFixed(2) }}
            ·
            {{ Number(mesero.porcentaje || 0).toFixed(0) }}%
            
          </div>

            <div class="flex justify-between mb-2">

              <span>
                {{ mesero.nombre }}
              </span>

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