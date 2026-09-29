<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { readFormatting } from "../../composables/photostyler/textLayout.ts";

const props = defineProps({ modelValue: { type: Object, required: true } });
const emit = defineEmits(["update:modelValue", "voor-opmaak"]);
const veld = ref(null);
const vet = ref(false);
const cursief = ref(false);
let selectie = null;
let laatsteWaarde = "";

function getTextKey(tekst) {
  return JSON.stringify([tekst.inhoud, readFormatting(tekst)]);
}

function saveSelection() {
  const gekozen = window.getSelection();
  if (!gekozen?.rangeCount) return;
  const bereik = gekozen.getRangeAt(0);
  if (!veld.value?.contains(bereik.commonAncestorContainer)) return;
  selectie = bereik.cloneRange();
  vet.value = document.queryCommandState("bold");
  cursief.value = document.queryCommandState("italic");
}

function restoreSelection() {
  // Een cursor opnieuw plaatsen wist in sommige browsers de gekozen typstijl.
  const huidige = window.getSelection();
  if (document.activeElement === veld.value && huidige?.rangeCount &&
      veld.value.contains(huidige.getRangeAt(0).commonAncestorContainer)) return;
  veld.value.focus({ preventScroll: true });
  const gekozen = window.getSelection();
  if (!selectie || !veld.value.contains(selectie.commonAncestorContainer)) {
    selectie = document.createRange();
    selectie.selectNodeContents(veld.value);
    selectie.collapse(false);
  }
  gekozen.removeAllRanges();
  gekozen.addRange(selectie);
}

function readField() {
  let inhoud = "";
  const opmaak = [];
  function appendText(tekst, stijl) {
    inhoud += tekst;
    opmaak.push(...Array(tekst.length).fill(stijl));
  }
  function readNode(node, stijl = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.textContent, stijl);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const gewicht = node.style.fontWeight;
    if (node.matches("b, strong") || gewicht === "bold" || Number(gewicht) >= 600) stijl |= 1;
    if (gewicht === "normal" || (gewicht && Number(gewicht) < 600)) stijl &= ~1;
    if (node.matches("i, em") || node.style.fontStyle === "italic") stijl |= 2;
    if (node.style.fontStyle === "normal") stijl &= ~2;
    if (node.tagName === "BR") {
      // Een laatste br is de lege invoerregel van de browser.
      if (node.nextSibling) appendText("\n", stijl);
      return;
    }
    let vorigBlok = false;
    Array.from(node.childNodes).forEach((kind, index) => {
      const blok = kind.nodeType === Node.ELEMENT_NODE && kind.matches("div, p");
      if (index > 0 && (blok || vorigBlok)) appendText("\n", stijl);
      readNode(kind, stijl);
      vorigBlok = blok;
    });
  }
  readNode(veld.value);
  return { ...props.modelValue, inhoud, opmaak };
}

function syncContent() {
  const tekst = readField();
  // Ook plakken en invoer via een mobiel toetsenbord respecteren de limiet.
  if (tekst.inhoud.length > 500) {
    tekst.inhoud = tekst.inhoud.slice(0, 500);
    tekst.opmaak = tekst.opmaak.slice(0, 500);
    renderText(tekst);
    restoreSelection();
  }
  laatsteWaarde = getTextKey(tekst);
  emit("update:modelValue", tekst);
  saveSelection();
}

async function toggleFormatting(opdracht) {
  // Eerst eventuele tekstinvoer op het canvas afronden: die mag de nieuwe
  // formulieropmaak niet later overschrijven wanneer het canvas focus verliest.
  emit("voor-opmaak");
  await nextTick();
  restoreSelection();
  const gekozen = window.getSelection();
  const heelBlok = gekozen.isCollapsed && readField().inhoud.length > 0;
  if (heelBlok) {
    const bereik = document.createRange();
    bereik.selectNodeContents(veld.value);
    gekozen.removeAllRanges();
    gekozen.addRange(bereik);
  }
  // De browser bewaart hierbij zowel de typstijl als de lokale undo-geschiedenis.
  document.execCommand(opdracht);
  if (heelBlok) gekozen.collapseToEnd();
  syncContent();
}

function resetSelection() {
  selectie = null;
  const opmaak = readFormatting(props.modelValue);
  vet.value = opmaak.length > 0 && opmaak.every(waarde => (waarde & 1) !== 0);
  cursief.value = opmaak.length > 0 && opmaak.every(waarde => (waarde & 2) !== 0);
}

defineExpose({ resetSelection });

function handlePaste(event) {
  event.preventDefault();
  const gekozen = window.getSelection()?.toString().length ?? 0;
  const ruimte = Math.max(0, 500 - readField().inhoud.length + gekozen);
  const tekst = event.clipboardData.getData("text/plain").slice(0, ruimte);
  document.execCommand("insertText", false, tekst);
  syncContent();
}

function beforeInput(event) {
  if (event.isComposing || !event.inputType.startsWith("insert")) return;
  const gekozen = window.getSelection()?.toString().length ?? 0;
  if (readField().inhoud.length - gekozen >= 500) event.preventDefault();
}

function renderText(tekst) {
  if (!veld.value) return;
  const opmaak = readFormatting(tekst);
  const fragment = document.createDocumentFragment();
  for (let begin = 0; begin < tekst.inhoud.length;) {
    let einde = begin + 1;
    while (einde < tekst.inhoud.length && opmaak[einde] === opmaak[begin]) einde++;
    const span = document.createElement("span");
    span.textContent = tekst.inhoud.slice(begin, einde);
    span.style.fontWeight = opmaak[begin] & 1 ? "bold" : "normal";
    span.style.fontStyle = opmaak[begin] & 2 ? "italic" : "normal";
    fragment.append(span);
    begin = einde;
  }
  veld.value.replaceChildren(fragment);
  selectie = null;
  vet.value = opmaak.length > 0 && opmaak.every(waarde => (waarde & 1) !== 0);
  cursief.value = opmaak.length > 0 && opmaak.every(waarde => (waarde & 2) !== 0);
  laatsteWaarde = getTextKey(tekst);
}

watch(() => getTextKey(props.modelValue), (waarde) => {
  if (waarde !== laatsteWaarde) renderText(props.modelValue);
});

onMounted(() => {
  renderText(props.modelValue);
  document.addEventListener("selectionchange", saveSelection);
});
onBeforeUnmount(() => document.removeEventListener("selectionchange", saveSelection));
</script>

<template>
  <div class="tekstveld">
    <span>Jouw tekst</span>
    <div class="tekstopmaak" role="group" aria-label="Tekstopmaak">
      <button type="button" :aria-pressed="vet" @mousedown.prevent @click="toggleFormatting('bold')">
        <strong>Vet</strong>
      </button>
      <button type="button" :aria-pressed="cursief" @mousedown.prevent @click="toggleFormatting('italic')">
        <em>Cursief</em>
      </button>
    </div>
    <div
      ref="veld"
      class="rijke-tekstinvoer"
      contenteditable="true"
      role="textbox"
      aria-label="Jouw tekst"
      aria-multiline="true"
      :style="{ fontFamily: modelValue.lettertype ?? 'Arial' }"
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
