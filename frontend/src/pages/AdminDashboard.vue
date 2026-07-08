<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import { useHappyHourStore } from "../stores/happyHourStore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Importación del cliente de Supabase para funcionalidades de tiempo real (Realtime).
import { supabase } from "../services/supabase";

// Importación de componentes hijos para la gestión administrativa.
import ProductosManager from "../components/admin/ProductosManager.vue";
import UsuariosManager from "../components/admin/UsuariosManager.vue";
import MadiManager from "../components/admin/MadiManager.vue";
import HappyHourManager from "../components/admin/HappyHourManager.vue";

import { getReglasBonos } from "../services/madiService";
import { computed } from "vue";

const router = useRouter();
const authStore = useAuthStore();
const happyHourStore = useHappyHourStore();

// 🔑 'productosKey' actúa como un disparador reactivo: 
// Al incrementar este valor, Vue destruye y recrea el componente <ProductosManager>,
// forzando una recarga de los datos cuando hay cambios en la base de datos.
const productosKey = ref(0);

// Referencia al canal de suscripción de Supabase para limpieza posterior.
let canalProductos = null;
let canalPedidosAdmin = null;

// =========================
// LOGOUT
// =========================

// Cierra la sesión del usuario en el store global y redirige al inicio.
const logout = () => {
  authStore.logout();
  router.push("/");
};

// =========================
// REALTIME PRODUCTOS
// =========================

// Configura un canal de escucha en la tabla 'productos' de Supabase.
const iniciarRealtimeProductos = () => {
  canalProductos = supabase
    .channel("admin-productos-realtime") // Nombre único para el canal.
    .on(
      "postgres_changes",
      {
        event: "*", // Escucha todas las modificaciones.
        schema: "public",
        table: "productos",
      },
      (payload) => {
        console.log("Admin realtime productos:", payload);

        // 🔄 Incrementamos el contador para disparar el re-renderizado
        // del componente hijo <ProductosManager>.
        productosKey.value++;
      }
    )
    .subscribe(); // Inicia la escucha activa del canal.
};

// Ciclo de vida: Inicia la suscripción apenas el dashboard está montado.
// El onMounted original fue fusionado más abajo

// Ciclo de vida: Elimina el canal de suscripción al salir de la página
// para evitar fugas de memoria y tráfico innecesario (prevención de bugs).
onUnmounted(() => {
  if (canalProductos) {
    supabase.removeChannel(canalProductos);
  }
  if (canalPedidosAdmin) {
    supabase.removeChannel(canalPedidosAdmin);
  }
  if (timerFecha) clearInterval(timerFecha);
});
// =========================
// HISTÓRICO BI Y KPIs
// =========================
const historicoFechas = ref([]);
const ventasHoy = ref(0);
const utilidadHoy = ref(0);
const ventasAyer = ref(0);
const utilidadAyer = ref(0);

const filtros = ref({
  fecha: '',
  ingreso: '',
  costo: '',
  bono: '',
  utilidad: ''
});

