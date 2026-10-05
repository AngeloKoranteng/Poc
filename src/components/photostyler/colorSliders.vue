<script setup lang="ts">
import type { Ref } from "vue";

type ColorChannel = {
  name: string;
  value: Ref<number>;
};

defineProps<{
  channels: ColorChannel[];
  label: string;
}>();

defineEmits<{
  start: [];
  stop: [];
}>();

function updateChannel(event: Event, channel: ColorChannel) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;

  channel.value.value = Number(input.value);
}
</script>
<template>
  <label
    v-for="channel in channels"
    :key="channel.name"
    class="schuifregelaar"
  >
    <span
      >{{ channel.name }} <output>{{ channel.value.value }}</output></span
    >
    <input
      type="range"
      min="0"
      max="255"
      :aria-label="label + ' ' + channel.name"
      :value="channel.value.value"
      @input="updateChannel($event, channel)"
      @pointerdown="$emit('start')"
      @keydown="$emit('start')"
      @change="$emit('stop')"
      @blur="$emit('stop')"
    />
  </label>
</template>
