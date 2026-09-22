<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { leesOpmaak } from "../../composables/photostyler/tekstOpmaak.js";

const props = defineProps({ modelValue: { type: Object, required: true } });
const emit = defineEmits(["update:modelValue", "voor-opmaak"]);
const veld = ref(null);
const vet = ref(false);
const cursief = ref(false);
let selectie = null;
let laatsteWaarde = "";

function sleutel(tekst) {
  return JSON.stringify([tekst.inhoud, leesOpmaak(tekst)]);
}

function bewaarSelectie() {
  const gekozen = window.getSelection();
  if (!gekozen?.rangeCount) return;
  const bereik = gekozen.getRangeAt(0);
  if (!veld.value?.contains(bereik.commonAncestorContainer)) return;
  selectie = bereik.cloneRange();
  vet.value = document.queryCommandState("bold");
  cursief.value = document.queryCommandState("italic");
}

function herstelSelectie() {
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

function leesVeld() {
  let inhoud = "";
  const opmaak = [];
  function voegToe(tekst, stijl) {
    inhoud += tekst;
    opmaak.push(...Array(tekst.length).fill(stijl));
  }
  function lees(node, stijl = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      voegToe(node.textContent, stijl);
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
      if (node.nextSibling) voegToe("\n", stijl);
      return;
    }
    let vorigBlok = false;
    Array.from(node.childNodes).forEach((kind, index) => {
      const blok = kind.nodeType === Node.ELEMENT_NODE && kind.matches("div, p");
      if (index > 0 && (blok || vorigBlok)) voegToe("\n", stijl);
      lees(kind, stijl);
      vorigBlok = blok;
    });
  }
  lees(veld.value);
  return { ...props.modelValue, inhoud, opmaak };
}

function synchroniseer() {
  const tekst = leesVeld();
  // Ook plakken en invoer via een mobiel toetsenbord respecteren de limiet.
  if (tekst.inhoud.length > 500) {
    tekst.inhoud = tekst.inhoud.slice(0, 500);
    tekst.opmaak = tekst.opmaak.slice(0, 500);
    toonTekst(tekst);
    herstelSelectie();
  }
  laatsteWaarde = sleutel(tekst);
  emit("update:modelValue", tekst);
  bewaarSelectie();
}

async function wisselOpmaak(opdracht) {
  // Eerst eventuele tekstinvoer op het canvas afronden: die mag de nieuwe
  // formulieropmaak niet later overschrijven wanneer het canvas focus verliest.
  emit("voor-opmaak");
  await nextTick();
  herstelSelectie();
  const gekozen = window.getSelection();
  const heelBlok = gekozen.isCollapsed && leesVeld().inhoud.length > 0;
  if (heelBlok) {
    const bereik = document.createRange();
    bereik.selectNodeContents(veld.value);
    gekozen.removeAllRanges();
    gekozen.addRange(bereik);
  }
  // De browser bewaart hierbij zowel de typstijl als de lokale undo-geschiedenis.
  document.execCommand(opdracht);
  if (heelBlok) gekozen.collapseToEnd();
  synchroniseer();
}

function resetSelectie() {
  selectie = null;
  const opmaak = leesOpmaak(props.modelValue);
  vet.value = opmaak.length > 0 && opmaak.every(waarde => (waarde & 1) !== 0);
  cursief.value = opmaak.length > 0 && opmaak.every(waarde => (waarde & 2) !== 0);
}

defineExpose({ resetSelectie });

function plak(event) {
  event.preventDefault();
  const gekozen = window.getSelection()?.toString().length ?? 0;
  const ruimte = Math.max(0, 500 - leesVeld().inhoud.length + gekozen);
  const tekst = event.clipboardData.getData("text/plain").slice(0, ruimte);
  document.execCommand("insertText", false, tekst);
  synchroniseer();
}

function voorInvoer(event) {
  if (event.isComposing || !event.inputType.startsWith("insert")) return;
  const gekozen = window.getSelection()?.toString().length ?? 0;
  if (leesVeld().inhoud.length - gekozen >= 500) event.preventDefault();
}

function toonTekst(tekst) {
  if (!veld.value) return;
  const opmaak = leesOpmaak(tekst);
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
  laatsteWaarde = sleutel(tekst);
}

watch(() => sleutel(props.modelValue), (waarde) => {
  if (waarde !== laatsteWaarde) toonTekst(props.modelValue);
});

onMounted(() => {
  toonTekst(props.modelValue);
  document.addEventListener("selectionchange", bewaarSelectie);
});
onBeforeUnmount(() => document.removeEventListener("selectionchange", bewaarSelectie));
</script>

<template>
  <div class="tekstveld">
    <span>Jouw tekst</span>
    <div class="tekstopmaak" role="group" aria-label="Tekstopmaak">
      <button type="button" :aria-pressed="vet" @mousedown.prevent @click="wisselOpmaak('bold')">
        <strong>Vet</strong>
      </button>
      <button type="button" :aria-pressed="cursief" @mousedown.prevent @click="wisselOpmaak('italic')">
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
      @beforeinput="voorInvoer"
      @input="synchroniseer"
      @paste="plak"
      @drop.prevent
      @keydown.stop
      @mouseup="bewaarSelectie"
      @keyup="bewaarSelectie"
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
