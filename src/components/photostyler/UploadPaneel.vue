<script setup>
import { ref } from "vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const {
  actiefPaneel,
  canvasKlaar,
  fileName,
  bestandInput,
  uploadFoto,
  achtergrondBestandsnaam,
  uploadAchtergrond,
  verwijderFoto,
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
      <span class="upload-icoon" aria-hidden="true">+</span>
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

    <h3>Achtergrond</h3>

    <button
        type="button"
        class="uploadveld"
        :disabled="!canvasKlaar"
        @click="achtergrondInput?.click()"
        @dragover.prevent
        @drop.prevent="ontvangBestand($event, uploadAchtergrond)"
    >
      <span class="upload-icoon" aria-hidden="true">+</span>
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
    <button
        v-if="fileName || achtergrondBestandsnaam"
        class="verwijderen"
        type="button"
        @click="verwijderFoto"
    >
      Geselecteerde afbeelding verwijderen
    </button>

  </section>
</template>
