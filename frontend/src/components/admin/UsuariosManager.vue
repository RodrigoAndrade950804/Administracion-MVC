<script setup>
import { ref, onMounted } from "vue";

// Importación de servicios para la manipulación de usuarios contra la API/Base de datos.
import { 
  getUsers, 
  createUser, 
  toggleUserStatus, 
  actualizarUsuario, 
  eliminarUsuario 
} from "../../services/usuariosService";

// Estado reactivo que almacena el listado de usuarios obtenidos.
const usuarios = ref([]);

// Estado para controlar qué usuario se está editando actualmente (o null si ninguno).
const usuarioEditando = ref(null);

// Objeto para manejar los datos del nuevo usuario a crear desde el formulario.
const nuevoUsuario = ref({
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  base_salary: 0,
  id_role: 3 // Por defecto asignamos el rol 'Mesero'.
});

// =========================
// LÓGICA DE ESTADO
// =========================

// Alterna el estado activo/inactivo de un usuario.
const cambiarEstado = async (usuario) => {
  // Validación de seguridad: Previene que un administrador pueda desactivar su propio rol.
  if (usuario.roles?.role_name === "admin") {
    alert("No se puede desactivar un administrador");
    return;
  }

  try {
    await toggleUserStatus(usuario.id_user, !usuario.active);
    await loadUsers(); // Refresca la lista tras el cambio.
  } catch (error) {
    console.error(error);
  }
};

// =========================
// LÓGICA DE CARGA
// =========================

// Recupera la lista completa de usuarios del backend.
const loadUsers = async () => {
  try {
    usuarios.value = await getUsers();
  } catch (error) {
    console.error(error);
  }
};

// =========================
// LÓGICA DE USUARIOS (CRUD)
// =========================

// Crea un usuario nuevo y resetea el formulario tras el éxito.
const crearNuevoUsuario = async () => {
  try {
    await createUser(nuevoUsuario.value);
    await loadUsers();
    
    // Reinicio del formulario.
    nuevoUsuario.value = {
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      base_salary: 0,
      id_role: 3
    };
    alert("Usuario creado correctamente");
  } catch (error) {
    console.error(error);
  }
};

// Prepara el objeto de edición clonando los datos del usuario seleccionado.
const editarUsuario = (usuario) => {
  usuarioEditando.value = { ...usuario };
};

// Envía la actualización al backend para los cambios hechos en el modal.
const guardarEdicion = async () => {
  try {
    await actualizarUsuario(usuarioEditando.value.id_user, usuarioEditando.value);
    usuarioEditando.value = null; // Cierra el modal.
    await loadUsers();
  } catch (error) {
    console.error(error);
  }
};

// Ejecuta la eliminación tras solicitar confirmación del usuario.
const eliminarUsuarioSistema = async (usuario) => {
  try {
    const confirmar = confirm(`¿Eliminar a ${usuario.first_name} ${usuario.last_name}?`);
    if (!confirmar) return;

    await eliminarUsuario(usuario.id_user);
    await loadUsers();
    alert("Usuario eliminado");
  } catch (error) {
    console.error(error);
  }
};

// Carga inicial al montar el componente en el DOM.
onMounted(() => {
  loadUsers();
});
</script>

