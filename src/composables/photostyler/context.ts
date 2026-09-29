import type { InjectionKey } from "vue";
import type { usePhotoStyler } from "./usePhotoStyler.ts";
import { inject, provide } from "vue";

const photoStylerKey: InjectionKey<ReturnType<typeof usePhotoStyler>> = Symbol("PhotoStyler");

// Iedere editor deelt zijn eigen toestand met de onderliggende componenten.
export function providePhotoStyler(editor: ReturnType<typeof usePhotoStyler>) {
  provide(photoStylerKey, editor);
}

export function usePhotoStylerContext() {
  const editor = inject(photoStylerKey);
  if (!editor) throw new Error("PhotoStyler-component vereist een editorcontext.");
  return editor;
}
