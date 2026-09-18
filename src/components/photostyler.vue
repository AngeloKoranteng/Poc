<script setup>
import EditorBovenbalk from "./photostyler/EditorBovenbalk.vue";
import EditorNavigatie from "./photostyler/EditorNavigatie.vue";
import UploadPaneel from "./photostyler/UploadPaneel.vue";
import AfbeeldingPaneel from "./photostyler/AfbeeldingPaneel.vue";
import TekstPaneel from "./photostyler/TekstPaneel.vue";
import TekenPaneel from "./photostyler/TekenPaneel.vue";
import AchtergrondPaneel from "./photostyler/AchtergrondPaneel.vue";
import EditorCanvas from "./photostyler/EditorCanvas.vue";
import { usePhotoStyler } from "../composables/photostyler/usePhotoStyler.js";
import { providePhotoStyler } from "../composables/photostyler/context.js";

const editor = usePhotoStyler();
const { inspectorsVergrendeld } = editor;
providePhotoStyler(editor);
</script>

<template>
  <section class="editor">
    <EditorBovenbalk />

    <div class="editorindeling">
      <EditorNavigatie />

      <aside
        class="instellingen"
        aria-label="Gereedschapsinstellingen"
        :inert="inspectorsVergrendeld"
        :aria-disabled="inspectorsVergrendeld"
      >
        <UploadPaneel />

        <AfbeeldingPaneel />

        <TekstPaneel />

        <TekenPaneel />

        <AchtergrondPaneel />
      </aside>

      <EditorCanvas />
    </div>
  </section>
</template>

<style scoped src="../styles/photostyler.css"></style>
