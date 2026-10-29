import { defineCustomElement } from "vue";
import PhotoStylerElementComponent from "./PhotoStylerElement.ce.vue";

const tagName = "photo-styler";
const PhotoStylerElement = defineCustomElement(PhotoStylerElementComponent);

if (typeof customElements !== "undefined" && !customElements.get(tagName)) {
  customElements.define(tagName, PhotoStylerElement);
}
export { PhotoStylerElement };