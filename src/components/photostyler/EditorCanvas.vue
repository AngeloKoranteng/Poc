<script setup>
import CanvasTekstInvoer from "./CanvasTekstInvoer.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const {
  canvasTekstActief,
  startCanvasTekst,
  tekenModus,
  foutmelding,
  canvasHost,
  lagen,
    verwijderLaag,
    conceptMelding,
    conceptBezig,
  geselecteerdeLaag,
  selecteerLaag,
  wisselLaagZichtbaarheid,
  wisselLaagVergrendeling,
  inspectorsVergrendeld,
  verfCanvas,
  startTekenen,
  tijdensTekenen,
  stopTekenen,
  fileName,
  canvasKlaar,
  achtergrondBestandsnaam,
  achtergrondVoorbeeld,
  achtergrondIngesteld,
  kiesPaneel,
  bestandInput,
} = usePhotoStylerContext();
</script>

<template>
  <!-- Canvas met de afbeelding en een aparte verflaag. -->
  <main
    class="werkruimte"
    aria-label="Ontwerpcanvas"
  >
    <div class="werkbalk">
      <span
        ><span class="statusstip"></span
        >{{ tekenModus ? "Kwast actief" : "Ontwerpcanvas" }}</span
      ><button
        type="button"
        :disabled="!canvasKlaar || inspectorsVergrendeld"
        @click="startCanvasTekst"
      >Typ op het canvas</button><span>800 × 500 px</span>
    </div>
    <p
      v-if="foutmelding"
      class="foutmelding"
      role="alert"
    >
      {{ foutmelding }}
    </p>
    <p class="canvashint" role="status">{{ conceptMelding || "Bewaar uw ontwerp met Concept opslaan om later in deze browser verder te gaan." }}</p>
    <div class="canvasgebied" :inert="conceptBezig">
      <div class="papier">
        <div class="papierkop">
          <span>01 <strong>Jouw clubontwerp</strong></span
          ><span>PNG</span>
        </div>
        <div
          class="canvas-host"
          :class="{ 'kwast-actief': tekenModus }"
          @dblclick="geselecteerdeLaag === 'tekst' && !tekenModus && startCanvasTekst()"
        >
          <div ref="canvasHost"></div>
          <canvas
            ref="verfCanvas"
            class="verflaag"
            width="800"
            height="500"
            aria-label="Verflaag: teken met de kwast op de afbeelding"
            @pointerdown="startTekenen"
            @pointermove="tijdensTekenen"
            @pointerup="stopTekenen"
            @pointercancel="stopTekenen"
            @lostpointercapture="stopTekenen"
          />
          <div
              v-if="!achtergrondIngesteld && !fileName && !achtergrondBestandsnaam && !canvasTekstActief && !lagen.some(laag => laag.id === 'tekst' && laag.aanwezig)"
            class="leeg-canvas"
            :style="{ background: achtergrondVoorbeeld }"
          >
            <div
              class="leeg-icoon"
              aria-hidden="true"
            >
              ✳
            </div>
            <h2>Jouw club. Jouw ontwerp.</h2>
            <p>Alles begint met een logo of foto.</p>
            <button
              class="primaire-knop"
              type="button"
              :disabled="!canvasKlaar"
              @click="
                kiesPaneel('uploads');
                bestandInput?.click();
              "
            >
              Afbeelding toevoegen
            </button>
          </div>
          <CanvasTekstInvoer />
        </div>
        <p v-if="canvasTekstActief" class="canvashint">
          Enter: nieuwe regel · Klik buiten de tekst of druk Cmd/Ctrl + Enter om op te slaan · Escape: annuleren
        </p>
        <p v-else class="canvashint">
          {{
            tekenModus
            ? "Sleep om te tekenen · Kies links je kleur en kwastgrootte"
            : "Dubbelklik op tekst om te typen · Sleep om te verplaatsen"

          }}
        </p>

        <p
            v-if="achtergrondBestandsnaam && !tekenModus"
            class="canvashint"
           >
          Sleep de achtergrond op het canvas om de uitsnede te verschuiven.
          De achtergrond blijft het hele canvas vullen.
        </p>

        <section class="lagenpaneel" aria-label="Lagen" :inert="inspectorsVergrendeld">
          <h2>Lagen</h2>
          <p class="lagenuitleg">
            Selecteer een laag. Gebruik het oogje voor zichtbaarheid en het slotje
            om de positie vast te zetten. Verborgen lagen worden niet geëxporteerd.
          </p>
          <ul class="lagenlijst">
            <li
                v-for="laag in lagen.filter(laag => laag.id !== 'tekst')"
                :key="laag.id"
              class="laagrij"
              :class="{
                geselecteerd: laag.aanwezig && geselecteerdeLaag === laag.id,
                ontbreekt: !laag.aanwezig,
              }"
            >
              <button
                class="laagselectie"
                type="button"
                :disabled="!laag.aanwezig"
                :aria-pressed="laag.aanwezig && geselecteerdeLaag === laag.id"
                @click="selecteerLaag(laag.id)"
              >
                <strong>{{ laag.naam }}</strong>
                <small>{{ !laag.aanwezig ? 'Nog niet toegevoegd' : !laag.zichtbaar ? 'Verborgen' : laag.vergrendeld ? 'Positie vergrendeld' : 'Bewerkbaar' }}</small>
              </button>
              <button
                class="laagactie"
                type="button"
                :disabled="!laag.aanwezig"
                :aria-label="`${laag.naam} zichtbaar`"
                :aria-pressed="laag.zichtbaar"
                :title="laag.zichtbaar ? 'Verbergen' : 'Tonen'"
                @click="wisselLaagZichtbaarheid(laag.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  <path v-if="!laag.zichtbaar" d="M3 3l18 18" />
                </svg>
              </button>
              <button
                class="laagactie"
                type="button"
                :disabled="!laag.aanwezig"
                :aria-label="`${laag.naam} positie vergrendeld`"
                :aria-pressed="laag.vergrendeld"
                :title="laag.vergrendeld ? 'Positie ontgrendelen' : 'Positie vergrendelen'"
                @click="wisselLaagVergrendeling(laag.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                  <path v-if="laag.vergrendeld" d="M8 10V6a4 4 0 0 1 8 0v4" />
                  <path v-else d="M8 10V6a4 4 0 0 1 8 0" />
                  <path d="M12 14v3" />
                </svg>
              </button>
              <button
                class="laagactie laagverwijderen"
                type="button"
                :disabled="!laag.aanwezig"
                :aria-label="`${laag.naam} verwijderen`"
                :title="`${laag.naam} verwijderen`"
                @click="verwijderLaag(laag.id)"
                >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18"/>
                  <path d="M9 6V4h6v2"/>
                  <path d="m5 6 1 14h12l1-14"/>
                  <path d="M10 10v6M14 10v6"/>
                </svg>
              </button>
            </li>
          </ul>
        </section>

      </div>
    </div>
    <footer class="werkruimtevoet">
      <span>Gemaakt voor jouw club</span><span>Download je ontwerp om het te bewaren</span>
    </footer>
  </main>
