<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ name: string }>()
const clicks = ref(0)
</script>

<template>
  <p>
    Hello from {{ name }}, mounted by Vue.
    <button type="button" @click="clicks++">Clicked {{ clicks }} times</button>
  </p>
</template>
