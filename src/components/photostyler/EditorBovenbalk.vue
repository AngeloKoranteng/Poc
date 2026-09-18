<script setup>
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const { fileName, geschiedenis, ongedaanMaken, downloadFoto } = usePhotoStylerContext();
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
        @click="ongedaanMaken"
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
        :disabled="!fileName"
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
