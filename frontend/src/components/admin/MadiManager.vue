<script setup>
// Importación de las funciones de servicio que actúan como puente hacia la API/Supabase.
// Estas funciones gestionan tanto la configuración general de MADI como las reglas de bonos.
import {
  getConfiguracionMadi,
  actualizarConfiguracionMadi,
  getReglasBonos,
  crearReglaBono,
  actualizarReglaBono,
  eliminarReglaBono,
} from "../../services/madiService";

// Importación de utilidades de Vue 3 (Composition API).
import { ref, onMounted } from "vue";

// =========================
// ESTADOS (REACTIVIDAD)
// =========================
// Almacena la configuración global del sistema MADI.
const configuracion = ref(null);

// Lista que mantiene las reglas de bonos cargadas desde la base de datos.
const reglasBonos = ref([]);

// Estado temporal para el modal de edición; almacena la regla que el usuario desea modificar.
const reglaEditando = ref(null);

// Objeto reactivo para el formulario de creación de una nueva regla.
const nuevaRegla = ref({
  level_name: "",
  min_percentage: 0,
  max_percentage: 0,
  bonus_factor: 1
});

// =========================
// LÓGICA DE NEGOCIO (REGLAS)
// =========================

// Copia la regla seleccionada al estado de edición para poblar el modal.
const editarRegla = (regla) => {
  reglaEditando.value = { ...regla };
};

// Persiste los cambios de una regla específica en el backend.
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

// Solicita confirmación al usuario antes de llamar al servicio de eliminación.
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

// =========================
// LÓGICA DE CARGA (LOAD)
// =========================

// Obtiene la configuración general del sistema desde el servicio.
const loadConfiguracion = async () => {
  try {
    configuracion.value = await getConfiguracionMadi();
  } catch (error) {
    console.error(error);
  }
};

// Crea una nueva regla y reinicia el formulario.
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

// Obtiene la lista completa de reglas de bonos configuradas.
const loadReglas = async () => {
  try {
    reglasBonos.value = await getReglasBonos();
  } catch (error) {
    console.error(error);
  }
};

// =========================
// LÓGICA DE GUARDADO (CONFIG)
// =========================

// Envía la configuración global actualizada al backend.
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

// Ciclo de vida: Al montar el componente, cargamos los datos iniciales.
onMounted(async () => {
  await loadConfiguracion();
  await loadReglas();
});
</script>

<template>

  <div
    class="glass-panel bg-white/5 shadow-xl rounded-3xl p-6 transition-colors duration-500"
  >

    <h2
      class="text-2xl font-bold mb-6"
    >
      Configuración MADI
    </h2>

    <div
      v-if="configuracion"
      class="grid md:grid-cols-2 gap-4"
    >
      <div>

        <label class="block mb-2">
          Meta Ventas Mesero Diaria ($)
        </label>

        <input
          v-model="configuracion.personal_daily_goal"
          type="number"
          step="0.01"
          class="w-full bg-black/20 p-3 rounded-xl border border-white/10"
        />

      </div>

    </div>

    <button
      @click="guardarConfiguracion"
      class="mt-6 bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold"
    >
      Guardar Configuración
    </button>

    <hr class="my-8 border-gray-700">

      <h3
        class="text-xl font-bold mb-4"
      >
        Reglas de Bonos
      </h3>

      <div
        class="grid md:grid-cols-4 gap-3 mb-6"
      >

        <input
          v-model="
            nuevaRegla.level_name
          "
          placeholder="Nivel"
          class="glass-panel p-6 shadow-xl p-3 rounded-xl"
        />

        <input
          v-model="
            nuevaRegla.min_percentage
          "
          type="number"
          placeholder="% mínimo"
          class="glass-panel p-6 shadow-xl p-3 rounded-xl"
        />

        <input
          v-model="
            nuevaRegla.max_percentage
          "
          type="number"
          placeholder="% máximo"
          class="glass-panel p-6 shadow-xl p-3 rounded-xl"
        />

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

      <button
        @click="crearRegla"
        class="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold mb-6"
      >
        Agregar Regla
      </button>
      
          <!-- TABLA REGLAS -->

    <div class="overflow-auto">

      <table class="w-full">

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

        <tbody>

          <tr
            v-for="regla in reglasBonos"
            :key="regla.id_reglas"
            class="border-b border-gray-800"
          >

            <td class="p-3">

              <span
                class="bg-amber-600 px-3 py-1 rounded-full font-bold"
              >
                {{ regla.level_name }}
              </span>

            </td>

            <td class="p-3">
              {{ regla.min_percentage }}%
            </td>

            <td class="p-3">
              {{ regla.max_percentage }}%
            </td>

            <td class="p-3 text-green-400 font-bold">
              {{ regla.bonus_factor }}%
            </td>

            <td class="p-3 flex gap-2">

              <button
                @click="editarRegla(regla)"
                class="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-xl font-bold"
              >
                Editar
              </button>

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

    <!-- MODAL EDITAR -->

    <div
      v-if="reglaEditando"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >

      <div
        class="bg-[#1b1b1b] p-8 rounded-3xl w-[500px]"
      >

        <h2
          class="text-2xl font-bold mb-6"
        >
          Editar Regla
        </h2>

        <div class="space-y-4">

          <input
            v-model="reglaEditando.level_name"
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          />

          <input
            v-model="reglaEditando.min_percentage"
            type="number"
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          />

          <input
            v-model="reglaEditando.max_percentage"
            type="number"
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          />

          <label class="block text-gray-400">Factor Bono (%)</label>
          <input
            v-model="reglaEditando.bonus_factor"
            type="number"
            step="1"
            class="w-full glass-panel p-6 shadow-xl p-3 rounded-xl"
          />

          <div class="flex gap-3">

            <button
              @click="guardarRegla"
              class="flex-1 bg-green-600 py-3 rounded-xl font-bold"
            >
              Guardar
            </button>

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
