// Eén bewerkbaar concept per browser en website. Blobs blijven lokaal.
const DATABASE = "photostyler";
const OPSLAG = "concepten";
const SLEUTEL = "huidig";
let transactieNummer = 0;

function logConcept(log, concept) {
  for (const veld of ["foto", "achtergrond"]) {
    const bestand = concept[veld];
    if (!bestand) {
      log(`${veld}: geen bestand opgeslagen.`);
      continue;
    }
    log(`${veld}: het File-object bevat de afbeeldingsbytes, niet alleen de bestandsnaam.`, {
      naam: bestand.name,
      type: bestand.type,
      bytes: bestand.size,
    });
    // Klap dit object in de console open om het echte bestand te bekijken.
    log(`${veld}: bestand`, bestand);
  }
  log("Bewerkingen staan apart van de originele foto's:", concept.toestand);
  log("Verfstreken:", concept.verfstreken);
}

export async function conceptTransactie(actie, concept) {
  const prefix = `[Concept ${++transactieNummer} · ${actie}]`;
  const log = (bericht, ...gegevens) => console.info(prefix, bericht, ...gegevens);
  let db;

  try {
    log("1. Open IndexedDB. De opslag hoort bij dit websiteadres in deze browser.", {
      database: DATABASE, opslag: OPSLAG, sleutel: SLEUTEL,
    });
    db = await new Promise((resolve, reject) => {
      const aanvraag = indexedDB.open(DATABASE, 1);
      aanvraag.onupgradeneeded = () => {
        log("Eerste gebruik: maak de object store 'concepten' aan.");
        aanvraag.result.createObjectStore(OPSLAG);
      };
      aanvraag.onsuccess = () => resolve(aanvraag.result);
      aanvraag.onerror = () => reject(aanvraag.error);
      aanvraag.onblocked = () => reject(new Error("Opslag is geblokkeerd."));
    });
    log("2. Database geopend.");

    return await new Promise((resolve, reject) => {
      const lezen = actie === "lezen";
      const transactie = db.transaction(OPSLAG, lezen ? "readonly" : "readwrite");
      const opslag = transactie.objectStore(OPSLAG);

      if (lezen) {
        log("4lees precies dezelfde sleutel als bij opslaan. Er wordt niet op bestandsnaam gezocht.");
      } else {
        log("bewaar een kopie van de bestanden en bewerkingen. Een bestaand concept op deze sleutel wordt vervangen.");
        logConcept(log, concept);
      }
      const aanvraag = lezen ? opslag.get(SLEUTEL) : opslag.put(concept, SLEUTEL);
      // Pas als de hele transactie klaar is, is de opslag echt geslaagd.
      transactie.oncomplete = () => {
        if (lezen) {
          if (aanvraag.result) {
            log("5. Concept gevonden onder 'huidig'. Dit is de laatst succesvol opgeslagen versie.");
            logConcept(log, aanvraag.result);
          } else {

          }
        } else {
          log("5. Transactie voltooid: concept daadwerkelijk opgeslagen onder sleutel", aanvraag.result);
        }
        resolve(aanvraag.result);
      };
      transactie.onerror = () => reject(transactie.error);
      transactie.onabort = () => reject(transactie.error || new Error("Opslaan afgebroken."));
    });
  } catch (error) {
    console.error(prefix, "Concepttransactie mislukt:", error);
    throw error;
  } finally {
    if (db) {
      db.close();
      log("6. Databaseverbinding gesloten. De opgeslagen gegevens blijven bewaard.");
    }
  }
}
