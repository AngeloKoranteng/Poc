<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
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
  zoomIn,
  zoomOut,
  resetEditorZoom,
} = usePhotoStylerContext();

const isFullscreen = ref(false);

function bindEditorRoot(element: unknown) {
  editorRoot.value =
    typeof HTMLElement !== "undefined" && element instanceof HTMLElement
      ? element
      : null;
}

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === editorRoot.value;
}

async function toggleFullscreen() {
  const root = editorRoot.value;
  if (!root || typeof document === "undefined") return;

  try {
    if (document.fullscreenElement === root) {
      await document.exitFullscreen();
    } else if (!document.fullscreenElement && root.requestFullscreen) {
      await root.requestFullscreen();
    }
  } catch (error) {
    console.warn("Photo Styler fullscreen is not available:", error);
  }
}

onMounted(() => document.addEventListener("fullscreenchange", syncFullscreenState));
onBeforeUnmount(() => document.removeEventListener("fullscreenchange", syncFullscreenState));
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
          <div class="zoom-controls" aria-label="Photo Styler zoom">
            <button
              type="button"
              :disabled="draftBusy || editorZoom <= 0.5"
              aria-label="Photo Styler uitzoomen"
              @click="zoomOut"
            >
              −
            </button>
            <button
              class="zoom-percentage"
              type="button"
              :disabled="draftBusy"
              :aria-label="`Photo Styler terugzetten naar 100 procent; huidige zoom ${Math.round(editorZoom * 100)} procent`"
              @click="resetEditorZoom"
            >
              {{ Math.round(editorZoom * 100) }}%
            </button>
            <button
              type="button"
              :disabled="draftBusy || editorZoom >= 2"
              aria-label="Photo Styler inzoomen"
              @click="zoomIn"
            >
              +
            </button>
            <button
              class="zoom-fullscreen"
              type="button"
              :aria-pressed="isFullscreen"
              :aria-label="isFullscreen ? 'Volledig scherm sluiten' : 'Photo Styler op volledig scherm openen'"
              @click="toggleFullscreen"
            >

              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/>
              </svg>

            </button>
          </div>
        </div>
      </div>
      <EditorFooter />
    </section>
  </div>
</template>

<style scoped src="../../styles/photostyler.css"></style>
