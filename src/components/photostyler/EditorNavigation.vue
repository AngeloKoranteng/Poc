<script setup lang="ts">
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const { panels, activePanel, selectPanel } = usePhotoStylerContext();
</script>

<template>
  <!-- Tools in the left menu bar. -->
  <nav
    class="gereedschappen"
    aria-label="Editorgereedschappen"
  >
    <button
        v-for="panel in panels.filter( item => !['tekenen', 'tekst'].includes(item.id))"
      :key="panel.id"
      type="button"
      :class="{ actief: activePanel === panel.id }"
      :aria-pressed="activePanel === panel.id"
      @click="selectPanel(panel.id)"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path :d="panel.icon" />
      </svg>
      {{ panel.name }}
    </button>
    <span
      class="railvoet"
      aria-hidden="true"
      >MAAK HET<br />VAN JOU.</span
    >
  </nav>
</template>
