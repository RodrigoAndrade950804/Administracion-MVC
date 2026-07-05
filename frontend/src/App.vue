<template>
  <div :class="happyHourStore.config.is_active ? 'theme-neon min-h-screen bg-[#0f172a]' : 'theme-normal min-h-screen bg-[#111111]'">
    <router-view />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useHappyHourStore } from './stores/happyHourStore';

const happyHourStore = useHappyHourStore();

onMounted(() => {
  happyHourStore.loadConfig();
  happyHourStore.iniciarRealtimeHappyHour();
});
</script>