export function useVerflaag({
  verfCanvas, tekenModus, canvasKlaar, kwastKleur, kwastGrootte,
  heeftFoto, stopSlepen, stopKleurWijziging, bewaarToestand,
}) {
  // Verfstreken, de huidige streek en de actieve aanwijzer.
  let verfstreken = [];
  let actieveStreek = null;
  let tekenPointer = null;

  // Rekent de aanwijzerpositie om naar canvascoordinaten.
  function tekenPunt(event) {
    const rechthoek = verfCanvas.value.getBoundingClientRect();
    return {
      x: ((event.clientX - rechthoek.left) * verfCanvas.value.width) / rechthoek.width,
      y: ((event.clientY - rechthoek.top) * verfCanvas.value.height) / rechthoek.height,
    };
  }

  // Tekent een ronde stip of een lijnstuk op de verflaag.
  function verfSegment(streek, van, naar = van) {
    const context = verfCanvas.value.getContext("2d");
    context.fillStyle = streek.kleur;
    context.strokeStyle = streek.kleur;
    context.lineWidth = streek.grootte;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    if (van.x === naar.x && van.y === naar.y) {
      context.arc(van.x, van.y, streek.grootte / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.moveTo(van.x, van.y);
      context.lineTo(naar.x, naar.y);
      context.stroke();
    }
  }

  // Begint een kwaststreek met de gekozen kleur en dikte.
  function startTekenen(event) {
    if (
      !tekenModus.value ||
      !canvasKlaar.value ||
      !heeftFoto() ||
      tekenPointer !== null ||
      !event.isPrimary ||
      event.button !== 0
    )
      return;

    event.preventDefault();
    stopSlepen();
    stopKleurWijziging();
    bewaarToestand();
    tekenPointer = event.pointerId;
    verfCanvas.value.setPointerCapture(tekenPointer);
    actieveStreek = {
      kleur: kwastKleur.value,
      grootte: Math.max(1, Math.min(80, Number(kwastGrootte.value) || 1)),
      punten: [tekenPunt(event)],
    };
    verfstreken.push(actieveStreek);
    verfSegment(actieveStreek, actieveStreek.punten[0]);
  }

  // Voegt tijdens het bewegen punten toe aan de kwaststreek.
  function tijdensTekenen(event) {
    if (!actieveStreek || event.pointerId !== tekenPointer) return;
    event.preventDefault();
    const punt = tekenPunt(event);
    const vorigPunt = actieveStreek.punten[actieveStreek.punten.length - 1];
    if (punt.x === vorigPunt.x && punt.y === vorigPunt.y) return;
    actieveStreek.punten.push(punt);
    verfSegment(actieveStreek, vorigPunt, punt);
  }

  // Rondt de kwaststreek af en laat de aanwijzer los.
  function stopTekenen(event) {
    if (tekenPointer === null || (event && event.pointerId !== tekenPointer)) return;
    if (event?.type === "pointerup") tijdensTekenen(event);
    const pointer = tekenPointer;
    tekenPointer = null;
    actieveStreek = null;
    if (verfCanvas.value?.hasPointerCapture(pointer)) {
      verfCanvas.value.releasePointerCapture(pointer);
    }
  }

  // Bouwt de verflaag opnieuw op uit de overgebleven streken.
  function herstelVerflaag(aantal = 0) {
    stopTekenen();
    verfstreken.length = aantal;
    const canvas = verfCanvas.value;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    for (const streek of verfstreken) {
      verfSegment(streek, streek.punten[0]);
      for (let index = 1; index < streek.punten.length; index++) {
        verfSegment(streek, streek.punten[index - 1], streek.punten[index]);
      }
    }
  }

  return { startTekenen, tijdensTekenen, stopTekenen, herstelVerflaag,
    aantalVerfstreken: () => verfstreken.length,
  };
}
