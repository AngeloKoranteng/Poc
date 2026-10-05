<script setup lang="ts">
import { ref } from "vue";
import UploadAction from "./UploadAction.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const {
  activePanel,
  canvasReady,
  fileName,
  logoPreviewUrl,
  backgroundUploadPreviewUrl,
  fileInput,
  uploadPhoto,
  backgroundFileName,
  uploadBackground,
} = usePhotoStylerContext();

const backgroundInput = ref<HTMLInputElement | null>(null);

function receiveFile(event: DragEvent, upload: typeof uploadPhoto) {
  if (!canvasReady.value) return;

  const files = event.dataTransfer?.files;
  if (!files?.length) return;

  return upload({
    target: {
      files: files,
      value: "",
    },
  });
}
</script>

<template>
  <section v-show="activePanel === 'uploads'" class="paneel">
    <span class="bovenlabel">JOUW CLUB, JOUW STIJL</span>
    <h2>Logo en achtergrond</h2>
    <p>Kies een logo en een achtergrond voor je ontwerp.</p>

    <h3>Logo</h3>

    <button
        type="button"
        class="uploadveld"
        :disabled="!canvasReady"
        @click="fileInput?.click()"
        @dragover.prevent
        @drop.prevent="receiveFile($event, uploadPhoto)"
    >
      <img
        v-if="logoPreviewUrl"
        class="upload-preview"
        :src="logoPreviewUrl"
        :alt="`Voorbeeld van logo ${fileName}`"
        draggable="false"
      />
      <span v-else class="upload-icoon" aria-hidden="true">+</span>
      <strong>
        {{ fileName ? "Logo vervangen" : "Logo kiezen" }}
      </strong>
      <span>Gebruik een transparante PNG of SVG voor een vrijstaand logo.</span>

    </button>
      <input
          hidden
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml,.svg"
          :disabled="!canvasReady"
          @change="uploadPhoto"
      />


    <div v-if="fileName" class="bestandkaart">
      <span class="statusstip"></span>
      <span>{{ fileName }}</span>
    </div>

    <UploadAction layer-id="afbeelding" />

    <h3>Achtergrond</h3>

    <button
        type="button"
        class="uploadveld"
        :disabled="!canvasReady"
        @click="backgroundInput?.click()"
        @dragover.prevent
        @drop.prevent="receiveFile($event, uploadBackground)"
    >
      <img
        v-if="backgroundUploadPreviewUrl"
        class="upload-preview"
        :src="backgroundUploadPreviewUrl"
        :alt="`Voorbeeld van achtergrond ${backgroundFileName}`"
        draggable="false"
      />
      <span v-else class="upload-icoon" aria-hidden="true">+</span>
      <strong>
        {{
          backgroundFileName
              ? "Achtergrond vervangen"
              : "Achtergrond kiezen"
        }}
      </strong>
      <span>JPG, PNG, WebP of SVG</span>

    </button>
      <input
          hidden
          ref="backgroundInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml,.svg"
          :disabled="!canvasReady"
          @change="uploadBackground"
      />


    <div v-if="backgroundFileName" class="bestandkaart">
      <span class="statusstip"></span>
      <span>{{ backgroundFileName }}</span>
    </div>
    <UploadAction layer-id="achtergrond" />

  </section>
</template>

<style scoped>
.upload-preview {
  display: block;
  width: 100%;
  height: 120px;
  object-fit: contain;
  border: 1px solid #dce5df;
  border-radius: 8px;
  background-color: #fff;
  background-image: conic-gradient(#e9eeeb 25%, transparent 0 50%, #e9eeeb 0 75%, transparent 0);
  background-size: 16px 16px;
}
</style>
