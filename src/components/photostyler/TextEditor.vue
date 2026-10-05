<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { readFormatting } from "../../composables/photostyler/textLayout.ts";
import type {
  TextContent,
  TextForm,
} from "../../composables/photostyler/types.ts";

const props = defineProps<{ modelValue: TextForm }>();

const emit = defineEmits<{
  "update:modelValue": [value: TextForm];
  "before-formatting": [];
}>();

const field = ref<HTMLDivElement | null>(null);
const bold = ref(false);
const italics = ref(false);

let selection: Range | null = null;
let lastValue = "";

function getTextKey(text: TextContent) {
  return JSON.stringify([text.content, readFormatting(text)]);
}

function saveSelection() {
  const chosen = window.getSelection();
  if (!chosen?.rangeCount) return;

  const range = chosen.getRangeAt(0);
  if (!field.value?.contains(range.commonAncestorContainer)) return;

  selection = range.cloneRange();
  bold.value = document.queryCommandState("bold");
  italics.value = document.queryCommandState("italic");
}

function restoreSelection() {
  const element = field.value;
  if (!element) return;

  const current = window.getSelection();
  if (
      document.activeElement === element &&
      current?.rangeCount &&
      element.contains(current.getRangeAt(0).commonAncestorContainer)
  ) {
    return;
  }

  element.focus({ preventScroll: true });

  const chosen = window.getSelection();
  if (!chosen) return;

  if (!selection || !element.contains(selection.commonAncestorContainer)) {
    selection = document.createRange();
    selection.selectNodeContents(element);
    selection.collapse(false);
  }

  chosen.removeAllRanges();
  chosen.addRange(selection);
}

function readField() {
  let content = "";
  const formatting: number[] = [];

  function appendText(text: string, style: number) {
    content += text;
    formatting.push(...Array<number>(text.length).fill(style));
  }

  function readNode(node: Node, style = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.textContent ?? "", style);
      return;
    }

    if (!(node instanceof HTMLElement)) return;

    const weight = node.style.fontWeight;

    if (
        node.matches("b, strong") ||
        weight === "bold" ||
        Number(weight) >= 600
    ) {
      style |= 1;
    }

    if (weight === "normal" || (weight && Number(weight) < 600)) {
      style &= ~1;
    }

    if (node.matches("i, em") || node.style.fontStyle === "italic") {
      style |= 2;
    }

    if (node.style.fontStyle === "normal") {
      style &= ~2;
    }

    if (node.tagName === "BR") {
      // A trailing br is the browser’s empty input line.
      if (node.nextSibling) appendText("\n", style);
      return;
    }

    let previousBlock = false;

    Array.from(node.childNodes).forEach((child, index) => {
      const block = child instanceof HTMLElement && child.matches("div, p");

      if (index > 0 && (block || previousBlock)) {
        appendText("\n", style);
      }

      readNode(child, style);
      previousBlock = block;
    });
  }

  if (field.value) readNode(field.value);

  return { ...props.modelValue, content, formatting };
}

function syncContent() {
  if (!field.value) return;

  const text = readField();

  if (text.content.length > 500) {
    text.content = text.content.slice(0, 500);
    text.formatting = text.formatting.slice(0, 500);
    renderText(text);
    restoreSelection();
  }

  lastValue = getTextKey(text);
  emit("update:modelValue", text);
  saveSelection();
}

async function toggleFormatting(command: "bold" | "italic") {
  emit("before-formatting");
  await nextTick();

  if (!field.value) return;

  restoreSelection();

  const chosen = window.getSelection();
  if (!chosen) return;

  const wholeBlock = chosen.isCollapsed && readField().content.length > 0;

  if (wholeBlock) {
    const range = document.createRange();
    range.selectNodeContents(field.value);
    chosen.removeAllRanges();
    chosen.addRange(range);
  }

  document.execCommand(command);

  if (wholeBlock) chosen.collapseToEnd();

  syncContent();
}

function resetSelection() {
  selection = null;

  const formatting = readFormatting(props.modelValue);

  bold.value =
      formatting.length > 0 && formatting.every((value) => (value & 1) !== 0);

  italics.value =
      formatting.length > 0 && formatting.every((value) => (value & 2) !== 0);
}

defineExpose({ resetSelection });

function handlePaste(event: ClipboardEvent) {
  event.preventDefault();

  if (!event.clipboardData) return;

  const chosen = window.getSelection()?.toString().length ?? 0;
  const room = Math.max(0, 500 - readField().content.length + chosen);
  const text = event.clipboardData.getData("text/plain").slice(0, room);

  document.execCommand("insertText", false, text);
  syncContent();
}

function beforeInput(event: Event) {
  if (!(event instanceof InputEvent)) return;
  if (event.isComposing || !event.inputType.startsWith("insert")) return;

  const chosen = window.getSelection()?.toString().length ?? 0;

  if (readField().content.length - chosen >= 500) {
    event.preventDefault();
  }
}

function renderText(text: TextContent) {
  if (!field.value) return;

  const formatting = readFormatting(text);
  const fragment = document.createDocumentFragment();

  for (let start = 0; start < text.content.length;) {
    let end = start + 1;

    while (
        end < text.content.length &&
        formatting[end] === formatting[start]
        ) {
      end++;
    }

    const style = formatting[start] ?? 0;
    const span = document.createElement("span");

    span.textContent = text.content.slice(start, end);
    span.style.fontWeight = style & 1 ? "bold" : "normal";
    span.style.fontStyle = style & 2 ? "italic" : "normal";

    fragment.append(span);
    start = end;
  }

  field.value.replaceChildren(fragment);
  resetSelection();
  lastValue = getTextKey(text);
}

watch(
    () => getTextKey(props.modelValue),
    (value) => {
      if (value !== lastValue) {
        renderText(props.modelValue);
      }
    },
);

onMounted(() => {
  renderText(props.modelValue);
  document.addEventListener("selectionchange", saveSelection);
});

onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", saveSelection);
});
</script>
<template>
  <div class="tekstveld">
    <span>Jouw tekst</span>
    <div class="tekstopmaak" role="group" aria-label="Tekstopmaak">
      <button type="button" :aria-pressed="bold" @mousedown.prevent @click="toggleFormatting('bold')">
        <strong>Vet</strong>
      </button>
      <button type="button" :aria-pressed="italics" @mousedown.prevent @click="toggleFormatting('italic')">
        <em>Cursief</em>
      </button>
    </div>
    <div
      ref="field"
      class="rijke-tekstinvoer"
      contenteditable="true"
      role="textbox"
      aria-label="Jouw tekst"
      aria-multiline="true"
      :style="{ fontFamily: modelValue.fontFamily ?? 'Arial' }"
      data-placeholder="Bijvoorbeeld: Samen voor onze club!"
      @beforeinput="beforeInput"
      @input="syncContent"
      @paste="handlePaste"
      @drop.prevent
      @keydown.stop
      @mouseup="saveSelection"
      @keyup="saveSelection"
    ></div>
  </div>
</template>

<style scoped>
.rijke-tekstinvoer {
  min-height: 100px;
  max-height: 300px;
  overflow-y: auto;
  width: 100%;
  padding: 10px;
  border: 1px solid #dfe5e2;
  border-radius: 8px;
  background: #fff;
  color: #172e2b;
  font-size: 16px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  cursor: text;
}
.rijke-tekstinvoer:focus-visible {
  outline: 3px solid #00abc1;
  outline-offset: 3px;
}
.rijke-tekstinvoer:empty::before {
  content: attr(data-placeholder);
  color: #718178;
  pointer-events: none;
}
</style>
