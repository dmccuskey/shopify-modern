<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { SectionSettings } from '../sections'

type Settings = SectionSettings['announcement-countdown']

const props = defineProps<{ endsAt: number } & Pick<Settings, 'ended_message' | 'show_seconds'>>()

const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 1000)
// the theme editor unmounts the island whenever the merchant edits its section
onUnmounted(() => clearInterval(timer))

const left = computed(() => {
  const seconds = Math.max(0, Math.floor((props.endsAt - now.value) / 1000))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor(seconds / 3600) % 24
  const minutes = Math.floor(seconds / 60) % 60
  let time = `${hours}h ${minutes}m`
  if (props.show_seconds) time += ` ${seconds % 60}s`
  return days > 0 ? `${days}d ${time}` : time
})
const ended = computed(() => now.value >= props.endsAt)
</script>

<template>
  <span v-if="ended">{{ ended_message }}</span>
  <span v-else>Ends in {{ left }}.</span>
</template>
