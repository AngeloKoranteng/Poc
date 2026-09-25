<script setup>
import { computed } from "vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const { conceptStatus, conceptMelding } = usePhotoStylerContext();
const presentatie = computed(() => ({
  info: { icoon: "i", titel: "Bewaar je ontwerp om later verder te gaan" },
  gewijzigd: { icoon: "!", titel: "Nog niet opgeslagen" },
  bezig: { icoon: "…", titel: "Even geduld" },
  opgeslagen: { icoon: "✓", titel: "Je concept is bewaard" },
  fout: { icoon: "!", titel: "Bewaren of laden is niet gelukt" },
}[conceptStatus.value]));
</script>

<template>

  <div class="conceptstatus" :class="conceptStatus" role="status" aria-live="polite" aria-atomic="true">
    <span class="statusicoon" aria-hidden="true">{{ presentatie.icoon }}</span>
  <div>
  <strong> {{ presentatie.titel }}</strong>
  <p> {{ conceptMelding || "Klik op Concept opslaan. Je ontwerp wordt bewaard in browser" }}</p>
  </div>
  </div>

</template>

<style scoped>
.conceptstatus{
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 16px 24px;
  padding: 16px 20px;
  border: 1px solid #9bc6dd;
  border-left: 5px solid currentColor;
  border-radius: 10px;
  background: #edf6fc;
  color: #174b6b;
}

.conceptstatus.gewijzigd{
  background: #fff7e3;
  border-color:#448451;
  color:#704b00;
}

.conceptstatus.opgeslagen{
  background: #edf8ef;
  border-color: #448451;
  color: #245b30;
}

.conceptstatus.fout{
  background: #fff0ee;
  border-color: #bc4c40;
  color: #8a2920;
}
.statusicoon{
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  height: 30px;
  border: 2px solid currentColor;
  border-radius: 50%;
  font-size: 20px;
  font-weight: 700;
}

strong { font-size: 16px; }
p { margin: 5px 0 0; line-height: 1.5; }
@media ( max-width: 760px){
  .conceptstatus {margin: 12px; padding: 14px; }
}


</style>
