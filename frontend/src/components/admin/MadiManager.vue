<script setup>
import {
  getConfiguracionMadi,
  actualizarConfiguracionMadi,
  getReglasBonos,
  crearReglaBono,
  actualizarReglaBono,
  eliminarReglaBono,
}
from "../../services/madiService";

import {
  ref,
  onMounted
}
from "vue";

const configuracion = ref(null);

const reglasBonos = ref([]);

const reglaEditando = ref(null);

const nuevaRegla =
  ref({

    level_name: "",

    min_percentage: 0,

    max_percentage: 0,

    bonus_factor: 1

  });

const editarRegla = (regla) => {

  reglaEditando.value = {
    ...regla
  };

};

const guardarRegla = async () => {

  try {

    await actualizarReglaBono(
      reglaEditando.value.id_reglas,
      {
        level_name:
          reglaEditando.value.level_name,

        min_percentage:
          reglaEditando.value.min_percentage,

        max_percentage:
          reglaEditando.value.max_percentage,

        bonus_factor:
          reglaEditando.value.bonus_factor
      }
    );

    reglaEditando.value = null;

    await loadReglas();

  } catch (error) {

    console.error(error);

  }

};

const eliminarRegla = async (
  id
) => {

  const confirmar =
    confirm(
      "¿Eliminar esta regla?"
    );

  if (!confirmar) {
    return;
  }

  try {

    await eliminarReglaBono(
      id
    );

    await loadReglas();

  } catch (error) {

    console.error(error);

  }

};

// =========================
// LOAD
// =========================

const loadConfiguracion =
async () => {

  try {

    configuracion.value =
      await getConfiguracionMadi();

  } catch (error) {

    console.error(error);

  }

};

const crearRegla =
async () => {

  try {

    await crearReglaBono(
      nuevaRegla.value
    );

    nuevaRegla.value = {

      level_name: "",

      min_percentage: 0,

      max_percentage: 0,

      bonus_factor: 1

    };

    await loadReglas();

  } catch (error) {

    console.error(error);

  }

};

const loadReglas =
async () => {

  try {

    reglasBonos.value =
      await getReglasBonos();

  } catch (error) {

    console.error(error);

  }

};

// =========================
// GUARDAR
// =========================

const guardarConfiguracion =
async () => {

  try {

    await actualizarConfiguracionMadi(
      configuracion.value.id_madi,
      {
        daily_success_threshold:
          configuracion.value.daily_success_threshold,

        madi_multiplier:
          configuracion.value.madi_multiplier,

        is_active:
          configuracion.value.is_active,

        discount_percentage:
          configuracion.value.discount_percentage,

        daily_sales_goal:
          configuracion.value.daily_sales_goal
      }
    );

    alert(
      "Configuración actualizada"
    );

  } catch (error) {

    console.error(error);

  }

};

onMounted(async () => {

  await loadConfiguracion();

  await loadReglas();

});

</script>

<template>

  <div
    class="bg-[#1b1b1b] rounded-3xl p-6"
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

        <label
          class="block mb-2"
        >
          Meta Activación MADI (%)
        </label>

        <input
          v-model="
            configuracion.daily_success_threshold
          "
          type="number"
          class="w-full bg-[#2a2a2a] p-3 rounded-xl"
        />

      </div>

      <div>

        <label class="block mb-2">
          Meta Ventas Mesero ($)
        </label>

        <input
          v-model="configuracion.daily_sales_goal"
          type="number"
          step="0.01"
          class="w-full bg-[#2a2a2a] p-3 rounded-xl"
        />

      </div>

      <div>

        <label
          class="block mb-2"
        >
          Multiplicador MADI
        </label>

        <input
          v-model="
            configuracion.madi_multiplier
          "
          type="number"
          step="0.01"
          class="w-full bg-[#2a2a2a] p-3 rounded-xl"
        />

      </div>

      <div>

        <label
          class="block mb-2"
        >
          Descuento (%)
        </label>

        <input
          v-model="
            configuracion.discount_percentage
          "
          type="number"
          step="0.01"
          class="w-full bg-[#2a2a2a] p-3 rounded-xl"
        />

      </div>

      <div>

        <label
          class="block mb-2"
        >
          Estado
        </label>

        <select
          v-model="
            configuracion.is_active
          "
          class="w-full bg-[#2a2a2a] p-3 rounded-xl"
        >

          <option :value="true">
            Activo
          </option>

          <option :value="false">
            Inactivo
          </option>

        </select>

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
          class="bg-[#2a2a2a] p-3 rounded-xl"
        />

        <input
          v-model="
            nuevaRegla.min_percentage
          "
          type="number"
          placeholder="% mínimo"
          class="bg-[#2a2a2a] p-3 rounded-xl"
        />

        <input
          v-model="
            nuevaRegla.max_percentage
          "
          type="number"
          placeholder="% máximo"
          class="bg-[#2a2a2a] p-3 rounded-xl"
        />

        <input
          v-model="
            nuevaRegla.bonus_factor
          "
          type="number"
          step="0.01"
          placeholder="Factor"
          class="bg-[#2a2a2a] p-3 rounded-xl"
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
              Factor Bono
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
              x{{ regla.bonus_factor }}
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
            class="w-full bg-[#2a2a2a] p-3 rounded-xl"
          />

          <input
            v-model="reglaEditando.min_percentage"
            type="number"
            class="w-full bg-[#2a2a2a] p-3 rounded-xl"
          />

          <input
            v-model="reglaEditando.max_percentage"
            type="number"
            class="w-full bg-[#2a2a2a] p-3 rounded-xl"
          />

          <input
            v-model="reglaEditando.bonus_factor"
            type="number"
            step="0.01"
            class="w-full bg-[#2a2a2a] p-3 rounded-xl"
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