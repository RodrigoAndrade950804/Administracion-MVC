<script setup>
import { ref, onMounted } from "vue";
// Importación del store de autenticación para obtener el ID del usuario que realiza los cambios.
import { useAuthStore } from "../../stores/authStore";
// Importación de las funciones CRUD (Create, Read, Update, Delete) para productos.
import {
  getProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto
} from "../../services/productosService";

// Estado reactivo que almacena la lista completa de productos.
const productos = ref([]);

// Instancia del store de autenticación para acceso a datos de sesión.
const authStore = useAuthStore();

// Estado reactivo: Si tiene un valor (ID), indica que estamos editando un producto existente.
// Si es null, indica que estamos en modo de creación.
const editando = ref(null);

// Objeto reactivo que vincula el formulario del template con los datos del producto.
const form = ref({
  name: "",
  sale_price: "",
  production_cost: "",
  stock: ""
});

// =========================
// LOAD
// =========================

// Carga la lista de productos desde la base de datos para mostrar en la interfaz.
const loadProductos = async () => {
  try {
    productos.value = await getProductos();
  } catch (error) {
    console.error(error);
  }
};

// =========================
// GUARDAR
// =========================

// Ejecuta la lógica para guardar o actualizar un producto dependiendo del estado 'editando'.
const guardarProducto = async () => {
  try {
    if (editando.value) {
      // Si estamos editando, enviamos el ID, los datos nuevos y el ID del usuario autor.
      await actualizarProducto(
        editando.value,
        form.value,
        authStore.user?.id_user
      );
    } else {
      // Si es un nuevo registro, simplemente creamos el producto.
      await crearProducto(form.value);
    }

    // Reinicio del formulario al estado inicial tras la operación.
    form.value = {
      name: "",
      sale_price: "",
      production_cost: "",
      stock: ""
    };

    // Salimos del modo edición y refrescamos el listado.
    editando.value = null;
    await loadProductos();
  } catch (error) {
    console.error(error);
  }
};

// =========================
// EDITAR
// =========================

// Prepara el formulario cargando los datos del producto seleccionado para su edición.
const editarProducto = (producto) => {
  editando.value = producto.id_producto; // Marcamos el ID en edición.
  form.value = {
    name: producto.name,
    sale_price: producto.sale_price,
    production_cost: producto.production_cost,
    stock: producto.stock
  };
};

// =========================
// ELIMINAR
// =========================

// Solicita confirmación y elimina un producto específico por su ID.
const borrarProducto = async (id) => {
  const confirmar = confirm("¿Eliminar producto?");
  if (!confirmar) return;

  try {
    await eliminarProducto(id);
    await loadProductos(); // Actualiza la vista eliminando el elemento de la lista.
  } catch (error) {
    console.error(error);
  }
};

// =========================
// INIT
// =========================

// Carga inicial de los datos cuando el componente se monta en el DOM.
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