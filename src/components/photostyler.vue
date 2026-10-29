<script setup lang="ts">
import EditorShell from "./photostyler/EditorShell.vue";
import { usePhotoStyler } from "../composables/photostyler/usePhotoStyler.ts";
import { providePhotoStyler } from "../composables/photostyler/context.ts";

const props = defineProps<{
  workspaceKey?: string;
}>();

// One editor instance owns all canvas and draft state, independent of page chrome.
providePhotoStyler(usePhotoStyler({ workspaceKey: props.workspaceKey }));
</script>

<template>
  <EditorShell />
</template>
