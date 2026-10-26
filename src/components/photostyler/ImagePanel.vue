<script setup lang="ts">
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const {
  activePanel,
  selectPanel,
  fileName,
  backgroundFileName,
  selectedLayer,
  selectLayer,
  changeScale,
  deletePhoto,
} = usePhotoStylerContext();

function chooseLayer(layerId: "afbeelding" | "achtergrond") {
  selectLayer(layerId);
}

function resizeSelected(factor: number) {
  changeScale(factor);
}
</script>

<template>
  <section v-show="activePanel === 'afbeelding'" class="paneel eenvoudige-afbeelding">
    <span class="bovenlabel">EENVOUDIG BEWERKEN</span>
    <h2>Logo en achtergrond</h2>
    <p>
      Kies hieronder wat je wilt aanpassen. Sleep daarna het logo of de
      achtergrond op het canvas naar de juiste plek.
    </p>

    <button
      class="primaire-knop"
      type="button"
      @click="selectPanel('uploads')"
    >
      Logo of achtergrond kiezen
    </button>

    <div v-if="fileName || backgroundFileName" class="afbeelding-keuzes">
      <div v-if="fileName" class="afbeelding-keuze">
        <div>
          <strong>Logo</strong>
          <span>{{ fileName }}</span>
        </div>
        <button
          type="button"
          :class="{ gekozen: selectedLayer === 'afbeelding' }"
          :aria-pressed="selectedLayer === 'afbeelding'"
          @click="chooseLayer('afbeelding')"
        >
          {{ selectedLayer === "afbeelding" ? "Gekozen" : "Kiezen" }}
        </button>
      </div>

      <div v-if="backgroundFileName" class="afbeelding-keuze">
        <div>
          <strong>Achtergrond</strong>
          <span>{{ backgroundFileName }}</span>
        </div>
        <button
          type="button"
          :class="{ gekozen: selectedLayer === 'achtergrond' }"
          :aria-pressed="selectedLayer === 'achtergrond'"
          @click="chooseLayer('achtergrond')"
        >
          {{ selectedLayer === "achtergrond" ? "Gekozen" : "Kiezen" }}
        </button>
      </div>
    </div>

    <div v-if="fileName || backgroundFileName" class="basis-acties">
      <h3>Gekozen afbeelding aanpassen</h3>
      <p class="tip">
        Sleep de gekozen afbeelding op het canvas. Gebruik deze knoppen om
        haar groter of kleiner te maken.
      </p>

      <div class="knoppenrij">
        <button
          type="button"
          :disabled="!selectedLayer"
          @click="resizeSelected(0.9)"
        >
          − Kleiner
        </button>
        <button
          type="button"
          :disabled="!selectedLayer"
          @click="resizeSelected(1.1)"
        >
          + Groter
        </button>
      </div>

      <button
        class="verwijderen"
        type="button"
        :disabled="!selectedLayer"
        @click="deletePhoto"
      >
        Gekozen afbeelding verwijderen
      </button>
    </div>

    <p v-else class="tip">
      Kies eerst een logo of achtergrond. Daarna kun je deze op het canvas
      verplaatsen en groter of kleiner maken.
    </p>
  </section>
</template>

<style scoped>
.eenvoudige-afbeelding > p {
  font-size: 15px;
  line-height: 1.5;
}

.afbeelding-keuzes {
  display: grid;
  gap: 10px;
  margin-top: 20px;
}

.afbeelding-keuze {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--editor-border-dark);
  border-radius: 4px;
}

.afbeelding-keuze > div {
  min-width: 0;
}

.afbeelding-keuze strong,
.afbeelding-keuze span {
  display: block;
}

.afbeelding-keuze span {
  margin-top: 4px;
  overflow-wrap: anywhere;
  color: var(--editor-muted-on-dark);
  font-size: 12px;
}

.afbeelding-keuze button {
  flex: 0 0 auto;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--editor-border-dark);
  border-radius: 4px;
  background: var(--editor-surface-raised);
  color: var(--editor-on-dark);
  cursor: pointer;
}

.afbeelding-keuze button.gekozen {
  border-color: var(--editor-accent);
  background: var(--editor-accent);
  color: var(--editor-on-accent);
}

.basis-acties {
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--editor-border-dark);
}

.basis-acties h3 {
  margin: 0 0 8px;
}

.basis-acties .tip {
  margin: 0 0 14px;
}

.verwijderen {
  width: 100%;
  margin-top: 14px;
}
</style>
