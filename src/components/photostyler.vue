<script setup lang="ts">
import ConceptStatus from "./photostyler/ConceptStatus.vue";
import EditorTopbar from "./photostyler/editorTopbar.vue";
import EditorNavigation from "./photostyler/EditorNavigation.vue";
import UploadPanel from "./photostyler/UploadPanel.vue";
import ImagePanel from "./photostyler/ImagePanel.vue";
import TextPanel from "./photostyler/textPanel.vue";
import DrawPanel from "./photostyler/drawPanel.vue";
import BackgroundPanel from "./photostyler/backgroundPanel.vue";
import EditorCanvas from "./photostyler/EditorCanvas.vue";
import { usePhotoStyler } from "../composables/photostyler/usePhotoStyler.ts";
import { providePhotoStyler } from "../composables/photostyler/context.ts";

const editor = usePhotoStyler();
const { inspectorsLocked, draftBusy } = editor;
providePhotoStyler(editor);
</script>

<template>
  <section class="editor">
    <EditorTopbar :inert="draftBusy" />
    <ConceptStatus />

    <div class="editorindeling" :inert="draftBusy" :aria-busy="draftBusy">
      <EditorNavigation />

      <aside
        class="instellingen"
        aria-label="Gereedschapsinstellingen"
        :inert="inspectorsLocked"
        :aria-disabled="inspectorsLocked"
      >
        <UploadPanel />

        <ImagePanel />

        <TextPanel />

        <DrawPanel />

        <BackgroundPanel />
      </aside>

      <EditorCanvas />
    </div>
  </section>
</template>

<style scoped src="../styles/photostyler.css"></style>
