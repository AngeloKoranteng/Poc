import type { Draft } from "./types.ts";
// Eén bewerkbaar concept per browser en website. Blobs blijven lokaal.
const DATABASE = "photostyler";
const OPSLAG = "concepten";
const SLEUTEL = "huidig";
let transactieNummer = 0;

// Type-definitie voor de logfunctie zodat TypeScript weet hoe deze aangeroepen mag worden
type LogFunctie = (bericht: string, ...gegevens: unknown[]) => void;

function logDraft(log: LogFunctie, concept: Draft) {
  for (const veld of ["foto", "achtergrond"] as const) {
    const bestand = concept[veld] as File | undefined;
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

export async function draftTransaction(actie: "lezen" | "schrijven" | "verwijderen" | string, concept?: Draft) {
  const prefix = `[Concept ${++transactieNummer} · ${actie}]`;
  const log: LogFunctie = (bericht, ...gegevens) => console.info(prefix, bericht, ...gegevens);

  // Door hier expliciet 'IDBDatabase' op te geven, verdwijnt de foutmelding bij db.close()
  let db: IDBDatabase | undefined;

  try {
    log("1. Open IndexedDB. De opslag hoort bij dit websiteadres in deze browser.", {
      database: DATABASE, opslag: OPSLAG, sleutel: SLEUTEL,
    });
    db = await new Promise<IDBDatabase>((resolve, reject) => {
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

    return await new Promise<Draft | undefined>((resolve, reject) => {
      const lezen = actie === "lezen";
      const verwijderen = actie === "verwijderen";

      if (!["lezen", "schrijven", "verwijderen"].includes(actie)) {
        reject(new Error(`Onbekende conceptactie: ${actie}`));
        return;
      }

      // TypeScript weet nu 100% zeker dat db bestaat dankzij de eerdere Promise
      const transactie = db!.transaction(
          OPSLAG,
          lezen ? "readonly" : "readwrite",
      );
      const opslag = transactie.objectStore(OPSLAG);

      let aanvraag: IDBRequest;

      if (lezen) {
        aanvraag = opslag.get(SLEUTEL);
      } else if (verwijderen) {
        aanvraag = opslag.delete(SLEUTEL);
      } else {
        if (!concept) { reject(new Error("Geen concept om op te slaan.")); return; }
        logDraft(log, concept);
        aanvraag = opslag.put(concept, SLEUTEL);
      }

      // Wacht tot de volledige transactie succesvol is afgerond.
      transactie.oncomplete = () => {
        log(`Conceptactie '${actie}' voltooid.`);
        resolve(aanvraag.result);
      };

      transactie.onerror = () => reject(transactie.error);
      transactie.onabort = () => reject(
          transactie.error || new Error("Conceptactie afgebroken."),
      );
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
