<script setup lang="ts">
import { nextTick, ref } from "vue";
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

async function applyChanges() {
  stopCanvasText();
  applyText();
  await nextTick();
  textEditor.value?.resetSelection();
}

function beforeFormatting() {
  const canvasWasActive = canvasTextActive.value;
  stopCanvasText();
  if (canvasWasActive) textEditor.value?.resetSelection();
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
          <input
              v-model="textForm.color"
              type="color"
          />
        </label>

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

    <!-- Less frequently used, precise positioning -->
    <details class="tekst-opties">
      <summary>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
              d="M12 3v18M3 12h18
               M9 6l3-3 3 3M9 18l3 3 3-3
               M6 9l-3 3 3 3M18 9l3 3-3 3"
          />
        </svg>
        <span>Positie</span>
        <svg class="uitklappijl" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <div class="tekst-opties-inhoud">
        <div class="knoppenrij">
          <label class="tekstveld">
            <span>Positie X</span>
            <input
                v-model.number="textForm.x"
                type="number"
                step="any"
            />
          </label>

          <label class="tekstveld">
            <span>Positie Y</span>
            <input
                v-model.number="textForm.y"
                type="number"
                step="any"
            />
          </label>
        </div>

        <p class="kleine-tekst">
          Je kunt de tekst ook rechtstreeks op het canvas verslepen.
          Met de grepen kun je schalen en draaien.
        </p>
      </div>
    </details>

    <div class="knoppenrij tekst-acties">
      <button
          type="button"
          :disabled="!textForm.content.trim()"
          @click="applyChanges"
      >
        Tekst toepassen
      </button>

      <button type="button" @click="removeText">
        Tekst wissen
      </button>
    </div>
  </div>
</template>

<style>

.tekst-opties{
  margin-top: 12px;
  border: 1px solid #dfe5e2;
  border-radius: 9px;
  overflow: hidden;
}

.tekst-opties > summary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 12px;
  color: #172e2b;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}

.tekst-opties > summary::-webkit-details-marker{
  display: none;
}

.tekst-opties > summary:hover {
  background: #edf7f8;
}

.tekst-opties[open] > summary {
  background: #00ABC1;
}

.tekst-opties > summary:focus-visible {
outline: 3px solid #172e2b;
outline-offset: -3px;
}

.uitklappijl {
margin-left: auto;
}

.tekst-opties[open] .uitklappijl {
transform: rotate(180deg);
}

.tekst-opties-inhoud {
padding: 0 12px 12px;
}

.tekst-acties {
margin-top: 20px;
}
</style>