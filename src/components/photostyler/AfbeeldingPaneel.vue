<script setup>
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const {
  actiefPaneel,
  kiesPaneel,
  fileName,
  achtergrondBestandsnaam,
  veranderSchaal,
  draaiFoto,
  verwijderFoto,
  plaatsLogo,
  achtergrondDonkerte,
  startKleurWijziging,
  stopKleurWijziging,
} = usePhotoStylerContext();
</script>

<template>
  <section v-show="actiefPaneel === 'afbeelding'" class="paneel">
    <span class="bovenlabel">MAAK HET PASSEND</span>
    <h2>Afbeelding</h2>
    <p>
      Klik op je logo of achtergrond om die te selecteren.
      De verwijderknop verwijdert de geselecteerde afbeelding.
    </p>

    <p v-if="!fileName && !achtergrondBestandsnaam" class="tip">
      Upload eerst een logo of achtergrond.
    </p>

    <button
      class="primaire-knop"
      type="button"
      @click="kiesPaneel('uploads')"
    >
      Logo of achtergrond toevoegen
    </button>

    <fieldset :disabled="!fileName">
      <legend>Logo positioneren</legend>
      <div class="knoppenrij">
        <button type="button" @click="plaatsLogo('linksboven')">Linksboven</button>
        <button type="button" @click="plaatsLogo('rechtsboven')">Rechtsboven</button>
      </div>
      <div class="knoppenrij">
        <button type="button" @click="plaatsLogo('midden')">Midden</button>
      </div>
      <div class="knoppenrij">
        <button type="button" @click="plaatsLogo('linksonder')">Linksonder</button>
        <button type="button" @click="plaatsLogo('rechtsonder')">Rechtsonder</button>
      </div>
      <p class="tip">32 px afstand tot de rand. Een te groot logo wordt passend verkleind.</p>
      <h3>Formaat logo</h3>

      <div class="knoppenrij">
        <button type="button" @click="kiesPaneel('afbeelding'); veranderSchaal(0.9)">
          − Kleiner
        </button>
        <button type="button" @click="kiesPaneel('afbeelding'); veranderSchaal(1.1)">
          + Groter
        </button>
      </div>

      <h3>Draaien</h3>

      <div class="knoppenrij">
        <button type="button" @click="kiesPaneel('afbeelding'); draaiFoto(-15)">
          ↶ Links 15°
        </button>
        <button type="button" @click="kiesPaneel('afbeelding'); draaiFoto(15)">
          ↷ Rechts 15°
        </button>
      </div>
    </fieldset>

    <fieldset :disabled="!achtergrondBestandsnaam">
      <legend>Achtergrond verduisteren</legend>
      <label>
        Donkerte: {{ achtergrondDonkerte }}%
        <input
          v-model.number="achtergrondDonkerte"
          type="range"
          min="0"
          max="100"
          step="1"
          @pointerdown="startKleurWijziging"
          @keydown="startKleurWijziging"
          @change="stopKleurWijziging"
          @pointerup="stopKleurWijziging"
          @pointercancel="stopKleurWijziging"
          @keyup="stopKleurWijziging"
          @blur="stopKleurWijziging"
        />
      </label>
    </fieldset>

    <!-- Buiten het fieldset: werkt ook zonder logo. -->
    <button
        class="verwijderen"
        type="button"
        :disabled="!fileName && !achtergrondBestandsnaam"
        @click="verwijderFoto"
    >
      Geselecteerde afbeelding verwijderen
    </button>
  </section>
</template>
