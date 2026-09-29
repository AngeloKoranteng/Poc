<script setup>
defineProps({
  kanalen: { type: Array, required: true },
  label: { type: String, required: true },
});
defineEmits(["start", "stop"]);
</script>

<template>
  <label
    v-for="kanaal in kanalen"
    :key="kanaal.naam"
    class="schuifregelaar"
  >
    <span
      >{{ kanaal.naam }} <output>{{ kanaal.waarde.value }}</output></span
    >
    <input
      type="range"
      min="0"
      max="255"
      :aria-label="label + ' ' + kanaal.naam"
      :value="kanaal.waarde.value"
      @input="kanaal.waarde.value = Number($event.target.value)"
      @pointerdown="$emit('start')"
      @keydown="$emit('start')"
      @change="$emit('stop')"
      @blur="$emit('stop')"
    />
  </label>
</template>
