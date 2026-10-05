<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { usePhotoStylerContext } from "../../composables/photostyler/context.ts";
import { updateContent } from "../../composables/photostyler/textLayout.ts";

const {
  canvasTextActive,
  canvasTextInput,
  canvasTextStyle,
  stopCanvasText,
} = usePhotoStylerContext();
const input = ref<HTMLTextAreaElement | null>(null);
const holder = ref<HTMLDivElement | null>(null);
const canvasWidth = ref(800);
let observer: ResizeObserver | undefined;

const style = computed(() => {
  const text = canvasTextStyle.value;
  const rate = canvasWidth.value / 800;
  return {
    left: `${(Number(text.x) || 0) / 8}%`,
    top: `${(Number(text.y) || 0) / 5}%`,
    color: text.color,
    fontFamily: text.fontFamily ?? "Arial",
    fontWeight: text.bold ? "bold" : "normal",
    fontStyle: text.italics ? "italic" : "normal",
    fontSize: `${text.size}px`,
    transform: `translate(-50%, -50%) rotate(${text.corner ?? 0}deg) scale(${rate * (text.scaleX ?? 1)}, ${rate * (text.scaleY ?? 1)})`,
  };
});

async function adjustHeight() {
  await nextTick();
  if (!input.value) return;
  input.value.style.height = "auto";
  input.value.style.height = `${input.value.scrollHeight}px`;
}

watch(canvasTextActive, async (active) => {
  if (!active) return;
  await adjustHeight();
  input.value?.focus();
  const end = canvasTextInput.value.length;
  input.value?.setSelectionRange(end, end);
});

function handleKeydown(event: KeyboardEvent) {
  // Keep Enter available for new lines and IME input.
  if (event.isComposing) return;
  if (event.key === "Escape") {
    event.preventDefault();
    stopCanvasText(false);
  } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    stopCanvasText();
  }
}

function updateCanvasContent(event: Event) {
  const field = event.target;
  if(!(field instanceof HTMLTextAreaElement)) return;
  canvasTextStyle.value = updateContent(
          canvasTextStyle.value,
          field.value,
  );
  void adjustHeight();
}

onMounted(() => {
  if (!holder.value) return;

  observer = new ResizeObserver(([entry]) => {
    if (entry) canvasWidth.value = entry.contentRect.width;
  });

  observer.observe(holder.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div ref="holder" class="canvas-teksthouder">
    <textarea
      v-if="canvasTextActive"
      ref="input"
      v-model="canvasTextInput"
      class="canvas-tekstinvoer"
      :style="style"
      rows="1"
      maxlength="500"
      aria-label="Tekst op het canvas"
      placeholder="Typ je tekst…"
      @input="updateCanvasContent"
      @keydown.stop="handleKeydown"
      @pointerdown.stop
      @dblclick.stop
      @wheel.stop
      @blur="stopCanvasText()"
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
