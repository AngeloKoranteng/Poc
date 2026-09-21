<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const {
  canvasTekstActief,
  canvasTekstInvoer,
  canvasTekstOpmaak,
  stopCanvasTekst,
} = usePhotoStylerContext();
const invoer = ref(null);
const houder = ref(null);
const canvasBreedte = ref(800);
let observer;

const stijl = computed(() => {
  const tekst = canvasTekstOpmaak.value;
  const verhouding = canvasBreedte.value / 800;
  return {
    left: `${(Number(tekst.x) || 0) / 8}%`,
    top: `${(Number(tekst.y) || 0) / 5}%`,
    color: tekst.kleur,
    fontSize: `${tekst.grootte}px`,
    transform: `translate(-50%, -50%) rotate(${tekst.hoek ?? 0}deg) scale(${verhouding * (tekst.schaalX ?? 1)}, ${verhouding * (tekst.schaalY ?? 1)})`,
  };
});

async function pasHoogteAan() {
  await nextTick();
  if (!invoer.value) return;
  invoer.value.style.height = "auto";
  invoer.value.style.height = `${invoer.value.scrollHeight}px`;
}

watch(canvasTekstActief, async (actief) => {
  if (!actief) return;
  await pasHoogteAan();
  invoer.value?.focus();
  const einde = canvasTekstInvoer.value.length;
  invoer.value?.setSelectionRange(einde, einde);
});

function toets(event) {
  // Enter blijft beschikbaar voor nieuwe regels en IME-invoer.
  if (event.isComposing) return;
  if (event.key === "Escape") {
    event.preventDefault();
    stopCanvasTekst(false);
  } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    stopCanvasTekst();
  }
}

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    canvasBreedte.value = entry.contentRect.width;
  });
  observer.observe(houder.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div ref="houder" class="canvas-teksthouder">
    <textarea
      v-if="canvasTekstActief"
      ref="invoer"
      v-model="canvasTekstInvoer"
      class="canvas-tekstinvoer"
      :style="stijl"
      rows="1"
      maxlength="500"
      aria-label="Tekst op het canvas"
      placeholder="Typ je tekst…"
      @input="pasHoogteAan"
      @keydown.stop="toets"
      @pointerdown.stop
      @dblclick.stop
      @wheel.stop
      @blur="stopCanvasTekst()"
    />
  </div>
</template>

<style scoped>
.canvas-teksthouder {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.canvas-tekstinvoer {
  position: absolute;
  box-sizing: content-box;
  width: 720px;
  max-width: none;
  min-height: 1.2em;
  margin: 0;
  padding: 0;
  border: 0;
  outline: 2px solid #527b5c;
  background: rgb(255 255 255 / 92%);
  font-family: Arial, sans-serif;
  line-height: 1.2;
  text-align: center;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  resize: none;
  overflow: hidden;
  pointer-events: auto;
  transform-origin: center;
}
</style>
