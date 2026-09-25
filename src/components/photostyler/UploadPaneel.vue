<script setup>
import { ref } from "vue";
import UploadActies from "./UploadActies.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const {
  actiefPaneel,
  canvasKlaar,
  fileName,
  logoVoorbeeldUrl,
  achtergrondUploadVoorbeeldUrl,
  bestandInput,
  uploadFoto,
  achtergrondBestandsnaam,
  uploadAchtergrond,
} = usePhotoStylerContext();
const achtergrondInput = ref(null);

function ontvangBestand(event, upload) {
  if (!canvasKlaar.value) return;
  const bestanden = event.dataTransfer?.files;
  if (!bestanden?.length) return;
  upload({ target: { files: bestanden, value: "" } });
}
</script>

<template>
  <section v-show="actiefPaneel === 'uploads'" class="paneel">
    <span class="bovenlabel">JOUW CLUB, JOUW STIJL</span>
    <h2>Logo en achtergrond</h2>
    <p>Kies een logo en een achtergrond voor je ontwerp.</p>

    <h3>Logo</h3>

    <button
        type="button"
        class="uploadveld"
        :disabled="!canvasKlaar"
        @click="bestandInput?.click()"
        @dragover.prevent
        @drop.prevent="ontvangBestand($event, uploadFoto)"
    >
      <img
        v-if="logoVoorbeeldUrl"
        class="upload-preview"
        :src="logoVoorbeeldUrl"
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
          ref="bestandInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml,.svg"
          :disabled="!canvasKlaar"
          @change="uploadFoto"
      />


    <div v-if="fileName" class="bestandkaart">
      <span class="statusstip"></span>
      <span>{{ fileName }}</span>
    </div>

    <UploadActies laag-id="afbeelding" />

    <h3>Achtergrond</h3>

    <button
        type="button"
        class="uploadveld"
        :disabled="!canvasKlaar"
        @click="achtergrondInput?.click()"
        @dragover.prevent
        @drop.prevent="ontvangBestand($event, uploadAchtergrond)"
    >
      <img
        v-if="achtergrondUploadVoorbeeldUrl"
        class="upload-preview"
        :src="achtergrondUploadVoorbeeldUrl"
        :alt="`Voorbeeld van achtergrond ${achtergrondBestandsnaam}`"
        draggable="false"
      />
      <span v-else class="upload-icoon" aria-hidden="true">+</span>
      <strong>
        {{
          achtergrondBestandsnaam
              ? "Achtergrond vervangen"
              : "Achtergrond kiezen"
        }}
      </strong>
      <span>JPG, PNG, WebP of SVG</span>

    </button>
      <input
          hidden
          ref="achtergrondInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml,.svg"
          :disabled="!canvasKlaar"
          @change="uploadAchtergrond"
      />


    <div v-if="achtergrondBestandsnaam" class="bestandkaart">
      <span class="statusstip"></span>
      <span>{{ achtergrondBestandsnaam }}</span>
    </div>
    <UploadActies laag-id="achtergrond" />

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