const cargarHistorico = async () => {
  try {
    const data = await obtenerDatosReporte(); // Reusa la función de exportar
    if (!data) return;
    const reglas = await getReglasBonos();
    const config = happyHourStore.config;
    const metaDiaria = Number(config?.personal_daily_goal || 0);

    const porFecha = {};

    // Helper robusto para formatear fechas asegurando que se parsee como UTC si Postgres manda timestamp sin timezone
    const formatFechaStr = (dateStr) => {
      if (!dateStr) return '';
      // Si dateStr es un string (como el de Postgres) y no tiene info de timezone ('Z' o '+'), le añadimos 'Z'
      const isDateObject = dateStr instanceof Date;
      let finalDateStr = dateStr;
      if (!isDateObject && typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
        finalDateStr = dateStr + 'Z';
      }
      const d = new Date(finalDateStr);
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    data.forEach(p => {
      const fechaStr = formatFechaStr(p.pedido_date);
      if (!porFecha[fechaStr]) {
        porFecha[fechaStr] = { fecha: fechaStr, ingresos: 0, costos: 0, bonos: 0, meseros: {} };
      }
      const item = porFecha[fechaStr];
      const totalP = Number(p.total_amount || 0);
      item.ingresos += totalP;

      let costoTotalPedido = 0;
      if (p.detalle_pedidos) {
        p.detalle_pedidos.forEach(d => {
          costoTotalPedido += Number(d.productos?.production_cost || 0) * d.quantity;
        });
      }
      item.costos += costoTotalPedido;

      const mesero = `${p.users?.first_name || ""} ${p.users?.last_name || ""}`.trim();
      if (!item.meseros[mesero]) item.meseros[mesero] = 0;
      item.meseros[mesero] += totalP;
    });

    Object.values(porFecha).forEach(dia => {
      let bonosDia = 0;
      Object.values(dia.meseros).forEach(ventaMesero => {
        const porcentaje = metaDiaria > 0 ? (ventaMesero / metaDiaria) * 100 : 0;
        let factorBono = 0;
        reglas.forEach(r => {
          if (porcentaje >= r.min_percentage) factorBono = Number(r.bonus_factor);
        });
        if (ventaMesero > metaDiaria && factorBono > 0) {
          bonosDia += (ventaMesero - metaDiaria) * (factorBono / 100);
        }
      });
      dia.bonos = bonosDia;
      dia.utilidadFinal = dia.ingresos - dia.costos - dia.bonos;
    });

    historicoFechas.value = Object.values(porFecha).sort((a, b) => {
      // Ordenar por fecha descendente asumiendo D/M/YYYY
      const [d1, m1, y1] = a.fecha.split('/');
      const [d2, m2, y2] = b.fecha.split('/');
      return new Date(y2, m2-1, d2) - new Date(y1, m1-1, d1);
    });

    const hoyDate = new Date();
    const hoyStr = formatFechaStr(hoyDate);
    
    const ayerDate = new Date();
    ayerDate.setDate(ayerDate.getDate() - 1);
    const ayerStr = formatFechaStr(ayerDate);

    const statsHoy = historicoFechas.value.find(h => h.fecha === hoyStr);
    const statsAyer = historicoFechas.value.find(h => h.fecha === ayerStr);

    ventasHoy.value = statsHoy ? statsHoy.ingresos : 0;
    utilidadHoy.value = statsHoy ? statsHoy.utilidadFinal : 0;
    ventasAyer.value = statsAyer ? statsAyer.ingresos : 0;
    utilidadAyer.value = statsAyer ? statsAyer.utilidadFinal : 0;

  } catch (error) {
    console.error("Error cargando histórico:", error);
  }
};

const historicoFiltrado = computed(() => {
  return historicoFechas.value.filter(h => {
    const pFecha = h.fecha.includes(filtros.value.fecha);
    const pIngreso = h.ingresos >= Number(filtros.value.ingreso || 0);
    const pCosto = h.costos >= Number(filtros.value.costo || 0);
    const pBono = h.bonos >= Number(filtros.value.bono || 0);
    const pUtilidad = h.utilidadFinal >= Number(filtros.value.utilidad || 0);
    return pFecha && pIngreso && pCosto && pBono && pUtilidad;
  });
});

const comparativaUtilidad = computed(() => {
  if (utilidadAyer.value === 0) return { texto: 'Sin utilidad ayer para comparar', clase: 'text-gray-400' };
  const diff = utilidadHoy.value - utilidadAyer.value;
  const porcentaje = (diff / Math.abs(utilidadAyer.value)) * 100;
  if (diff > 0) return { texto: `Aumentó ${porcentaje.toFixed(1)}% 📈`, clase: 'text-green-500 font-bold' };
  if (diff < 0) return { texto: `Bajó ${Math.abs(porcentaje).toFixed(1)}% 📉`, clase: 'text-red-500 font-bold' };
  return { texto: `Igual que ayer ➖`, clase: 'text-yellow-500 font-bold' };
});

const progresoVentasMadi = computed(() => {
  if (!happyHourStore.config) return 0;
  const totalVentas = Number(happyHourStore.ventasSemanales || 0);
  const meta = Number(happyHourStore.config.weekly_sales_trigger || 100);
  if (meta <= 0) return 0;
  return Math.min((totalVentas / meta) * 100, 100);
});

const faltanteMadi = computed(() => {
  const meta = Number(happyHourStore.config?.weekly_sales_trigger || 0);
  const ventas = Number(happyHourStore.ventasSemanales || 0);
  const faltante = meta - ventas;
  return faltante > 0 ? faltante : 0;
});

const nombreAdmin = computed(() => {
  return authStore.user?.first_name 
    ? `${authStore.user.first_name} ${authStore.user.last_name || ''}` 
    : 'Administrador';
});

const fechaActual = ref("");
let timerFecha;

const activeTab = ref('bi');
const isSidebarOpen = ref(false);

const ultimaActualizacion = ref(new Date().toLocaleTimeString());

const iniciarRealtimePedidos = () => {
  if (canalPedidosAdmin) return;
  canalPedidosAdmin = supabase
    .channel("admin-pedidos-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pedidos" },
      (payload) => {
        console.log("Cambio en pedidos (Admin BI):", payload);
        cargarHistorico();
        happyHourStore.loadConfig();
        happyHourStore.loadVentasSemanales();
      }
    )
    .subscribe();
};

