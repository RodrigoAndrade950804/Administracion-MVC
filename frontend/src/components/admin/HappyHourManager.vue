<script setup>
import { ref, onMounted } from "vue";
import { supabase } from "../../services/supabase";

const happyHourConfig = ref({
  id_happy_hour: null,
  weekly_sales_trigger: 0,
  activation_day: "Friday",
  discount_percentage: 0,
  waiter_multiplier: 1.0,
  is_active: false
});

const loadConfig = async () => {
  const { data, error } = await supabase
    .from("configuracion_happy_hour")
    .select("*")
    .single();

  if (data) {
    happyHourConfig.value = data;
  }
};

const guardarConfiguracion = async () => {
  const { error } = await supabase
    .from("configuracion_happy_hour")
    .update({
      weekly_sales_trigger: happyHourConfig.value.weekly_sales_trigger,
      activation_day: happyHourConfig.value.activation_day,
      discount_percentage: happyHourConfig.value.discount_percentage,
      waiter_multiplier: happyHourConfig.value.waiter_multiplier,
      is_active: happyHourConfig.value.is_active
    })
    .eq("id_happy_hour", happyHourConfig.value.id_happy_hour);

  if (error) {
    alert("Error al guardar Happy Hour: " + error.message);
  } else {
    alert("Configuración de Happy Hour guardada");
  }
};

onMounted(() => {
  loadConfig();
});
</script>

<template>
  <div class="glass-panel bg-white/5 shadow-xl rounded-3xl p-6 transition-colors duration-500 mb-8">
    <h2 class="text-2xl font-bold mb-6 text-accent transition-colors duration-500">
      Configuración Happy Hour Global
    </h2>

    <div class="grid grid-cols-2 gap-6">
      <div>
        <label class="block mb-2">Meta de Ventas Semanal ($)</label>
        <input
          v-model="happyHourConfig.weekly_sales_trigger"
          type="number"
          class="w-full bg-black/20 p-3 rounded-xl border border-white/10 text-white"
        />
      </div>

      <div>
        <label class="block mb-2">Día de Activación (Automática)</label>
        <select
          v-model="happyHourConfig.activation_day"
          class="w-full bg-black/20 p-3 rounded-xl border border-white/10 text-white"
        >
          <option value="Monday">Lunes</option>
          <option value="Tuesday">Martes</option>
          <option value="Wednesday">Miércoles</option>
          <option value="Thursday">Jueves</option>
          <option value="Friday">Viernes</option>
          <option value="Saturday">Sábado</option>
          <option value="Sunday">Domingo</option>
        </select>
      </div>

      <div>
        <label class="block mb-2">Descuento Global (%)</label>
        <input
          v-model="happyHourConfig.discount_percentage"
          type="number"
          class="w-full bg-black/20 p-3 rounded-xl border border-white/10 text-white"
        />
      </div>

      <div>
        <label class="block mb-2">Multiplicador Extra Mesero</label>
        <input
          v-model="happyHourConfig.waiter_multiplier"
          type="number"
          step="0.01"
          class="w-full bg-black/20 p-3 rounded-xl border border-white/10 text-white"
        />
      </div>

      <div class="col-span-2">
        <label class="block mb-2">Activación Manual Inmediata</label>
        <select
          v-model="happyHourConfig.is_active"
          class="w-full bg-black/20 p-3 rounded-xl border border-white/10 text-white"
        >
          <option :value="true">Activar Happy Hour AHORA</option>
          <option :value="false">Desactivado (o esperar automático)</option>
        </select>
      </div>
    </div>

    <button
      @click="guardarConfiguracion"
      class="mt-6 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold btn-primary transition-all duration-300"
    >
      Guardar Happy Hour
    </button>
  </div>
</template>
