<script setup lang="ts">
import { computed } from "vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";

const props = defineProps({ layerId: { type: String, required: true } });
const {
  layers, selectedLayer, selectLayer, removeLayer, selectPanel,
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
    </p>
    <div class="actieknoppen">
      <button type="button" :aria-label="`${layer.name} selecteren en bewerken`"
        @click="selectLayer(layerId)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-1 5 5-1L20 8l-4-4ZM14 6l4 4" /></svg>
        Bewerken
      </button>
      <button class="actie-verwijderen" type="button" :aria-label="`${layer.name} verwijderen`" @click="remove">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
        </svg>
        Verwijderen
      </button>
    </div>
  </div>
</template>

<style scoped>
.uploadacties {
  margin: 10px 0 20px;
  padding: 12px 0;
  border: 0;
  border-top: 1px solid var(--editor-border-dark);
  border-radius: 0;
  background: transparent;
  color: var(--editor-on-dark);
}
.uploadacties.geselecteerd { border-color: var(--editor-accent); background: transparent; }
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
  border: 1px solid var(--editor-border-dark);
  border-radius: 4px;
  background: var(--editor-surface-raised);
  color: var(--editor-on-dark);
  font-size: 12px;
  cursor: pointer;
}
.actieknoppen button:hover { background: var(--editor-surface-hover); border-color: var(--editor-accent); }
.actieknoppen button:focus-visible { outline: 2px solid var(--editor-accent); outline-offset: 2px; }
.actieknoppen .actie-verwijderen { color: var(--editor-danger); }
.actieknoppen .actie-verwijderen:hover { background: var(--editor-surface-hover); border-color: var(--editor-danger); }
svg { flex: 0 0 16px; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.uploaduitleg { margin: 10px 0 0; font-size: 12px; line-height: 1.5; }
</style>