// Actualiza los datos al montar y suscribe al realtime
onMounted(() => {
  iniciarRealtimeProductos();
  iniciarRealtimePedidos();
  cargarHistorico();
  happyHourStore.loadConfig();
  happyHourStore.loadVentasSemanales();
  setInterval(() => {
    ultimaActualizacion.value = new Date().toLocaleTimeString();
  }, 1000);
  
  timerFecha = setInterval(() => {
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    fechaActual.value = new Date().toLocaleDateString('es-ES', opciones);
  }, 1000);
});

// =========================
// EXPORTACIÓN A EXCEL Y PDF
// =========================
const obtenerDatosReporte = async () => {
  const { data, error } = await supabase
    .from("pedidos")
    .select(`
      id_pedido, total_amount, status, pedido_date,
      mesas ( numero_mesa ),
      users ( first_name, last_name ),
      detalle_pedidos (
        quantity, subtotal, final_unit_price, is_madi_applied, madi_discount_percentage,
        productos ( name, production_cost, sale_price )
      )
    `)
    .eq("status", "cerrado");

  if (error) {
    console.error("Error obteniendo datos para reporte:", error);
    alert("Hubo un error al obtener los datos para el reporte.");
    return null;
  }
  return data;
};

const exportarExcel = async () => {
  const data = await obtenerDatosReporte();
  if (!data || data.length === 0) return alert("No hay pedidos cerrados para exportar.");

  // Hoja 1: Resumen de Ventas
  const resumen = data.map(p => ({
    "ID Pedido": p.id_pedido,
    "Fecha": new Date(p.pedido_date).toLocaleDateString(),
    "Hora": new Date(p.pedido_date).toLocaleTimeString(),
    "Mesa": p.mesas?.numero_mesa || "N/A",
    "Mesero": `${p.users?.first_name || ""} ${p.users?.last_name || ""}`.trim(),
    "Estado": p.status,
    "Total Cobrado ($)": Number(p.total_amount || 0).toFixed(2)
  }));

  // Hoja 2: Detalle de Productos e Inventario (BI)
  const detalles = [];
  data.forEach(p => {
    if (p.detalle_pedidos) {
      p.detalle_pedidos.forEach(d => {
        const costoProduccion = Number(d.productos?.production_cost || 0) * d.quantity;
        const subtotalPagado = Number(d.subtotal || 0);
        const gananciaNeta = subtotalPagado - costoProduccion;
        
        const precioBase = Number(d.productos?.sale_price || 0);
        const precioFinal = Number(d.final_unit_price || 0);
        const montoDescontado = precioBase - precioFinal;

        detalles.push({
          "ID Pedido": p.id_pedido,
          "Producto": d.productos?.name || "Desconocido",
          "Cantidad": d.quantity,
          "Precio Unit. Base ($)": precioBase.toFixed(2),
          "Precio Unit. Final ($)": precioFinal.toFixed(2),
          "Aplica Happy Hour": d.is_madi_applied ? "Sí" : "No",
          "Descuento (%)": Number(d.madi_discount_percentage || 0),
          "Monto Descontado ($)": montoDescontado.toFixed(2),
          "Subtotal Pagado ($)": subtotalPagado.toFixed(2),
          "Costo Total Prod. ($)": costoProduccion.toFixed(2),
          "Ganancia Neta ($)": gananciaNeta.toFixed(2)
        });
      });
    }
  });

  // Hoja 3: Rendimiento Meseros
  const meserosMap = {};
  data.forEach(p => {
    const nombre = `${p.users?.first_name || ""} ${p.users?.last_name || ""}`.trim();
    if (!meserosMap[nombre]) {
      meserosMap[nombre] = { Mesero: nombre, "Total Vendido ($)": 0, "Órdenes Atendidas": 0 };
    }
    meserosMap[nombre]["Total Vendido ($)"] += Number(p.total_amount || 0);
    meserosMap[nombre]["Órdenes Atendidas"] += 1;
  });
  const rankingMeseros = Object.values(meserosMap).sort((a, b) => b["Total Vendido ($)"] - a["Total Vendido ($)"]);
  rankingMeseros.forEach(m => m["Total Vendido ($)"] = m["Total Vendido ($)"].toFixed(2));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen Ventas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalles), "Inventario y BI");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rankingMeseros), "Rendimiento Meseros");
  
  XLSX.writeFile(wb, `Reporte_BI_AromaGrano_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
};

const exportarPDF = async () => {
  const data = await obtenerDatosReporte();
  if (!data || data.length === 0) return alert("No hay pedidos cerrados para exportar.");

  const doc = new jsPDF();
  
  // Título e info
  doc.setFontSize(18);
  doc.text("Reporte Consolidado de Ventas - AromaGrano", 14, 15);
  doc.setFontSize(10);
  doc.text(`Fecha de generación: ${new Date().toLocaleString()}`, 14, 22);

  let totalGeneral = 0;
  
  const tableData = data.map(p => {
    const total = Number(p.total_amount || 0);
    totalGeneral += total;
    return [
      p.id_pedido, 
      new Date(p.pedido_date).toLocaleDateString(),
      p.mesas?.numero_mesa || "N/A",
      `${p.users?.first_name || ""} ${p.users?.last_name || ""}`.trim(),
      `$${total.toFixed(2)}`
    ];
  });
  
  // Fila de sumatoria
  tableData.push(["", "", "", "TOTAL ACUMULADO:", `$${totalGeneral.toFixed(2)}`]);

  doc.autoTable({
    head: [['ID Pedido', 'Fecha', 'Mesa', 'Mesero', 'Total']],
    body: tableData,
    startY: 30,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42] }, // Slate 900
    didParseCell: function (data) {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        if(data.column.index === 3 || data.column.index === 4) {
          data.cell.styles.fillColor = [74, 222, 128]; // Green 400
          data.cell.styles.textColor = [0, 0, 0];
        }
      }
    }
  });

  doc.save(`Corte_Caja_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
};

