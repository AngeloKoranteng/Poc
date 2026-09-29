import { ref, computed } from "vue";

export function useColors() {
  // RGB-waarden van de achtergrond.
  const rood = ref(230);
  const groen = ref(230);
  const blauw = ref(230);

  // Koppelt de achtergrondsliders aan hun kleurwaarden.
  const achtergrondKanalen = [
    { naam: "Rood", waarde: rood },
    { naam: "Groen", waarde: groen },
    { naam: "Blauw", waarde: blauw },
  ];

  // Werkt het kleurvoorbeeld bij wanneer de achtergrond verandert.
  const achtergrondVoorbeeld = computed(() => getBackgroundColor());

  // Begrenst een kleurwaarde tot een geheel getal van 0 tot 255.
  function parseColorValue(waarde: number | string) {
    return Math.max(0, Math.min(255, Math.round(Number(waarde) || 0)));
  }

  // Maakt de RGB-kleur voor de canvasachtergrond.
  function getBackgroundColor() {
    return `rgb(${parseColorValue(rood.value)}, ${parseColorValue(groen.value)}, ${parseColorValue(blauw.value)})`;
  }

  return {
    rood,
    groen,
    blauw,
    achtergrondKanalen,
    achtergrondVoorbeeld,
    getBackgroundColor,
  };
}
