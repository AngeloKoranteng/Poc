<script setup>
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const { panelen, actiefPaneel, kiesPaneel } = usePhotoStylerContext();
</script>

<template>
  <!-- Gereedschappen in de linker menubalk. -->
  <nav
    class="gereedschappen"
    aria-label="Editorgereedschappen"
  >
    <button
        v-for="paneel in panelen.filter( item => !['tekenen', 'tekst'].includes(item.id))"
      :key="paneel.id"
      type="button"
      :class="{ actief: actiefPaneel === paneel.id }"
      :aria-pressed="actiefPaneel === paneel.id"
      @click="kiesPaneel(paneel.id)"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path :d="paneel.icoon" />
      </svg>
      {{ paneel.naam }}
    </button>
    <span
      class="railvoet"
      aria-hidden="true"
      >MAAK HET<br />VAN JOU.</span
    >
  </nav>
</template>