</script>

<template>
  <div class="flex h-screen bg-[#111111] overflow-hidden text-white transition-colors duration-500 text-current">

    <!-- SIDEBAR -->
    <aside :class="['fixed inset-y-0 left-0 z-50 w-64 glass-panel border-r border-gray-800 transition-transform duration-300 md:relative md:translate-x-0', isSidebarOpen ? 'translate-x-0' : '-translate-x-full']">
      <div class="p-6 flex justify-between items-center border-b border-gray-800">
        <h2 class="text-xl font-bold text-accent">Aroma Grano</h2>
        <button @click="isSidebarOpen = false" class="md:hidden text-gray-400 hover:text-white">✕</button>
      </div>
      <nav class="p-4 flex flex-col gap-2">
        <button @click="activeTab = 'bi'; isSidebarOpen = false" :class="['w-full text-left px-4 py-3 rounded-xl transition', activeTab === 'bi' ? 'bg-indigo-600 font-bold' : 'hover:bg-gray-800']">📊 Inteligencia BI</button>
        <button @click="activeTab = 'usuarios'; isSidebarOpen = false" :class="['w-full text-left px-4 py-3 rounded-xl transition', activeTab === 'usuarios' ? 'bg-indigo-600 font-bold' : 'hover:bg-gray-800']">👥 Personal</button>
        <button @click="activeTab = 'productos'; isSidebarOpen = false" :class="['w-full text-left px-4 py-3 rounded-xl transition', activeTab === 'productos' ? 'bg-indigo-600 font-bold' : 'hover:bg-gray-800']">🍔 Menú / Inv.</button>
        <button @click="activeTab = 'madi'; isSidebarOpen = false" :class="['w-full text-left px-4 py-3 rounded-xl transition', activeTab === 'madi' ? 'bg-indigo-600 font-bold' : 'hover:bg-gray-800']">🎯 Metas MADI</button>
        <button @click="activeTab = 'happyhour'; isSidebarOpen = false" :class="['w-full text-left px-4 py-3 rounded-xl transition', activeTab === 'happyhour' ? 'bg-indigo-600 font-bold' : 'hover:bg-gray-800']">🔥 Happy Hour</button>
      </nav>
    </aside>

    <!-- OVERLAY MÓVIL -->
    <div v-if="isSidebarOpen" @click="isSidebarOpen = false" class="fixed inset-0 bg-black/50 z-40 md:hidden"></div>

    <!-- MAIN CONTENT -->
    <main class="flex-1 flex flex-col h-screen overflow-y-auto">

      <!-- TOP NAV -->
      <header class="p-4 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div class="flex items-center gap-4">
          <button @click="isSidebarOpen = true" class="md:hidden text-gray-400 hover:text-white p-2 glass-panel rounded-lg">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <div>
            <h1 class="text-3xl md:text-4xl font-bold text-accent transition-colors duration-500">Panel Admin</h1>
            <p class="opacity-80 mt-1" v-if="happyHourStore.config.is_active">¡MODO NEÓN / HAPPY HOUR ACTIVO!</p>
          </div>
        </div>

      <div class="flex flex-wrap gap-4 w-full md:w-auto">
        <button
          @click="exportarPDF"
          class="bg-gray-800 hover:bg-gray-700 text-white px-5 py-3 rounded-2xl font-bold btn-primary transition-all duration-300"
        >
          Exportar PDF
        </button>
        <button
          @click="exportarExcel"
          class="bg-gray-800 hover:bg-gray-700 text-white px-5 py-3 rounded-2xl font-bold btn-primary transition-all duration-300"
        >
          Exportar Excel
        </button>
        <button
          @click="logout"
          class="bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-2xl font-bold"
        >
          Cerrar Sesión
        </button>
      </div>
      </header>

      <!-- CONTENT WRAPPER -->
      <div class="p-4 md:p-8 pt-0">
        <!-- PESTAÑA BI -->
        <div v-if="activeTab === 'bi'">

          <!-- METRICS HEADER CARDS -->
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
      
      <!-- Card 1: Admin & Fecha -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 border-purple-500">
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Administrador en Turno</span>
        <span class="font-bold text-2xl text-white">{{ nombreAdmin }}</span>
        <span class="text-xs text-gray-400 mt-2">{{ fechaActual }}</span>
      </div>

      <!-- Card 2: Utilidad Hoy -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 border-indigo-500">
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Utilidad Final del Día</span>
        <span class="font-bold text-3xl text-white">${{ utilidadHoy.toFixed(2) }}</span>
        <div class="flex items-center gap-2 mt-2">
          <span class="text-xs" :class="comparativaUtilidad.clase">{{ comparativaUtilidad.texto }}</span>
          <span class="text-xs text-gray-500">vs Ayer (${{ utilidadAyer.toFixed(2) }})</span>
        </div>
      </div>

      <!-- Card 2: Ventas Hoy -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 border-blue-500">
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Ventas del Día</span>
        <span class="font-bold text-2xl text-white">${{ ventasHoy.toFixed(2) }}</span>
        <span class="text-xs text-gray-500 mt-2">Última act: {{ ultimaActualizacion }}</span>
      </div>
      
      <!-- Card 3: Estado MADI Semanal -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 relative overflow-hidden transition-colors duration-500"
           :class="happyHourStore.config.is_active ? 'border-neon-green shadow-[0_0_15px_rgba(0,255,120,0.4)]' : 'border-amber-500'">
        <div v-if="happyHourStore.config.is_active" class="absolute inset-0 bg-green-500/10 pointer-events-none"></div>
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1 relative z-10">Estado MADI Semanal</span>
        <span v-if="happyHourStore.config.is_active" class="font-bold text-2xl text-neon-green relative z-10 mt-1 drop-shadow-md">Activado 🔥</span>
        <span v-else class="font-bold text-xl text-amber-500 relative z-10 mt-1">Faltan ${{ faltanteMadi.toFixed(2) }}</span>
        <span class="text-xs text-gray-500 mt-2 relative z-10">Ventas actuales: ${{ Number(happyHourStore.ventasSemanales || 0).toFixed(2) }}</span>
      </div>

      <!-- Card 4: Progreso MADI -->
      <div class="glass-panel p-5 rounded-3xl flex flex-col justify-center border-l-4 border-gray-600">
        <span class="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">Progreso MADI ({{ Number(progresoVentasMadi || 0).toFixed(0) }}%)</span>
        <div class="w-full bg-gray-700 rounded-full h-3 mt-2 mb-2">
          <div class="bg-green-500 h-3 rounded-full transition-all duration-500" :style="`width:${progresoVentasMadi}%`"></div>
        </div>
        <div class="flex justify-between text-xs text-gray-400 mt-1">
          <span>Meta: ${{ Number(happyHourStore.config.weekly_sales_trigger || 0).toFixed(2) }}</span>
          <span>Acum: ${{ Number(happyHourStore.ventasSemanales || 0).toFixed(2) }}</span>
        </div>
      </div>

    </div>

    <!-- TABLA HISTÓRICA DE UTILIDAD -->
    <div class="glass-panel p-6 rounded-3xl mb-8">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-white">Histórico de Utilidad Neta (BI)</h2>
        <button @click="cargarHistorico" class="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white transition">Actualizar 🔄</button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-gray-400 border-b border-gray-700">
              <th class="p-3">
                Fecha
                <input v-model="filtros.fecha" type="text" placeholder="Filtrar..." class="mt-2 w-full p-1 text-xs bg-gray-800 text-white rounded border border-gray-600 outline-none">
              </th>
              <th class="p-3">
                Ingresos ($)
                <input v-model="filtros.ingreso" type="number" placeholder="Min..." class="mt-2 w-full p-1 text-xs bg-gray-800 text-white rounded border border-gray-600 outline-none">
              </th>
              <th class="p-3">
                Costos Insumos ($)
                <input v-model="filtros.costo" type="number" placeholder="Min..." class="mt-2 w-full p-1 text-xs bg-gray-800 text-white rounded border border-gray-600 outline-none">
              </th>
              <th class="p-3">
                Bonos Pagados ($)
                <input v-model="filtros.bono" type="number" placeholder="Min..." class="mt-2 w-full p-1 text-xs bg-gray-800 text-white rounded border border-gray-600 outline-none">
              </th>
              <th class="p-3">
                Utilidad Final ($)
                <input v-model="filtros.utilidad" type="number" placeholder="Min..." class="mt-2 w-full p-1 text-xs bg-gray-800 text-white rounded border border-gray-600 outline-none">
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fila in historicoFiltrado" :key="fila.fecha" class="border-b border-gray-800/50 hover:bg-white/5 transition">
              <td class="p-3 text-white font-medium">{{ fila.fecha }}</td>
              <td class="p-3 text-green-400">${{ fila.ingresos.toFixed(2) }}</td>
              <td class="p-3 text-red-400">-${{ fila.costos.toFixed(2) }}</td>
              <td class="p-3 text-amber-400">-${{ fila.bonos.toFixed(2) }}</td>
              <td class="p-3 font-bold" :class="fila.utilidadFinal > 0 ? 'text-green-500' : 'text-red-500'">
                ${{ fila.utilidadFinal.toFixed(2) }}
              </td>
            </tr>
            <tr v-if="historicoFiltrado.length === 0">
              <td colspan="5" class="p-6 text-center text-gray-500">No hay datos que coincidan con los filtros.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

        </div> <!-- END PESTAÑA BI -->

        <!-- USUARIOS -->
        <div v-if="activeTab === 'usuarios'" class="mt-4">
          <UsuariosManager />
        </div>

        <!-- PRODUCTOS -->
        <div v-if="activeTab === 'productos'" class="mt-4">
          <ProductosManager :key="productosKey" />
        </div>

        <!-- MADI -->
        <div v-if="activeTab === 'madi'" class="mt-4">
          <MadiManager />
        </div>

        <!-- HAPPY HOUR -->
        <div v-if="activeTab === 'happyhour'" class="mt-4">
          <HappyHourManager />
        </div>

      </div>
    </main>
  </div>
</template>