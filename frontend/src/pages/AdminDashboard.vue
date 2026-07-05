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

const router = useRouter();
const authStore = useAuthStore();
const happyHourStore = useHappyHourStore();

// 🔑 'productosKey' actúa como un disparador reactivo: 
// Al incrementar este valor, Vue destruye y recrea el componente <ProductosManager>,
// forzando una recarga de los datos cuando hay cambios en la base de datos.
const productosKey = ref(0);

// Referencia al canal de suscripción de Supabase para limpieza posterior.
let canalProductos = null;

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
        event: "UPDATE", // Escucha solo actualizaciones en la tabla.
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
onMounted(() => {
  iniciarRealtimeProductos();
});

// Ciclo de vida: Elimina el canal de suscripción al salir de la página
// para evitar fugas de memoria y tráfico innecesario (prevención de bugs).
onUnmounted(() => {
  if (canalProductos) {
    supabase.removeChannel(canalProductos);
  }
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
        
        detalles.push({
          "ID Pedido": p.id_pedido,
          "Producto": d.productos?.name || "Desconocido",
          "Cantidad": d.quantity,
          "Precio Unit. Base ($)": Number(d.productos?.sale_price || 0).toFixed(2),
          "Precio Unit. Final ($)": Number(d.final_unit_price || 0).toFixed(2),
          "Aplica Happy Hour": d.is_madi_applied ? "Sí" : "No",
          "Descuento (%)": Number(d.madi_discount_percentage || 0),
          "Valor Descontado ($)": (Number(d.productos?.sale_price || 0) - Number(d.final_unit_price || 0)).toFixed(2),
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
  <div class="p-8 transition-colors duration-500 text-current">

    <!-- HEADER -->
    <div class="flex justify-between items-center mb-8 glass-panel p-8">
      <div>
        <h1 class="text-4xl font-bold text-accent transition-colors duration-500">
          Panel de Control Administrativo
        </h1>
        <p class="opacity-80 mt-2" v-if="happyHourStore.config.is_active">
          ¡MODO NEÓN / HAPPY HOUR ACTIVO!
        </p>
      </div>

      <div class="flex gap-4">
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
    </div>

    <!-- USUARIOS -->
    <div class="mt-8">
      <UsuariosManager />
    </div>

    <!-- PRODUCTOS -->
    <!-- 🔑 key reactivo para refrescar stock -->
    <ProductosManager :key="productosKey" />

    <!-- CONFIGURACION GLOBAL Y HAPPY HOUR -->
    <div class="mt-8">
      <HappyHourManager />
      <MadiManager />
    </div>

  </div>
</template>