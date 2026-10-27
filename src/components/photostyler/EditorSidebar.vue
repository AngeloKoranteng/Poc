<script setup lang="ts">
import EditorNavigation from "./EditorNavigation.vue";
import UploadPanel from "./UploadPanel.vue";
import ImagePanel from "./ImagePanel.vue";
import TextPanel from "./textPanel.vue";
import BackgroundPanel from "./backgroundPanel.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const { inspectorsLocked } = usePhotoStylerContext();
</script>

<template>
  <aside class="editor-sidebar" aria-label="Editorgereedschappen">
    <EditorNavigation />
    <div class="instellingen" :inert="inspectorsLocked" :aria-disabled="inspectorsLocked">
      <!-- Keep panels mounted: v-show preserves upload refs and local panel state. -->
      <UploadPanel />
      <ImagePanel />
      <TextPanel />
      <BackgroundPanel />
    </div>
  </aside>
</template>
