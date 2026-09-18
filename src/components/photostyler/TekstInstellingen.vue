<script setup>
import { usePhotoStylerContext } from "../../composables/photostyler/context.js";

const { tekstFormulier, pasTekstToe, verwijderTekst } = usePhotoStylerContext();
</script>

<template>
  <!-- Tekst, opmaak en positie op het ontwerp. -->
  <div class="tekstinstellingen">

    <label class="tekstveld">
      <span>Jouw tekst</span>
      <textarea
        v-model="tekstFormulier.inhoud"
        rows="3"
        maxlength="500"
        placeholder="Bijvoorbeeld: Samen voor onze club!"
      ></textarea>
    </label>

    <label class="tekstveld">
      <span>Tekstkleur</span>
      <input v-model="tekstFormulier.kleur" type="color" />
    </label>

    <label class="tekstveld">
      <span>Lettergrootte in pixels</span>
      <input
        v-model.number="tekstFormulier.grootte"
        type="number"
        min="8"
        max="160"
      />
    </label>

    <div class="knoppenrij">
      <label class="tekstveld">
        <span>Positie X</span>
        <input v-model.number="tekstFormulier.x" type="number" step="any" />
      </label>

      <label class="tekstveld">
        <span>Positie Y</span>
        <input v-model.number="tekstFormulier.y" type="number" step="any" />
      </label>
    </div>

    <p class="kleine-tekst">
      Sleep de tekst op het canvas of gebruik X en Y. Met de grepen kun je de
      tekst schalen en draaien. Klik op toepassen om je wijzigingen te zien.
    </p>

    <div class="knoppenrij">
      <button
        type="button"
        :disabled="!tekstFormulier.inhoud.trim()"
        @click="pasTekstToe"
      >
        Tekst toepassen
      </button>

      <button type="button" @click="verwijderTekst">Tekst wissen</button>
    </div>
  </div>
</template>
