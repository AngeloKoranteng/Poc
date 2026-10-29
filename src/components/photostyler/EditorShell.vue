<script setup lang="ts">
import EditorTopbar from "./editorTopbar.vue";
import EditorSidebar from "./EditorSidebar.vue";
import EditorToolbar from "./EditorToolbar.vue";
import EditorCanvas from "./EditorCanvas.vue";
import EditorFooter from "./EditorFooter.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const {
  draftBusy,
  editorRoot,
  editorZoom,
} = usePhotoStylerContext();

function bindEditorRoot(element: unknown) {
  editorRoot.value =
    typeof HTMLElement !== "undefined" && element instanceof HTMLElement
      ? element
      : null;
}
</script>

<template>
  <div class="editor-zoom-viewport">
    <section
      :ref="bindEditorRoot"
      class="editor"
      :style="{ transform: `scale(${editorZoom})` }"
      aria-label="Photo Styler editor"
      :aria-busy="draftBusy"
    >
      <EditorTopbar :inert="draftBusy" />
      <div class="editorindeling" :inert="draftBusy">
        <EditorSidebar />
        <div class="editor-main">
          <EditorToolbar />
          <EditorCanvas />
        </div>
      </div>
      <EditorFooter />
    </section>
  </div>
</template>

<style src="../../styles/photostyler.css"></style>
