<script setup lang="ts">
import PhotoStyler from "../components/photostyler.vue";

defineProps<{
  workspaceKey?: string;
}>();
</script>

<template>
  <PhotoStyler :workspace-key="workspaceKey" />
</template>
<style src="./photo-styler.css"></style>
<style src="../styles/photostyler.css"></style>