<script setup>
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
const { inspectorsVergrendeld, conceptBezig } = editor;
providePhotoStyler(editor);
</script>

<template>
  <section class="editor">
    <EditorTopbar :inert="conceptBezig" />
    <ConceptStatus />

    <div class="editorindeling" :inert="conceptBezig" :aria-busy="conceptBezig">
      <EditorNavigation />

      <aside
        class="instellingen"
        aria-label="Gereedschapsinstellingen"
        :inert="inspectorsVergrendeld"
        :aria-disabled="inspectorsVergrendeld"
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
