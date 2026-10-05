import { ref, computed } from "vue";

export function useColors() {
  // RGB-waarden van de achtergrond.
  const red = ref(230);
  const green = ref(230);
  const blue = ref(230);

  // Connects the background sliders to their color value
  const achtergrondKanalen = [
    { name: "Red", value: red },
    { name: "Green", value: green },
    { name: "Blue", value: blue },
  ];

  // Updates the color preview when the background changes
  const backgroundExample = computed(() => getBackgroundColor());

  // Limit a color value to an integer from 0 to 255
  function parseColorValue(value: number | string) {
    return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
  }

  // Creates the rgb color for the canvas background
  function getBackgroundColor() {
    return `rgb(${parseColorValue(red.value)}, ${parseColorValue(green.value)}, ${parseColorValue(blue.value)})`;
  }

  return {
    red,
    green,
    blue,
    achtergrondKanalen,
    backgroundExample,
    getBackgroundColor,
  };
}
