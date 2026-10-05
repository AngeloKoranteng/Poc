<script setup lang="ts">
import { computed } from "vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const {
  activePanel,
  backgroundPreview,
  canvasReady,
  backgroundChannels,
  brushPalette,
  stopColorChange,
  selectBackgroundColor,
} = usePhotoStylerContext();

// Convert the current RGB values to a hex color.
// This gives the selected color circle a border.
const chosenColor = computed(() =>
    "#" + backgroundChannels
        .map((channel) =>
            Number(channel.value.value).toString(16).padStart(2, "0")
        )
        .join("")
);


function applyColorInput(event: Event, continuous = false) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;

  selectBackgroundColor(input.value, continuous);
}

function applyHexColor(event: Event) {
  const input = event.target as HTMLInputElement;

  if (!input.checkValidity()) {
    input.reportValidity();
    return;
  }
  selectBackgroundColor(input.value.toLowerCase());
  input.value = chosenColor.value.toUpperCase();
}


</script>

<template>
  <section
      v-show="activePanel === 'achtergrond'"
      class="paneel"
  >
    <span class="bovenlabel">LAAT JE CLUBKLEUREN ZIEN</span>
    <h2>Achtergrond</h2>
    <p>Kies een achtergrond die bij uw club past..</p>

    <div
        class="kleurvoorbeeld"
        :style="{ background: backgroundPreview }"
        aria-label="Current background color"
    ></div>

    <fieldset :disabled="!canvasReady">
      <legend>Achtergrond kleur</legend>

    <label class="kleurkeuze">
      <span>Achtergrond kleur</span>

      <input
        type="color"
        :value="chosenColor"
        @input="applyColorInput($event, true)"
        @change="applyColorInput($event)"
        @blur="stopColorChange"
        />

    </label>

      <label class="tekstveld">
        <span>Hex color</span>
        <input
          type="text"
          :value="chosenColor.toUpperCase()"
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
          aria-label="Background color presets"
      >
        <button
            v-for="color in brushPalette"
            :key="color"
            type="button"
            :style="{ background: color }"
            :aria-label="'Background color ' + color"
            :aria-pressed="chosenColor === color"
            :class="{ gekozen: chosenColor === color }"
            :title="color"
            @click="selectBackgroundColor(color)"
        />
      </div>

    </fieldset>

    <p class="tip">
      Je kleur wordt direct toegepast. Een eventuele achtergrondfoto wordt verborgen;
      gebruik Lagen of Ongedaan maken om deze weer zichtbaar te maken.
    </p>
  </section>
</template>
