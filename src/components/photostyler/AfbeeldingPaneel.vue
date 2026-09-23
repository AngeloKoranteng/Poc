<script setup>
import { ref, useId } from "vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const {
  actiefPaneel,
  kiesPaneel,
  fileName,
  achtergrondBestandsnaam,
  veranderSchaal,
  draaiFoto,
  verwijderFoto,
  plaatsLogo,
  achtergrondDonkerte,
  startKleurWijziging,
  stopKleurWijziging,
  belichtingWaarde,
  belichtingBeschikbaar,
  veranderBelichting,
  resetBelichting,
} = usePhotoStylerContext();

const menuId = useId();
const openMenus = ref([]);

const functies = [
  {
    id: "positie",
    naam: "Positioneren",
    icoon: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3",
  },
  {
    id: "formaat",
    naam: "Formaat",
    icoon: "M4 10V4h6M14 4h6v6M20 14v6h-6M10 20H4v-6M4 4l6 6M20 20l-6-6",
  },
  {
    id: "draaien",
    naam: "Draaien",
    icoon: "M3 4v6h6M3 10a9 9 0 1 1 2 8",
  },
  {
    id: "exposure",
    naam: "Exposure",
    icoon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
  },
  {
    id: "donkerte",
    naam: "Verduisteren",
    icoon: "M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z",
  },
];

const functiegroepen = [
  { naam: "BASIS", items: functies.slice(0, 3) },
  { naam: "VERBETEREN", items: functies.slice(3) },
];

function isOpen(id) {
  return openMenus.value.includes(id);
}

function wisselMenu(id) {
  stopKleurWijziging();

  if (isOpen(id)) {
    openMenus.value = openMenus.value.filter((menu) => menu !== id);
  } else {
    openMenus.value.push(id);
  }
}
</script>

<template>
  <section v-show="actiefPaneel === 'afbeelding'" class="paneel">
    <span class="bovenlabel">MAAK HET PASSEND</span>
    <h2>Afbeelding</h2>

    <p>
      Selecteer je logo of achtergrond. Klik op een icoon om de
      bijbehorende instellingen te openen.
    </p>

    <p v-if="!fileName && !achtergrondBestandsnaam" class="tip">
      Upload eerst een logo of achtergrond.
    </p>

    <button
        class="primaire-knop"
        type="button"
        @click="kiesPaneel('uploads')"
    >
      Logo of achtergrond toevoegen
    </button>

    <!-- Compacte functielijst met kleine iconen en zichtbare namen. -->
    <div class="functieknoppen">
      <div
        v-for="groep in functiegroepen"
        :key="groep.naam"
        class="functiegroep"
        role="group"
        :aria-label="groep.naam"
      >
        <h3 class="functiegroep-titel">{{ groep.naam }}</h3>

        <button
          v-for="functie in groep.items"
          :key="functie.id"
          class="functieknop"
          type="button"
          :aria-expanded="isOpen(functie.id)"
          :aria-controls="`${menuId}-${functie.id}`"
          @click="wisselMenu(functie.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path :d="functie.icoon" />
          </svg>
          <span>{{ functie.naam }}</span>
        </button>
      </div>
    </div>

    <!-- Positioneren -->
    <fieldset
        v-show="isOpen('positie')"
        :id="`${menuId}-positie`"
        class="functiemenu"
        :disabled="!fileName"
    >
      <legend>Logo positioneren</legend>

      <div class="knoppenrij">
        <button type="button" @click="plaatsLogo('linksboven')">
          Linksboven
        </button>
        <button type="button" @click="plaatsLogo('rechtsboven')">
          Rechtsboven
        </button>
      </div>

      <div class="knoppenrij">
        <button type="button" @click="plaatsLogo('midden')">
          Midden
        </button>
      </div>

      <div class="knoppenrij">
        <button type="button" @click="plaatsLogo('linksonder')">
          Linksonder
        </button>
        <button type="button" @click="plaatsLogo('rechtsonder')">
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
            @click="kiesPaneel('afbeelding'); veranderSchaal(0.9)"
        >
          − Kleiner
        </button>
        <button
            type="button"
            @click="kiesPaneel('afbeelding'); veranderSchaal(1.1)"
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
            @click="kiesPaneel('afbeelding'); draaiFoto(-15)"
        >
          ↶ Links 15°
        </button>
        <button
            type="button"
            @click="kiesPaneel('afbeelding'); draaiFoto(15)"
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
        :disabled="!belichtingBeschikbaar"
    >
      <legend>Exposure — belichting</legend>

      <label class="schuifregelaar">
        <span>
          Belichting
          <output>{{ belichtingWaarde.toFixed(1) }}</output>
        </span>

        <input
            type="range"
            min="-2"
            max="2"
            step="0.1"
            :value="belichtingWaarde"
            @input="veranderBelichting($event.target.value)"
            @change="stopKleurWijziging"
            @pointerup="stopKleurWijziging"
            @pointercancel="stopKleurWijziging"
            @keyup="stopKleurWijziging"
            @blur="stopKleurWijziging"
        />
      </label>

      <p class="kleine-tekst">
        Naar links maakt de afbeelding donkerder, naar rechts lichter.
      </p>

      <button
          type="button"
          :disabled="belichtingWaarde === 0"
          @click="resetBelichting"
      >
        Belichting herstellen
      </button>
    </fieldset>

    <!-- Achtergrond verduisteren -->
    <fieldset
        v-show="isOpen('donkerte')"
        :id="`${menuId}-donkerte`"
        class="functiemenu"
        :disabled="!achtergrondBestandsnaam"
    >
      <legend>Achtergrond verduisteren</legend>

      <label class="schuifregelaar">
        <span>
          Donkerte
          <output>{{ achtergrondDonkerte }}%</output>
        </span>

        <input
            v-model.number="achtergrondDonkerte"
            type="range"
            min="0"
            max="100"
            step="1"
            @pointerdown="startKleurWijziging"
            @keydown="startKleurWijziging"
            @change="stopKleurWijziging"
            @pointerup="stopKleurWijziging"
            @pointercancel="stopKleurWijziging"
            @keyup="stopKleurWijziging"
            @blur="stopKleurWijziging"
        />
      </label>
    </fieldset>

    <button
        class="verwijderen"
        type="button"
        :disabled="!fileName && !achtergrondBestandsnaam"
        @click="verwijderFoto"
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
