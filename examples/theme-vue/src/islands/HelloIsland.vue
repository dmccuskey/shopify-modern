<script setup lang="ts">
import { ref } from 'vue'
import type { SectionSettings } from '../sections'

defineProps<{ name: string } & Pick<SectionSettings['hello-world'], 'greeting'>>()
const clicks = ref(0)
</script>

<template>
  <p>
    {{ greeting || 'Hello' }} from {{ name }}, mounted by Vue.
    <button type="button" @click="clicks++">Clicked {{ clicks }} times</button>
  </p>
</template>
