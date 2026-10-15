<script setup lang="ts">
import { computed } from "vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const { draftStatus, draftMessage } = usePhotoStylerContext();

type Presentation = {
  icon: string;
  title: string;
};

const defaultPresentation: Presentation = {
  icon: "i",
  title: "Bewaar je ontwerp om later verder te gaan",
};

const presentations = new Map<string, Presentation>([
  ["info", defaultPresentation],
  ["gewijzigd", { icon: "!", title: "Nog niet opgeslagen" }],
  ["bezig", { icon: "…", title: "Even geduld" }],
  ["opgeslagen", { icon: "✓", title: "Je concept is bewaard" }],
  ["fout", { icon: "!", title: "Bewaren of laden is niet gelukt" }],
]);

const presentation = computed(
    () => presentations.get(draftStatus.value) ?? defaultPresentation,
);
</script>
<template>

  <div class="conceptstatus" :class="draftStatus" role="status" aria-live="polite" aria-atomic="true">
    <span class="statusicoon" aria-hidden="true">{{ presentation.icon }}</span>
  <div>
  <strong> {{ presentation.title }}</strong>
  <p> {{ draftMessage || "Klik op Concept opslaan. Je ontwerp wordt bewaard in browser" }}</p>
  </div>
  </div>

</template>

<style scoped>
.conceptstatus { display: flex; align-items: center; gap: 12px; min-width: 0; color: var(--editor-on-dark); }
.conceptstatus > div { min-width: 0; }
.statusicoon { display: grid; place-items: center; flex: 0 0 20px; height: 20px; border: 1px solid currentColor; border-radius: 50%; color: var(--editor-muted-on-dark); font-size: 12px; }
.opgeslagen .statusicoon { color: var(--editor-accent); }
.fout .statusicoon { color: var(--editor-danger); }
strong { display: block; font-size: 12px; font-weight: 600; }
.conceptstatus p { margin: 4px 0 0; color: var(--editor-muted-on-dark); font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
</style>
