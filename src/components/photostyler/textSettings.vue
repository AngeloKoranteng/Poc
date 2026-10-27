<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import TextEditor from "./TextEditor.vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const {
  startCanvasText,
  stopCanvasText,
  canvasTextActive,
  textForm,
  applyText,
  removeText,
} = usePhotoStylerContext();

const textEditor = ref<InstanceType<typeof  TextEditor> | null>(null);
let applyTimer: ReturnType<typeof setTimeout> | undefined;

const textPalette = [
  "#172e2b",
  "#ffffff",
  "#ff0000",
  "#f3c55e",
  "#479775",
  "#527bdb",
  "#a76fcb",
  "#ed94a5",
];

function applyChanges(){
  if(applyTimer) clearTimeout(applyTimer);

  applyTimer = setTimeout(() => {
  if(!textForm.value.content.trim()) return;

  stopCanvasText();
  applyText();

  void nextTick(()  => {
    textEditor.value?.resetSelection();
    });
  }, 250);
}

onBeforeUnmount(() => {
  if (applyTimer) clearTimeout(applyTimer);
});

watch(
    textForm,
    () => {
      applyChanges();
    },
    { deep:true},
);
function beforeFormatting() {
  const canvasWasActive = canvasTextActive.value;
  stopCanvasText();
  if (canvasWasActive) textEditor.value?.resetSelection();
}

function chooseTextColor(color: string) {
  textForm.value.color = color;
  void applyChanges();
}
</script>
<template>
  <div class="tekstinstellingen">
    <button type="button" @click="startCanvasText">
      Typ op het canvas
    </button>

    <TextEditor
        ref="textEditor"
        v-model="textForm"
        @before-formatting="beforeFormatting"
    />

    <p class="kleine-tekst">
      Selecteer letters om alleen die op te maken.
      Zonder selectie veranderen Vet en Cursief het hele tekstblok.
    </p>

    <!-- Font, color, and size together. -->
    <details class="tekst-opties">
      <summary>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 19 10 5l6 14M6 14h8M18 6h4M20 6v13" />
        </svg>
        <span>Opmaak</span>
        <svg class="uitklappijl" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>


        <div class="tekst-opties-inhoud">
          <label class="tekstveld">
            <span>Lettertype</span>
            <select v-model="textForm.fontFamily">
              <option value="Arial">Arial</option>
              <option value="Verdana">Verdana</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
            </select>
          </label>
<label class="tekstveld">
  <span>Tekstkleur</span>

  <div  class="kleurkeuze tekstkleurkeuze">
    <input
    id="tekst-kleur"
    v-model="textForm.color"
    type="color"
    aria-label="Tekstkleur kiezen"
    @change="applyChanges"
    />

    <output>{{ textForm.color.toUpperCase() }}</output>
  </div>
</label>
          <div
            class="kleurpalet tekstkleurpalet"
            role="group"
            aria-label="Snelle tekstkleuren"
          >
            <button
              v-for="color in textPalette"
              :key="color"
              type="button"
              :style="{ background: color }"
              :aria-label="`Tekstkleur ${color}`"
              :aria-pressed="textForm.color.toLowerCase() === color"
              :class="{ gekozen: textForm.color.toLowerCase() === color }"
              @click="chooseTextColor(color)"
              />

          </div>

          <label class="tekstveld">
            <span>Lettergrootte in pixels</span>
            <input
              v-model.number="textForm.size"
              type="number"
              min="8"
              max="160"
            />
          </label>
        </div>
    </details>
      <button class="verwijderen" type="button" @click="removeText">
        Tekst verwijderen
      </button>
    </div>*
</template>

<style scoped>

.tekst-opties{
  margin-top: 12px;
  border: 1px solid var(--editor-border-dark);
  border-radius: 4px;
  overflow: hidden;
}

.tekst-opties > summary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 12px;
  color: var(--editor-on-dark);
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}


.tekst-opties > summary::-webkit-details-marker{
  display: none;
}

.tekst-opties > summary:hover {
  background: var(--editor-surface-hover);
}

.tekst-opties[open] > summary {
  background: var(--editor-surface-hover);
}

.tekst-opties > summary:focus-visible {
outline: 3px solid var(--editor-on-dark);
outline-offset: -3px;
}

.tekst-opties summary svg { width: 18px; height: 18px; flex: 0 0 18px; fill: none; stroke: currentColor; stroke-width: 1.6; }

.uitklappijl {
margin-left: auto;
}

.tekst-opties[open] .tekst-opties summary svg { width: 18px; height: 18px; flex: 0 0 18px; fill: none; stroke: currentColor; stroke-width: 1.6; }

.uitklappijl {
transform: rotate(180deg);
}

.tekst-opties-inhoud {
padding: 0 12px 12px;
}

</style>
