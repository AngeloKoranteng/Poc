<script setup lang="ts">
import { ref, useId } from "vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const {
  activePanel,
  selectPanel,
  fileName,
  backgroundFileName,
  changeScale,
  rotatePhoto,
  deletePhoto,
  placeLogo,
  backgroundDarkness,
  startColorChange,
  stopColorChange,
  lightingValue,
  lightingAvailable,
  changeLighting,
  resetLighting,
} = usePhotoStylerContext();

const menuId = useId();
const openMenus = ref<string[]>([])

const features = [
  {
    id: "positie",
    name: "Positioneren",
    icon: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3",
  },
  {
    id: "formaat",
    name: "Formaat",
    icon: "M4 10V4h6M14 4h6v6M20 14v6h-6M10 20H4v-6M4 4l6 6M20 20l-6-6",
  },
  {
    id: "draaien",
    name: "Draaien",
    icon: "M3 4v6h6M3 10a9 9 0 1 1 2 8",
  },
  {
    id: "exposure",
    name: "Exposure",
    icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
  },
  {
    id: "donkerte",
    name: "Verduisteren",
    icon: "M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z",
  },
];

const featureGroups = [
  { name: "BASIS", items: features.slice(0, 3) },
  { name: "VERBETEREN", items: features.slice(3) },
];

function isOpen(id: string) {
  return openMenus.value.includes(id);
}

function toggleMenu(id: string) {
  stopColorChange();

  if (isOpen(id)) {
    openMenus.value = openMenus.value.filter((menu) => menu !== id);
  } else {
    openMenus.value.push(id);
  }
}

function updateNumber(event: Event, setting: "exposure" | "donkerte") {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;

  const text = input.value.trim().replace(/%$/, "").trim().replace(",", ".");
  const number = Number(text);

  if (text !== "" && Number.isFinite(number)) {
    if (setting === "exposure") {
      const value = Math.max(-2, Math.min(2, number));
      changeLighting(Math.round(value * 10) / 10);
    } else {
      startColorChange();
      backgroundDarkness.value = Math.max(
          0,
          Math.min(100, Math.round(number)),
      );
    }
    stopColorChange();
  }

  // Toon de toegepaste waarde, ook na lege of ongeldige invoer.
  input.value = setting === "exposure"
      ? lightingValue.value.toFixed(1)
      : `${backgroundDarkness.value}%`;
}

function handleLightingInput(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;

  changeLighting(input.value);
}
</script>

