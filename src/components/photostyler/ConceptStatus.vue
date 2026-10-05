<script setup lang="ts">
import { computed } from "vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const { draftStatus, draftMessage } = usePhotoStylerContext();

type Presentation = {
  icon: string;
  title: string;
};

const defaultPresentation: Presentation = {
  icon: "i",
  title: "Bewaar je ontwerp om later verder te gaan",
};

const presentations = new Map<string, Presentation>([
  ["info", defaultPresentation],
  ["gewijzigd", { icon: "!", title: "Nog niet opgeslagen" }],
  ["bezig", { icon: "…", title: "Even geduld" }],
  ["opgeslagen", { icon: "✓", title: "Je concept is bewaard" }],
  ["fout", { icon: "!", title: "Bewaren of laden is niet gelukt" }],
]);

const presentation = computed(
    () => presentations.get(draftStatus.value) ?? defaultPresentation,
);
</script>
<template>

  <div class="conceptstatus" :class="draftStatus" role="status" aria-live="polite" aria-atomic="true">
    <span class="statusicoon" aria-hidden="true">{{ presentation.icon }}</span>
  <div>
  <strong> {{ presentation.title }}</strong>
  <p> {{ draftMessage || "Klik op Concept opslaan. Je ontwerp wordt bewaard in browser" }}</p>
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
