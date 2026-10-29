<script setup lang="ts">
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const { canvasReady,
    newDesign,
  draftBusy,
  saveDraft,
  backgroundConfigured,
  layers,
  fileName,
  backgroundFileName,
  history,
  undo,
  downloadPhoto } = usePhotoStylerContext();

const hasDownloadContent = () =>
  backgroundConfigured.value ||
  fileName.value ||
  backgroundFileName.value ||
  layers.value.some((layer) => layer.id === "tekst" && layer.present);

function startNewDesign() {
  if (history.value.length > 0 &&
      typeof window !== "undefined" &&
      !window.confirm("Je niet-opgeslagen wijzigingen worden verwijderd. Opnieuw beginnen?")) {
    return;
  }
  void newDesign();
}
</script>

<template>
  <!-- Editor actions stay connected to the existing shared handlers. -->
  <header class="bovenbalk">
    <div class="ontwerpnaam">
      <h2 class="project-name">{{ fileName || "Nieuw clubontwerp" }}</h2>
    </div>
    <div class="hoofdacties">
      <button
        class="actie-nieuw"
        aria-label="Nieuw ontwerp beginnen"
        type="button"
        :disabled="!canvasReady || draftBusy || history.length === 0"
        title="Wis het huidige ontwerp en begin opnieuw met een leeg canvas"
        @click="startNewDesign"
        >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6M12 11v6M9 14h6" />
        </svg>
        <span>Nieuw</span>
      </button>

      <button
        class="actie-ongedaan"
        aria-label="Laatste wijziging ongedaan maken"
        type="button"
        @click="undo"
        title="Maak de laatste wijziging ongedaan"
        aria-keyshortcuts="Control+Z Meta+Z"
        :disabled="history.length === 0"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 5 4 10l5 5" />
          <path d="M4 10h10a6 6 0 0 1 0 12" transform="translate(0 -2)" />
        </svg>
        <span>Ongedaan maken</span>
      </button>

     <button
       class="undo actie-opslaan"
       type="button"
       :disabled="!canvasReady || draftBusy"
       title="Bewaar een bewerkbaar concept in deze browser"
       @click="saveDraft"
       >
       {{ draftBusy ? "Even wachten..." : "Concept opslaan" }}
     </button>

      <button
        class="download actie-download"
        aria-label="Ontwerp downloaden"
        type="button"
        :disabled="!hasDownloadContent()"
        @click="downloadPhoto"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
        </svg>
        <span>Download</span>
        <span class="formaat">PNG</span>
      </button>
    </div>
  </header>
</template>
