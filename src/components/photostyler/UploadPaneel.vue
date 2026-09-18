<script setup>
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const { actiefPaneel, canvasKlaar, fileName, bestandInput, uploadFoto } = usePhotoStylerContext();
</script>

<template>
  <!-- Uploaden of vervangen van de afbeelding. -->
  <section
    v-show="actiefPaneel === 'uploads'"
    class="paneel"
  >
    <span class="bovenlabel">JOUW CLUB, JOUW STIJL</span>
    <h2>Begin met je logo</h2>
    <p>Geef je club een eigen gezicht. Voeg een logo of foto toe om te beginnen.</p>
    <label
      class="uploadveld"
      :class="{ geblokkeerd: !canvasKlaar }"
    >
      <span
        class="upload-icoon"
        aria-hidden="true"
        >+</span
      >
      <strong>{{ fileName ? "Afbeelding vervangen" : "Afbeelding kiezen" }}</strong>
      <span>JPG, PNG, WebP of SVG</span>
      <input
        ref="bestandInput"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml,.svg"
        :disabled="!canvasKlaar"
        @change="uploadFoto"
      />
    </label>
    <div
      v-if="fileName"
      class="bestandkaart"
    >
      <span class="statusstip"></span><span>{{ fileName }}</span>
    </div>

  </section>
</template>
