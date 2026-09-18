<script setup>
import KleurSliders from "./KleurSliders.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const {
  actiefPaneel,
  achtergrondVoorbeeld,
  canvasKlaar,
  achtergrondKanalen,
  startKleurWijziging,
  stopKleurWijziging,
} = usePhotoStylerContext();
</script>

<template>
  <!-- Kleur van de canvasachtergrond. -->
  <section
    v-show="actiefPaneel === 'achtergrond'"
    class="paneel"
  >
    <span class="bovenlabel">LAAT JE CLUBKLEUR ZIEN</span>
    <h2>Achtergrond</h2>
    <p>Kies een achtergrond die bij je club past.</p>
    <div
      class="kleurvoorbeeld"
      :style="{ background: achtergrondVoorbeeld }"
      aria-label="Huidige achtergrondkleur"
    ></div>
    <fieldset :disabled="!canvasKlaar">
      <legend>Achtergrondkleur</legend>
      <KleurSliders
          :kanalen="achtergrondKanalen"
          label="Achtergrond"
          @start="startKleurWijziging"
          @stop="stopKleurWijziging"
        />
    </fieldset>
    <p class="tip">De achtergrondkleur wordt meegenomen in je PNG-download.</p>
  </section>
</template>
