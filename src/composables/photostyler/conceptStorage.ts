import type { Draft } from "./types.ts";
import { decodeDraft, encodeDraft } from "./draftFormat.ts";
// One editable draft per browser and website. Blobs remain local.
const DATABASE = "photostyler";
// Preserve existing storage names; draftFormat maps the stored field names.
const STORE_NAME = "concepten";
const DRAFT_KEY = "huidig";
let transactionCount = 0;

// Type definition for the log function so that TypeScript knows how to call it
type LogFunction = (message: string, ...data: unknown[]) => void;

function logDraft(log: LogFunction, draft: Draft) {
  for (const field of ["image", "background"] as const) {
    const file = draft[field];
    if (!file) {
      log(`${field}: no file stored.`);
      continue;
    }
    log(`${field}: the File object contains the image bytes, not just the file name.`, {
      name: file.name,
      type: file.type,
      bytes: file.size,
    });
    // Expand this object in the console to inspect the actual file.
    log(`${field}: file`, file);
  }
  log("Edits are stored separately from the original photos:", draft.condition);
  log("Paint strokes:", draft.brushstrokes);
}

export async function draftTransaction(action: "read" | "write" | "delete" | string, draft?: Draft) {
  const prefix = `[Draft ${++transactionCount} · ${action}]`;
  const log: LogFunction = (message, ...data) => console.info(prefix, message, ...data);

  // By explicitly specifying 'IDBDatabase' here, the error message at db.close() disappears.
  let db: IDBDatabase | undefined;

  try {
    log("1. Open IndexedDB. Storage belongs to this website in this browser.", {
      database: DATABASE, store: STORE_NAME, key: DRAFT_KEY,
    });
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        log("First use: create the 'concepten' object store.");
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Storage is blocked."));
    });
    log("2. Database opened.");

    return await new Promise<Draft | undefined>((resolve, reject) => {
      const isRead = action === "read";
      const isDelete = action === "delete";

      if (!["read", "write", "delete"].includes(action)) {
        reject(new Error(`Unknown draft action: ${action}`));
        return;
      }

      // TypeScript is now 100% sure that db exists thanks to the previous Promise
      const transaction = db!.transaction(
          STORE_NAME,
          isRead ? "readonly" : "readwrite",
      );
      const store = transaction.objectStore(STORE_NAME);

      let request: IDBRequest;

      if (isRead) {
        request = store.get(DRAFT_KEY);
      } else if (isDelete) {
        request = store.delete(DRAFT_KEY);
      } else {
        if (!draft) { reject(new Error("No draft to save.")); return; }
        logDraft(log, draft);
        request = store.put(encodeDraft(draft), DRAFT_KEY);
      }

      // Wait until the entire transaction has been successfully completed.
      transaction.oncomplete = () => {
        log(`Draft action '${action}' completed.`);
        resolve(isRead ? decodeDraft(request.result) : undefined);
      };

      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(
          transaction.error || new Error("Draft action aborted."),
      );
    });
  } catch (error) {
    console.error(prefix, "Draft transaction failed:", error);
    throw error;
  } finally {
    if (db) {
      db.close();
      log("6. Database connection closed. Stored data is preserved.");
    }
  }
}
