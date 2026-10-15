<script setup lang="ts">
import EditorTopbar from "./editorTopbar.vue";
import EditorSidebar from "./EditorSidebar.vue";
import EditorToolbar from "./EditorToolbar.vue";
import EditorCanvas from "./EditorCanvas.vue";
import EditorFooter from "./EditorFooter.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const { draftBusy, editorRoot } = usePhotoStylerContext();

function bindEditorRoot(element: unknown) {
  editorRoot.value =
    typeof HTMLElement !== "undefined" && element instanceof HTMLElement
      ? element
      : null;
}
</script>

<template>
  <section
    :ref="bindEditorRoot"
    class="editor"
    aria-label="Photo Styler editor"
    :aria-busy="draftBusy"
  >
    <EditorTopbar :inert="draftBusy" />
    <div class="editorindeling" :inert="draftBusy">
      <EditorSidebar />
      <div class="editor-main">
        <EditorToolbar />
        <EditorCanvas />
        <!-- Future viewport controls belong here, outside the Pixi host. -->
        <div v-if="$slots['zoom-controls']" class="zoom-controls">
          <slot name="zoom-controls" />
        </div>
      </div>
    </div>
    <EditorFooter />
  </section>
</template>

<style scoped src="../../styles/photostyler.css"></style>
