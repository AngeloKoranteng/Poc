<script setup>
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const { canvasKlaar,
    nieuwOntwerp,
  conceptBezig,
  slaConceptOp,
  achtergrondIngesteld,
  lagen,
  fileName,
  achtergrondBestandsnaam,
  geschiedenis,
  ongedaanMaken,
  downloadFoto } = usePhotoStylerContext();
</script>

<template>
  <!-- Titel en vaste acties. -->
  <header class="bovenbalk">
    <div class="merk">
      <span>Dappre <br>toolkit
      </span>
    </div>
    <div class="ontwerpnaam">
      <span class="bovenlabel">CLUBSTUDIO</span>
      <h1>{{ fileName || "Nieuw clubontwerp" }}</h1>
    </div>
    <div class="hoofdacties">
     <button
       class="undo"
       type="button"
       :disabled="!canvasKlaar || conceptBezig || geschiedenis.length === 0"
       title="Bewaar een bewerkbaar concept in deze browser"
       @click="slaConceptOp"
       >
       {{ conceptBezig ? "Even wachten..." : "Concept opslaan" }}
     </button>

      <button
        class="undo"
        type="button"
        :disabled="!canvasKlaar || conceptBezig || geschiedenis.length === 0"
        title="Wis het huidige ontwerp en begin met leeg canvas"
        @click="nieuwOntwerp"
        >
        <svg viewbox="0 0 24 24" aria-hidden="true">
          <path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5"/>
        </svg>
        <span>Nieuw ontwerp</span>
      </button>

      <button
        class="undo"
        type="button"
        @click="ongedaanMaken"
        title="Ongedaan maken (Ctrl+Z / Cmd+Z)"
        aria-keyshortcuts="Control+Z Meta+Z"
        :disabled="geschiedenis.length === 0"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12h-3" />
        </svg>
        <span>Ongedaan maken</span>
      </button>

      <button
        class="download"
        type="button"
        @click="downloadFoto"
        :disabled="!achtergrondIngesteld && !fileName && !achtergrondBestandsnaam && !lagen.some(laag => laag.id === 'tekst' && laag.aanwezig)"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
        </svg>
        Download <span class="formaat">PNG</span>
      </button>
    </div>
  </header>
</template>