<template>
  <section v-show="activePanel === 'afbeelding'" class="paneel">
    <span class="bovenlabel">MAAK HET PASSEND</span>
    <h2>Afbeelding</h2>

    <p>
      Selecteer je logo of achtergrond. Klik op een icon om de
      bijbehorende instellingen te openen.
    </p>

    <p v-if="!fileName && !backgroundFileName" class="tip">
      Upload eerst een logo of achtergrond.
    </p>

    <button
        class="primaire-knop"
        type="button"
        @click="selectPanel('uploads')"
    >
      Logo of achtergrond toevoegen
    </button>

    <!-- Compact feature list with small icons and visible names. -->
    <div class="functieknoppen">
      <div
        v-for="group in featureGroups"
        :key="group.name"
        class="functiegroep"
        role="group"
        :aria-label="group.name"
      >
        <h3 class="functiegroep-titel">{{ group.name }}</h3>

        <button
          v-for="feature in group.items"
          :key="feature.id"
          class="functieknop"
          type="button"
          :aria-expanded="isOpen(feature.id)"
          :aria-controls="`${menuId}-${feature.id}`"
          @click="toggleMenu(feature.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path :d="feature.icon" />
          </svg>
          <span>{{ feature.name }}</span>
        </button>
      </div>
    </div>

    <!-- Positioning -->
    <fieldset
        v-show="isOpen('positie')"
        :id="`${menuId}-positie`"
        class="functiemenu"
        :disabled="!fileName"
    >
      <legend>Logo positioneren</legend>

      <div class="knoppenrij">
        <button type="button" @click="placeLogo('linksboven')">
          Linksboven
        </button>
        <button type="button" @click="placeLogo('rechtsboven')">
          Rechtsboven
        </button>
      </div>

      <div class="knoppenrij">
        <button type="button" @click="placeLogo('midden')">
          Midden
        </button>
      </div>

      <div class="knoppenrij">
        <button type="button" @click="placeLogo('linksonder')">
          Linksonder
        </button>
        <button type="button" @click="placeLogo('rechtsonder')">
          Rechtsonder
        </button>
      </div>

      <p class="tip">
        32 px afstand tot de rand. Een te groot logo wordt passend verkleind.
      </p>
    </fieldset>

    <!-- Formaat -->
    <fieldset
        v-show="isOpen('formaat')"
        :id="`${menuId}-formaat`"
        class="functiemenu"
        :disabled="!fileName"
    >
      <legend>Formaat logo</legend>

      <div class="knoppenrij">
        <button
            type="button"
            @click="selectPanel('afbeelding'); changeScale(0.9)"
        >
          − Kleiner
        </button>
        <button
            type="button"
            @click="selectPanel('afbeelding'); changeScale(1.1)"
        >
          + Groter
        </button>
      </div>
    </fieldset>

    <!-- Draaien -->
    <fieldset
        v-show="isOpen('draaien')"
        :id="`${menuId}-draaien`"
        class="functiemenu"
        :disabled="!fileName"
    >
      <legend>Logo draaien</legend>

      <div class="knoppenrij">
        <button
            type="button"
            @click="selectPanel('afbeelding'); rotatePhoto(-15)"
        >
          ↶ Links 15°
        </button>
        <button
            type="button"
            @click="selectPanel('afbeelding'); rotatePhoto(15)"
        >
          ↷ Rechts 15°
        </button>
      </div>
    </fieldset>

    <!-- Exposure -->
    <fieldset
        v-show="isOpen('exposure')"
        :id="`${menuId}-exposure`"
        class="functiemenu"
        :disabled="!lightingAvailable"
    >
      <legend>Exposure — belichting</legend>

      <div class="schuifregelaar">
        <span>
          Belichting
          <input
            class="waarde-vakje"
            type="text"
            inputmode="decimal"
            aria-label="Belichting, van min 2 tot 2"
            :value="lightingValue.toFixed(1)"
            @focus="($event.target as HTMLInputElement).select()"
            @blur="updateNumber($event, 'exposure')"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          />
        </span>
        <input
          type="range"
          aria-label="Belichting"
          min="-2"
          max="2"
          step="0.1"
          :value="lightingValue"
          @input="handleLightingInput"
          @change="stopColorChange"
          @pointerup="stopColorChange"
          @pointercancel="stopColorChange"
          @keyup="stopColorChange"
          @blur="stopColorChange"
        />
      </div>

      <p class="kleine-tekst">
        Naar links maakt de afbeelding donkerder, naar rechts lichter.
      </p>

      <button
          type="button"
          :disabled="lightingValue === 0"
          @click="resetLighting"
      >
        Belichting herstellen
      </button>
    </fieldset>

    <!-- Achtergrond verduisteren -->
    <fieldset
        v-show="isOpen('donkerte')"
        :id="`${menuId}-donkerte`"
        class="functiemenu"
        :disabled="!backgroundFileName"
    >
      <legend>Achtergrond verduisteren</legend>

      <div class="schuifregelaar">
        <span>
          Donkerte
          <input
            class="waarde-vakje"
            type="text"
            inputmode="numeric"
            aria-label="Achtergrond donkerte, van 0 tot 100 procent"
            :value="`${backgroundDarkness}%`"
            @focus="($event.target as HTMLInputElement).select()"
            @blur="updateNumber($event, 'donkerte')"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          />
        </span>
        <input
          v-model.number="backgroundDarkness"
          type="range"
          aria-label="Achtergrond donkerte"
          min="0"
          max="100"
          step="1"
          @pointerdown="startColorChange"
          @keydown="startColorChange"
          @change="stopColorChange"
          @pointerup="stopColorChange"
          @pointercancel="stopColorChange"
          @keyup="stopColorChange"
          @blur="stopColorChange"
        />
      </div>
    </fieldset>

    <button
        class="verwijderen"
        type="button"
        :disabled="!fileName && !backgroundFileName"
        @click="deletePhoto"
    >
      Geselecteerde afbeelding verwijderen
    </button>
  </section>
</template>

<style scoped>
.functieknoppen {
  margin-top: 24px;
}

.functiegroep {
  padding: 14px 0;
}

.functiegroep + .functiegroep {
  border-top: 1px solid #e5e7eb;
}

.functieknoppen .functiegroep-titel {
  margin: 0 0 8px;
  padding: 0 12px;
  color: #7b828b;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
}

.functieknoppen .functieknop {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 14px;
  width: 100%;
  height: auto;
  min-height: 44px;
  margin: 0;
  padding: 11px 12px;
  border: 0;
  border-left: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #343b43;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.functieknoppen .functieknop svg {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: #7b828b;
}

.functieknoppen .functieknop:hover:not(:disabled) {
  background: #f3f5f6;
  border-left-color: transparent;
}

.functieknoppen .functieknop[aria-expanded="true"] {
  background: #edf8fa;
  border-left-color: #00abc1;
  color: #172e2b;
}

.functieknoppen .functieknop[aria-expanded="true"] svg {
  color: #00899b;
}

.functieknoppen .functieknop:focus-visible {
  outline: 2px solid #00abc1;
  outline-offset: -2px;
}

.functiemenu {
  margin-top: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e5e7eb;
}
</style>
