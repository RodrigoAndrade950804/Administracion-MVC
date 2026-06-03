<script setup>
import { ref, onMounted } from "vue";

import { getProductos, crearProducto, actualizarProducto, eliminarProducto }
from "../../services/productosService";

const productos = ref([]);

const editando = ref(null);

const form = ref({
  name: "",
  sale_price: "",
  production_cost: "",
  stock: ""
});

// =========================
// LOAD
// =========================

const loadProductos = async () => {

  productos.value =
    await getProductos();

};

// =========================
// GUARDAR
// =========================

const guardarProducto =
async () => {

  try {

    if (editando.value) {

      await actualizarProducto(
        editando.value,
        form.value
      );

    } else {

      await crearProducto(
        form.value
      );

    }

    form.value = {
      name: "",
      sale_price: "",
      production_cost: "",
      stock: ""
    };

    editando.value = null;

    await loadProductos();

  } catch (error) {

    console.error(error);

  }

};

// =========================
// EDITAR
// =========================

const editarProducto =
(producto) => {

  editando.value =
    producto.id_producto;

  form.value = {

    name:
      producto.name,

    sale_price:
      producto.sale_price,

    production_cost:
      producto.production_cost,

    stock:
      producto.stock

  };

};

// =========================
// ELIMINAR
// =========================

const borrarProducto =
async (id) => {

  const confirmar =
    confirm(
      "¿Eliminar producto?"
    );

  if (!confirmar) return;

  await eliminarProducto(id);

  await loadProductos();

};

onMounted(() => {

  loadProductos();

});
</script>

<template>

  <div
    class="bg-[#1b1b1b] rounded-3xl p-6"
  >

    <h2
      class="text-3xl font-bold mb-6"
    >
      Gestión de Productos
    </h2>

    <!-- FORM -->

    <div
      class="grid md:grid-cols-4 gap-4 mb-8"
    >

      <input
        v-model="form.name"
        placeholder="Nombre"
        class="bg-[#2a2a2a] p-3 rounded-xl"
      >

      <input
        v-model="form.sale_price"
        placeholder="Precio Venta"
        type="number"
        class="bg-[#2a2a2a] p-3 rounded-xl"
      >

      <input
        v-model="form.production_cost"
        placeholder="Costo"
        type="number"
        class="bg-[#2a2a2a] p-3 rounded-xl"
      >

      <input
        v-model="form.stock"
        placeholder="Stock"
        type="number"
        class="bg-[#2a2a2a] p-3 rounded-xl"
      >

    </div>

    <button
      @click="guardarProducto"
      class="bg-green-600 hover:bg-green-500 px-6 py-3 rounded-xl font-bold mb-8"
    >
      {{
        editando
          ? "Actualizar Producto"
          : "Crear Producto"
      }}
    </button>

    <!-- LISTADO -->

    <div
      class="grid md:grid-cols-2 gap-5"
    >

      <div
        v-for="producto in productos"
        :key="producto.id_producto"
        class="bg-[#2a2a2a] p-5 rounded-2xl"
      >

        <h3
          class="text-xl font-bold mb-3"
        >
          {{ producto.name }}
        </h3>

        <p>
          Venta:
          $ {{ producto.sale_price }}
        </p>

        <p>
          Costo:
          $ {{ producto.production_cost }}
        </p>

        <p>
          Stock:
          {{ producto.stock }}
        </p>

        <div
          class="flex gap-3 mt-4"
        >

          <button
            @click="
              editarProducto(
                producto
              )
            "
            class="bg-amber-500 text-black px-4 py-2 rounded-xl font-bold"
          >
            Editar
          </button>

          <button
            @click="
              borrarProducto(
                producto.id_producto
              )
            "
            class="bg-red-600 px-4 py-2 rounded-xl font-bold"
          >
            Eliminar
          </button>

        </div>

      </div>

    </div>

  </div>

</template>