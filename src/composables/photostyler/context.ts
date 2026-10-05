import type { InjectionKey } from "vue";
import type { usePhotoStyler } from "./usePhotoStyler.ts";
import { inject, provide } from "vue";

const photoStylerKey: InjectionKey<ReturnType<typeof usePhotoStyler>> = Symbol("PhotoStyler");

//Every editor shares its own state with the underlying components.
export function providePhotoStyler(editor: ReturnType<typeof usePhotoStyler>) {
  provide(photoStylerKey, editor);
}

export function usePhotoStylerContext() {
  const editor = inject(photoStylerKey);
  if (!editor) throw new Error("PhotoStyler-component requires an editorcontext.");
  return editor;
}