<template>

  <div
    class="bg-[#1b1b1b] rounded-3xl p-6"
  >

    <h2
      class="text-2xl font-bold mb-6"
    >
      Gestión de Usuarios
    </h2>

    <!-- FORM -->

    <div
      class="grid md:grid-cols-2 gap-4 mb-8"
    >

      <input
        v-model="nuevoUsuario.first_name"
        placeholder="Nombre"
        class="bg-[#2a2a2a] p-3 rounded-xl"
      />

      <input
        v-model="nuevoUsuario.last_name"
        placeholder="Apellido"
        class="bg-[#2a2a2a] p-3 rounded-xl"
      />

      <input
        v-model="nuevoUsuario.email"
        placeholder="Correo"
        class="bg-[#2a2a2a] p-3 rounded-xl"
      />

      <input
        v-model="nuevoUsuario.password"
        type="password"
        placeholder="Contraseña"
        class="bg-[#2a2a2a] p-3 rounded-xl"
      />

      <input
        v-model="nuevoUsuario.base_salary"
        type="number"
        placeholder="Salario"
        class="bg-[#2a2a2a] p-3 rounded-xl"
      />

      <select
        v-model="nuevoUsuario.id_role"
        class="bg-[#2a2a2a] p-3 rounded-xl"
      >

        <option :value="1">
          Admin
        </option>

        <option :value="2">
          Supervisor
        </option>

        <option :value="3">
          Mesero
        </option>

      </select>

    </div>

    <button
      @click="crearNuevoUsuario"
      class="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold mb-8"
    >
      Crear Usuario
    </button>

    <!-- TABLA -->

    <div class="overflow-auto">

      <table class="w-full">

        <thead>

          <tr
            class="text-left border-b border-gray-700"
          >

            <th class="p-3">
              ID
            </th>

            <th class="p-3">
              Nombre
            </th>

            <th class="p-3">
              Email
            </th>

            <th class="p-3">
              Rol
            </th>

            <th class="p-3">
              Salario
            </th>

            <th class="p-3">
              Estado
            </th>

            <th class="p-3">
              Acciones
            </th>

          </tr>

        </thead>

        <tbody>

          <tr
            v-for="usuario in usuarios"
            :key="usuario.id_user"
            class="border-b border-gray-800"
          >

            <td class="p-3">
              {{ usuario.id_user }}
            </td>

            <td class="p-3">
              {{ usuario.first_name }}
              {{ usuario.last_name }}
            </td>

            <td class="p-3">
              {{ usuario.email }}
            </td>

            <td class="p-3">

              <span
                v-if="usuario.roles?.role_name === 'admin'"
                class="bg-purple-600 px-3 py-1 rounded-full text-sm font-bold"
              >
                Admin
              </span>

              <span
                v-else-if="usuario.roles?.role_name === 'supervisor'"
                class="bg-blue-600 px-3 py-1 rounded-full text-sm font-bold"
              >
                Supervisor
              </span>

              <span
                v-else
                class="bg-amber-600 px-3 py-1 rounded-full text-sm font-bold"
              >
                Mesero
              </span>

            </td>

            <td class="p-3">
              $
              {{ Number(usuario.base_salary).toFixed(2) }}
            </td>

            <td class="p-3">

              <span
                v-if="usuario.active"
                class="text-green-400 font-bold"
              >
                ● Activo
              </span>

              <span
                v-else
                class="text-red-400 font-bold"
              >
                ● Inactivo
              </span>

            </td>

            <td class="p-3">

              <div class="flex gap-2">

                <!-- ADMIN -->

                <template
                  v-if="
                    usuario.roles?.role_name === 'admin'
                  "
                >

                  <button
                    disabled
                    class="bg-gray-700 px-4 py-2 rounded-xl font-bold cursor-not-allowed"
                  >
                    Protegido
                  </button>

                </template>

                <!-- RESTO -->

                <template
                  v-else
                >

                  <button
                    @click="
                      cambiarEstado(usuario)
                    "
                    class="px-4 py-2 rounded-xl font-bold transition"
                    :class="
                      usuario.active
                        ? 'bg-red-600 hover:bg-red-500'
                        : 'bg-green-600 hover:bg-green-500'
                    "
                  >
                    {{
                      usuario.active
                        ? 'Desactivar'
                        : 'Activar'
                    }}
                  </button>

                  <button
                    @click="
                      editarUsuario(usuario)
                    "
                    class="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-xl font-bold"
                  >
                    Editar
                  </button>

                  <button
                    @click="
                      eliminarUsuarioSistema(
                        usuario
                      )
                    "
                    class="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl font-bold"
                  >
                    Eliminar
                  </button>

                </template>

              </div>

            </td>

          </tr>

        </tbody>

      </table>

    </div>

    <!-- MODAL EDITAR -->

    <div
      v-if="usuarioEditando"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >

      <div
        class="bg-[#1b1b1b] p-8 rounded-3xl w-[500px]"
      >

        <h2
          class="text-2xl font-bold mb-6"
        >
          Editar Usuario
        </h2>

        <div class="space-y-4">

          <input
            v-model="
              usuarioEditando.first_name
            "
            class="w-full bg-[#2a2a2a] p-3 rounded-xl"
          />

          <input
            v-model="
              usuarioEditando.last_name
            "
            class="w-full bg-[#2a2a2a] p-3 rounded-xl"
          />

          <input
            v-model="
              usuarioEditando.base_salary
            "
            type="number"
            class="w-full bg-[#2a2a2a] p-3 rounded-xl"
          />

          <select
            v-model="
              usuarioEditando.id_role
            "
            class="w-full bg-[#2a2a2a] p-3 rounded-xl"
          >

            <option
              :value="1"
              disabled
            >
              Admin
            </option>

            <option :value="2">
              Supervisor
            </option>

            <option :value="3">
              Mesero
            </option>

          </select>

          <div class="flex gap-3">

            <button
              @click="guardarEdicion"
              class="flex-1 bg-green-600 hover:bg-green-500 py-3 rounded-xl font-bold"
            >
              Guardar
            </button>

            <button
              @click="
                usuarioEditando = null
              "
              class="flex-1 bg-red-600 hover:bg-red-500 py-3 rounded-xl font-bold"
            >
              Cancelar
            </button>

          </div>

        </div>

      </div>

    </div>

  </div>

</template>