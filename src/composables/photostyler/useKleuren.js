import { ref, computed } from "vue";

export function useKleuren() {
  // RGB-waarden van de achtergrond.
  const rood = ref(230);
  const groen = ref(230);
  const blauw = ref(230);

  // RGB-waarden van de fototint; 255 behoudt de oorspronkelijke kleur.
  const fotoRood = ref(255);
  const fotoGroen = ref(255);
  const fotoBlauw = ref(255);

  // Koppelt de achtergrondsliders aan hun kleurwaarden.
  const achtergrondKanalen = [
    { naam: "Rood", waarde: rood },
    { naam: "Groen", waarde: groen },
    { naam: "Blauw", waarde: blauw },
  ];

  // Koppelt de fototintsliders aan hun kleurwaarden.
  const tintKanalen = [
    { naam: "Rood", waarde: fotoRood },
    { naam: "Groen", waarde: fotoGroen },
    { naam: "Blauw", waarde: fotoBlauw },
  ];

  // Werkt het kleurvoorbeeld bij wanneer de achtergrond verandert.
  const achtergrondVoorbeeld = computed(() => achtergrondKleur());

  // Begrenst een kleurwaarde tot een geheel getal van 0 tot 255.
  function kleurGetal(waarde) {
    return Math.max(0, Math.min(255, Math.round(Number(waarde) || 0)));
  }

  // Maakt de RGB-kleur voor de canvasachtergrond.
  function achtergrondKleur() {
    return `rgb(${kleurGetal(rood.value)}, ${kleurGetal(groen.value)}, ${kleurGetal(blauw.value)})`;
  }

  // Zet de fotokleuren om naar een Pixi-kleurgetal.
  function fotoTint() {
    return (
      kleurGetal(fotoRood.value) * 65536 +
      kleurGetal(fotoGroen.value) * 256 +
      kleurGetal(fotoBlauw.value)
    );
  }

  return {
    rood,
    groen,
    blauw,
    fotoRood,
    fotoGroen,
    fotoBlauw,
    achtergrondKanalen,
    tintKanalen,
    achtergrondVoorbeeld,
    achtergrondKleur,
    fotoTint,
  };
}
