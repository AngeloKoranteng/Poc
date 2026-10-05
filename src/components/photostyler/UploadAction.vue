<script setup lang="ts">
import { computed } from "vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const props = defineProps({ layerId: { type: String, required: true } });
const {
  layers, selectedLayer, selectLayer, removeLayer,
  toggleLayerVisibility, toggleLayerLock, selectPanel,
} = usePhotoStylerContext();
const layer = computed(() => layers.value.find((item) => item.id === props.layerId));

function remove() {
  removeLayer(props.layerId);
  selectPanel("uploads");
}
</script>

<template>
  <div v-if="layer?.present" class="uploadacties" :class="{ geselecteerd: selectedLayer === layerId }"
    role="group" :aria-label="`${layer.name} beheren`">
    <p class="uploadstatus">
      {{ selectedLayer === layerId ? 'Geselecteerd' : layer.name }}
      · {{ layer.visible ? 'Zichtbaar' : 'Verborgen' }}
      <span v-if="layer.locked"> · Positie vast</span>
    </p>
    <div class="actieknoppen">
      <button type="button" :aria-label="`${layer.name} selecteren en bewerken`"
        @click="selectLayer(layerId)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-1 5 5-1L20 8l-4-4ZM14 6l4 4" /></svg>
        Bewerken
      </button>
      <button type="button" :aria-label="`${layer.name} zichtbaar`" :aria-pressed="layer.visible"
        @click="toggleLayerVisibility(layerId)">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          <path v-if="!layer.visible" d="M3 3l18 18" />
        </svg>
        {{ layer.visible ? 'Verbergen' : 'Tonen' }}
      </button>
      <button type="button" :aria-label="`${layer.name} positie vergrendeld`" :aria-pressed="layer.locked"
        @click="toggleLayerLock(layerId)">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path v-if="layer.locked" d="M8 10V6a4 4 0 0 1 8 0v4" />
          <path v-else d="M8 10V6a4 4 0 0 1 8 0" />
        </svg>
        {{ layer.locked ? 'Ontgrendelen' : 'Vastzetten' }}
      </button>
      <button class="actie-verwijderen" type="button" :aria-label="`${layer.name} verwijderen`" @click="remove">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
        </svg>
        Verwijderen
      </button>
    </div>
    <p v-if="!layer.visible" class="uploaduitleg">Deze afbeelding wordt niet meegenomen in je download.</p>
  </div>
</template>

<style scoped>
.uploadacties {
  margin: 10px 0 20px;
  padding: 12px;
  border: 1px solid #dce5df;
  border-radius: 10px;
  background: #f5f8f6;
  color: #26463c;
}
.uploadacties.geselecteerd { border-color: #63aab0; background: #eef8f8; }
.uploadstatus { margin: 0 0 10px; font-size: 12px; font-weight: 600; line-height: 1.5; }
.actieknoppen { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.actieknoppen button {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-height: 44px;
  min-width: 0;
  padding: 8px;
  border: 1px solid #dce5df;
  border-radius: 7px;
  background: #fff;
  color: #26463c;
  font-size: 12px;
  cursor: pointer;
}
.actieknoppen button:hover { background: #e5f1ee; border-color: #7da99b; }
.actieknoppen button:focus-visible { outline: 2px solid #00899b; outline-offset: 2px; }
.actieknoppen .actie-verwijderen { color: #a33424; }
.actieknoppen .actie-verwijderen:hover { background: #fff0ee; border-color: #dfa69f; }
svg { flex: 0 0 16px; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.uploaduitleg { margin: 10px 0 0; font-size: 12px; line-height: 1.5; }
</style>
