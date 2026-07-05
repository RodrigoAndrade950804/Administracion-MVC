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
const ventasHoy = ref(0);
const ventasAyer = ref(0);
const fechaActual = ref(new Date().toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }));

let timer;

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
// CARGA DE DATOS DIARIOS
// =========================
const loadVentasDiarias = async () => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);

    const { data, error } = await supabase
      .from("pedidos")
      .select("total_amount, pedido_date")
      .eq("status", "cerrado")
      .gte("pedido_date", ayer.toISOString());

    if (error) throw error;

    let totalHoy = 0;
    let totalAyer = 0;

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
      await loadVentasDiarias();
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
  await loadVentasDiarias();
  iniciarRealtime();
  iniciarRealtimePedidos();
  iniciarRealtimeMadi();
  happyHourStore.iniciarRealtimeHappyHour();

  timer = setInterval(() => {
    fechaActual.value = new Date().toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);
});

// Limpieza de canales al destruir el componente para evitar fugas de memoria.
onUnmounted(() => {
  if (canalPedidos) supabase.removeChannel(canalPedidos);
  if (canalMadi) supabase.removeChannel(canalMadi);
  if (timer) clearInterval(timer);
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

const nombreSupervisor = computed(() => {
  return authStore.user?.first_name 
    ? `${authStore.user.first_name} ${authStore.user.last_name || ''}` 
    : 'Supervisor';
});

const faltanteMadi = computed(() => {
  const meta = Number(happyHourStore.config?.weekly_sales_trigger || 0);
  const ventas = Number(happyHourStore.ventasSemanales || 0);
  const faltante = meta - ventas;
  return faltante > 0 ? faltante : 0;
});
</script>


<template>
  <div
    class="min-h-screen transition-colors duration-500 text-current p-6"
    :class="happyHourStore.config.is_active ? 'shadow-[0_0_60px_rgba(0,255,120,0.15)]' : ''"
  >

    <!-- HEADER -->

    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">

      <div>
        <h1 class="text-4xl font-bold">
          Dashboard Supervisor
        </h1>

        <p class="text-gray-400">
          Monitoreo Operativo en Tiempo Real
        </p>

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

    <!-- METRICS HEADER CARDS -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
      
      <!-- Card 1: Supervisor -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 border-blue-500">
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Supervisor en Turno</span>
        <span class="font-bold text-2xl text-white">{{ nombreSupervisor }}</span>
        <span class="text-sm text-gray-500 mt-2">{{ fechaActual }}</span>
      </div>

      <!-- Card 2: Ventas Hoy -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 border-green-500">
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Ventas del Día</span>
        <span class="font-bold text-3xl text-white">${{ ventasHoy.toFixed(2) }}</span>
      </div>

      <!-- Card 3: Comparativa -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4" :class="ventasHoy - ventasAyer > 0 ? 'border-green-500' : 'border-red-500'">
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Rendimiento vs Ayer</span>
        <span class="font-bold text-xl mt-1" :class="comparativaVentas.clase">
          {{ comparativaVentas.texto }}
        </span>
        <span class="text-sm text-gray-500 mt-2">Ventas ayer: ${{ ventasAyer.toFixed(2) }}</span>
      </div>
      
      <!-- Card 4: Faltante MADI -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 relative overflow-hidden transition-colors duration-500"
           :class="happyHourStore.config.is_active ? 'border-neon-green shadow-[0_0_15px_rgba(0,255,120,0.4)]' : 'border-amber-500'">
        <div v-if="happyHourStore.config.is_active" class="absolute inset-0 bg-green-500/10 pointer-events-none"></div>
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1 relative z-10">Estado MADI Semanal</span>
        <span v-if="happyHourStore.config.is_active" class="font-bold text-2xl text-neon-green relative z-10 mt-1 drop-shadow-md">Activado 🔥</span>
        <span v-else class="font-bold text-xl text-amber-500 relative z-10 mt-1">Faltan ${{ faltanteMadi.toFixed(2) }}</span>
        <span class="text-sm text-gray-500 mt-2 relative z-10">Ventas actuales: ${{ Number(happyHourStore.ventasSemanales || 0).toFixed(2) }}</span>
      </div>

    </div>

    <!-- MAIN GRID -->

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