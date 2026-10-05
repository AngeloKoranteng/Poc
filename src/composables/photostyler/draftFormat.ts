import type { Draft } from "./types.ts";

interface FieldSchema {
  names: Record<string, string>;
  children?: Record<string, FieldSchema>;
}

// Keep the version-one storage format readable by earlier versions of the editor.
// Only schema keys change; user text, layer IDs, files, and exposure keys stay intact.
const transformSchema: FieldSchema = {
  names: { schaalX: "scaleX", schaalY: "scaleY", hoek: "corner" },
};
const textSchema: FieldSchema = {
  names: {
    ...transformSchema.names,
    inhoud: "content", opmaak: "formatting", vet: "bold", cursief: "italics",
    kleur: "color", grootte: "size", lettertype: "fontFamily",
  },
};
const strokeSchema: FieldSchema = {
  names: { kleur: "color", grootte: "size", punten: "points" },
};
const stateSchema: FieldSchema = {
  names: {
    ...transformSchema.names,
    selectie: "selection", achtergrondDonkerte: "backgroundDarkness",
    achtergrondIngesteld: "backgroundSet", belichtingen: "exposures",
    belichtingAchtergrondUploadId: "lightingBackgroundUploadId",
    rood: "red", groen: "green", blauw: "blue", lagen: "layers",
    achtergrondPositie: "backgroundPosition", aantalVerfstreken: "strokeCount",
    verfstreken: "brushstrokes", tekst: "text",
  },
  children: {
    layers: { names: { zichtbaar: "visible", vergrendeld: "locked" } },
    backgroundPosition: transformSchema,
    text: textSchema,
    brushstrokes: strokeSchema,
  },
};
const draftSchema: FieldSchema = {
  names: {
    versie: "version", toestand: "condition", foto: "image",
    achtergrond: "background", verfstreken: "brushstrokes",
  },
  children: { condition: stateSchema, brushstrokes: strokeSchema },
};

function translateFields(value: unknown, schema: FieldSchema, toEnglish: boolean): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => translateFields(item, schema, toEnglish));
  }
  if (typeof value !== "object") return value;

  const names = toEnglish
    ? schema.names
    : Object.fromEntries(Object.entries(schema.names).map(([oldName, newName]) => [newName, oldName]));

  return Object.fromEntries(Object.entries(value).map(([key, field]) => {
    const translatedKey = names[key] ?? key;
    const child = schema.children?.[toEnglish ? translatedKey : key];
    return [translatedKey, child ? translateFields(field, child, toEnglish) : field];
  }));
}

export function encodeDraft(draft: Draft): unknown {
  return translateFields(draft, draftSchema, false);
}

export function decodeDraft(stored: unknown): Draft | undefined {
  if (stored === undefined) return undefined;
  return translateFields(stored, draftSchema, true) as Draft;
}
