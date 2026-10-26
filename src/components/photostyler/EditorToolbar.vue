<script setup lang="ts">
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const { activePanel, selectPanel, canvasReady, inspectorsLocked } = usePhotoStylerContext();
</script>

<template>
  <div class="werkbalk" role="group" aria-label="Canvasgereedschappen" :inert="inspectorsLocked">
    <div class="toolbar-actions">
      <button type="button" :disabled="!canvasReady" :aria-pressed="activePanel === 'tekst'" @click="selectPanel('tekst')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6V3h16v3M12 3v18M8 21h8" /></svg>Tekst toevoegen</button>
    </div>
    <span>Canvas 800 × 500 px · PNG 1350 × 852 px</span>
  </div>
</template>
