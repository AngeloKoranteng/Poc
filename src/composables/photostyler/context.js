import { inject, provide } from "vue";

const photoStylerKey = Symbol("PhotoStyler");

// Iedere editor deelt zijn eigen toestand met de onderliggende componenten.
export function providePhotoStyler(editor) {
  provide(photoStylerKey, editor);
}

export function usePhotoStylerContext() {
  const editor = inject(photoStylerKey);
  if (!editor) throw new Error("PhotoStyler-component vereist een editorcontext.");
  return editor;
}
