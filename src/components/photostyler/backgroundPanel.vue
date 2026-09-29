<script setup lang="ts">
import { computed } from "vue";
import ColorSliders from "./colorSliders.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const {
  actiefPaneel,
  achtergrondVoorbeeld,
  canvasKlaar,
  achtergrondKanalen,
  kwastPalet,
  startColorChange,
  stopColorChange,
  selectBackgroundColor,
} = usePhotoStylerContext();

// Zet de huidige RGB-waarden om naar een hexkleur.
// Zo krijgt het gekozen kleurbolletje een rand.
const gekozenKleur = computed(() =>
    "#" + achtergrondKanalen
        .map((kanaal) =>
            Number(kanaal.waarde.value).toString(16).padStart(2, "0")
        )
        .join("")
);


function applyHexColor(event) {
  const veld = event.target;

  if (!veld.checkValidity()) {
    veld.reportValidity();
    return;
  }
  selectBackgroundColor(veld.value.toLowerCase());
  veld.value = gekozenKleur.value.toUpperCase();
}


</script>

<template>
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

    <label class="kleurkeuze">
      <span>Achtergrondkleur</span>

      <input
        type="color"
        :value="gekozenKleur"
        @input="selectBackgroundColor($event.target.value, true)"
        @change="selectBackgroundColor($event.target.value)"
        @blur="stopColorChange"
        />

    </label>

      <label class="tekstveld">
        <span>Hexkleur</span>
        <input
          type="text"
          :value="gekozenKleur.toUpperCase()"
          pattern="#[0-9a-fA-F]{6}"
          maxlength="7"
          required
          spellcheck="false"
          @change="applyHexColor"
          @keydown.enter.prevent="applyHexColor"
        />
      </label>

      <div
          class="kleurpalet"
          role="group"
          aria-label="Snelle achtergrondkleuren"
      >
        <button
            v-for="kleur in kwastPalet"
            :key="kleur"
            type="button"
            :style="{ background: kleur }"
            :aria-label="'Achtergrondkleur ' + kleur"
            :aria-pressed="gekozenKleur === kleur"
            :class="{ gekozen: gekozenKleur === kleur }"
            :title="kleur"
            @click="selectBackgroundColor(kleur)"
        />
      </div>

    </fieldset>

    <p class="tip">
      Je kleur wordt direct toegepast. Een achtergrondfoto wordt verborgen;
      via Lagen of Ongedaan maken kun je die weer tonen.
    </p>
  </section>
</template>