</template>
<style scoped>
.lagenpaneel {
  margin-top: 20px;
  padding: 16px;
  border: 1px solid #dce5df;
  border-radius: 12px;
  background: #fff;
  text-align: left;
}

.lagenpaneel h2 {
  margin: 0 0 6px;
  font-size: 16px;
  color: #172e2b;
}

.lagenuitleg {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.5;
  color: #62746a;
}

.lagenlijst {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.laagrij {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #f5f7f4;
}

.laagrij.geselecteerd {
  border-color: #527b5c;
  background: #eaf2e7;
}

.laagrij.ontbreekt {
  opacity: 0.5;
}

.laagselectie {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
  padding: 6px;
  border: 0;
  background: transparent;
  color: #172e2b;
  text-align: left;
  cursor: pointer;
}

.laagselectie small {
  font-size: 11px;
  color: #62746a;
}

.laagactie {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  padding: 7px;
  border: 1px solid #dce5df;
  border-radius: 7px;
  background: #fff;
  color: #36513f;
  cursor: pointer;
}


.laagverwijderen{
  color: #b24318;
}

.laagverwijderen:hover:not(:disabled) {
  border-color: #f2b8b5;
  background: #fff1f0;
}

.laagactie svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.laagselectie:disabled,
.laagactie:disabled {
  cursor: default;
}

.laagselectie:focus-visible,
.laagactie:focus-visible {
  outline: 2px solid #527b5c;
  outline-offset: 2px;
}
</style>
