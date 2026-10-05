import type { FederatedPointerEvent, Renderer } from "pixi.js";
import type { EditableObject, ImageSource, EditorState, DragAction, ResizeAction, Point, UploadEvent } from "./types.ts";
import { markRaw, computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Application, Graphics, Sprite, Texture, Rectangle } from "pixi.js";
import { panels, brushPalette } from "./config.ts";
import { useColors } from "./useColors.ts";
import { usePaintLayer } from "./usePaintLayer.ts";
import { useText } from "./useText.ts";
import { draftTransaction } from "./conceptStorage.ts";
import { useLighting } from "./useLighting.ts";

export function usePhotoStyler() {
  // References to the canvas, the paint layer, and the upload field.
  const centerGuides = ref({ vertical: false, horizontal: false });
  const canvasHost = ref<HTMLElement | null>(null);
  const paintCanvas = ref<HTMLCanvasElement | null>(null);
  const fileInput = ref<HTMLInputElement | null>(null);
  const draftBusy = ref(false);
  const draftMessage = ref("");
  const draftStatus = ref("info");

  function markNotSaved(){
    // While saving or loading a draft
    if (draftBusy.value) return;
    draftStatus.value = "gewijzigd";
    draftMessage.value = "Je laatste wijzigingen zijn nog niet bewaard. Klik op Concept opslaan."
  }

  let photoSource: ImageSource | null = null;
  let backgroundSource: ImageSource | null = null;
  let photoFile: File | null = null;
  let backgroundFile: File | null = null;

  // Keep the preview URL valid as long as the corresponding file is used.
  function createUploadPreview() {
    const url = ref("");
    let currentFile: File | null = null;

    function edit(file: File | null) {
      if (file === currentFile) return;
      const nextUrl = file ? URL.createObjectURL(file) : "";
      if (url.value) URL.revokeObjectURL(url.value);
      currentFile = file;
      url.value = nextUrl;
    }

    return { url, update: edit };
  }

  const logoPreview = createUploadPreview();
  const backgroundUploadPreview = createUploadPreview();


  const backgroundFileName = ref("");
  const backgroundDarkness = ref(0);
  const backgroundConfigured = ref(false);
  let backgroundSprite: Sprite | null = null;
  let backgroundUploadId = 0;


  // File name, notifications, and the opened settings panel.
  const fileName = ref("");
  const errorMessage = ref("");
  const canvasReady = ref(false);
  const activePanel = ref("uploads");
  // Locks the settings while an object is being dragged or transformed.
  const inspectorsLocked = ref(false);

  // On/off status, color and thickness of the brush.
  const drawingMode = ref(false);
  const brushColor = ref("#ff0000");
  const brushSize = ref(12);

  // Store previous states and the start of the current edit.
  const history = ref<EditorState[]>([]);
  let restoringState = false;
  let dragStart: DragAction | null = null;
  let colorChangeStart: EditorState | null = null;

  // Pixi editor and the photo displayed on the canvas.
  let app: Application<Renderer<HTMLCanvasElement>>;
  let photoSprite: Sprite | null = null;

  let photoFrame: Graphics;
  // Track which object is edited with the transform handles.
  let selectedType = "afbeelding";
  const layers = ref([
    {
      id: "tekst",
      name: "Tekst",
      present: false,
      visible: true,
      locked: false,
    },
    {
      id: "afbeelding",
      name: "Logo",
      present: false,
      visible: true,
      locked: false,
    },
    {
      id: "achtergrond",
      name: "Achtergrond",
      present: false,
      visible: true,
      locked: false,
    },
  ]);

  const selectedLayer = ref(selectedType);
  // Store lighting separately for each image.
  const lightingValues = ref<Record<string, number>>({
    "afbeelding": 0,
    "achtergrond": 0,
  });

  const lightingProcessor = useLighting();

  const lightingValue = computed(
      () => lightingValues.value[selectedLayer.value] ?? 0,
  );

  const lightingAvailable = computed(() =>
      canvasReady.value &&
      !inspectorsLocked.value &&
      layers.value.some(
          (layer) =>
              layer.id === selectedLayer.value &&
              layer.id !== "tekst" &&
              layer.present &&
              layer.visible &&
              !layer.locked,
      ),
  );

  function changeLighting(value: number | string) {
    if (!lightingAvailable.value) return;

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;

    startColorChange();

    lightingValues.value[selectedLayer.value] =
        Math.max(-2, Math.min(2, numericValue));

    renderCanvas();
  }

  function finishProcessing() {
    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();
    stopCanvasText();
  }


  function resetLighting() {
    changeLighting(0);
    stopColorChange();
  }

  function applyLighting(id: string) {
    lightingProcessor.apply(id, lightingValues.value[id]);
  }

  function getLayerObject(id: string) {
    if (id === "tekst") return getTextObject();
    if (id === "afbeelding") return photoSprite;
    if (id === "achtergrond") return backgroundSprite;
    return null;
  }

  // Make a new upload immediately visible and editable.
  function resetUploadLayer(id: string) {
    const layer = layers.value.find((layer) => layer.id === id);
    if (!layer) return;
    layer.visible = true;
    layer.locked = false;
  }

  function canMoveLayer(id: string) {
    const layer = layers.value.find((layer) => layer.id === id);

    return Boolean(
        layer &&
        layer.visible &&
        !layer.locked
    );
  }

// Updates the list and the visibility on the canvas
  function syncLayers() {
    selectedLayer.value = selectedType;

    for (const layer of layers.value) {
      const object = getLayerObject(layer.id);

      layer.present = Boolean(object);

      if (!object) continue;

      object.visible = layer.visible && !(layer.id === "tekst" && canvasTextActive.value);
      object.eventMode =
          object.visible && !layer.locked ? "static" : "none";
    }
  }

  function selectLayer(id: string) {
    if (!getLayerObject(id)) return;

    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();

    drawingMode.value = false;
    selectedType = id;
    activePanel.value = id === "tekst" ? "tekst" : "afbeelding";

    renderCanvas();
  }

  function removeLayer(id: string) {
    if (!canvasReady.value || !getLayerObject(id)) return;

    selectLayer(id);

    if (id === "tekst") {
      removeText();
    } else {
      deletePhoto();
    }
  }


  function toggleLayerVisibility(id: string) {
    const layer = layers.value.find((layer) => layer.id === id);
    if (!layer || !getLayerObject(id)) return;

    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();

    saveState();
    layer.visible = !layer.visible;

    renderCanvas();
  }

  function toggleLayerLock(id: string) {
    const layer = layers.value.find((layer) => layer.id === id);
    if (!layer || !getLayerObject(id)) return;

    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();

    saveState();
    layer.locked = !layer.locked;

    renderCanvas();
  }

  function getActiveObject() {
    if (canvasTextActive.value || !canMoveLayer(selectedType)) return null;

    if (selectedType === "tekst") return getTextObject();

    // The background supports dragging, but has no scaling or rotation handles.
    if (selectedType === "achtergrond") return null;

    return photoSprite;
  }

  // Reads the transformation of the selected text or picture
  function readObjectState(object: EditableObject) {
    return {
      x: object.x,
      y: object.y,
      scaleX: object.scale.x,
      scaleY: object.scale.y,
      corner: object.angle,
    };
  }

  // Resize handles, rotation handle, and the active transform.
  let resizeHandles: Graphics[] = [];
  let rotationHandle: Graphics;
  let resizeAction: ResizeAction | null = null;

  const handleDirections = [
    // Corner handles scale both dimensions by the same factor.
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },

    // Side grip changes only the width
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ];
  // Prevent an older upload from appearing after a newer one finishes.
  let uploadId = 0;
  let unmounted = false;

  // Drag state and distance between the pointer and the image
  let dragging = false;
  let offset = { x: 0, y: 0 };

  // Opens a panel and stops the active edit
  function selectPanel(panel: string) {
    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();
    if (panel !== "tekenen") drawingMode.value = false;
    activePanel.value = panel;
    // Connect the handles to the selected settings panel.
    if (panel === "tekst" || panel === "afbeelding") {
      selectedType = panel;
    }
    renderCanvas();
  }

  // Switches the paint on or off
  function toggleBrush() {
    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();
    drawingMode.value = !drawingMode.value;
    if (drawingMode.value) activePanel.value = "tekenen";
  }

  // Read the position, scale, colors, and paint stroke count.
  function getCurrentState(): EditorState {
    return {
      sources: { image: photoSource, background: backgroundSource },
      selection: selectedType,
      x: photoSprite?.x ?? null,
      y: photoSprite?.y ?? null,
      // Saves width and height separately for Undo.
      scaleX: photoSprite?.scale.x ?? null,
      scaleY: photoSprite?.scale.y ?? null,
      corner: photoSprite?.angle ?? 0,
      backgroundDarkness: backgroundDarkness.value,
      backgroundSet: backgroundConfigured.value,
      exposures: { ...lightingValues.value },
      lightingBackgroundUploadId: backgroundUploadId,
      red: red.value,
      green: green.value,
      blue: blue.value,

      layers: layers.value.map((layer) => ({
        id: layer.id,
        visible: layer.visible,
        locked: layer.locked,
      })),


      backgroundPosition: backgroundSprite
          ? {
            scaleX: backgroundSprite.scale.x,
            scaleY: backgroundSprite.scale.y,
            x: backgroundSprite.x,
            y: backgroundSprite.y,
            uploadId: backgroundUploadId,
          }
          : null,


      strokeCount: getPaintStrokeCount(),
      text: getCurrentText(),
    };
  }

  // Save a state for undo.
  function saveState(state = getCurrentState()) {
    if (restoringState || !canvasReady.value) return;


    history.value.push(state);
    markNotSaved();
  }

  // Remember the state before a color slider changes.
  function startColorChange() {
    stopResize();
    if (!canvasReady.value || colorChangeStart) return;

    colorChangeStart = getCurrentState();
  }

  // Save a continuous color change as one undo step.
  function stopColorChange() {
    if (!colorChangeStart) return;

    const endState = getCurrentState();
    const changed = JSON.stringify(colorChangeStart) !== JSON.stringify(endState);
    if (changed) {
      saveState(colorChangeStart);
    }
    colorChangeStart = null;
  }

  // Apply a background color while keeping the background image as a hidden, undoable layer.
  function selectBackgroundColor(color: string, continuous = false) {
    if (!canvasReady.value || inspectorsLocked.value) return;

    const hex = String(color).trim().toLowerCase();

    if (!/^#[0-9a-f]{6}$/.test(hex)) return;

    const channels = [1, 3, 5].map((start) =>
        parseInt(hex.slice(start, start + 2), 16)
    );

    const colorChanged = channels.some(
        (value, index) =>
            value !== backgroundChannels[index].value.value
    );

    const visibleBackground = backgroundSprite && layers.value.find(
      (layer) => layer.id === "achtergrond",
    )?.visible;
    if (!colorChanged && backgroundConfigured.value && !visibleBackground) {
      if (!continuous) stopColorChange();
      return;
    }

    if (!continuous) {
      stopColorChange();
    }

    startColorChange();

    backgroundConfigured.value = true;

    // If there is a background picture, hide it
    const backgroundLayer = layers.value.find(
        (layer) => layer.id === "achtergrond"
    );

    if (backgroundSprite && backgroundLayer) {
      backgroundLayer.visible = false;
    }

    // Change RGB.
    red.value = channels[0];
    green.value = channels[1];
    blue.value = channels[2];

    renderCanvas();
    // The watch [red, green, blue] takes care
    // automatically redraws the canvas.

    if (!continuous) {
      stopColorChange();
    }
  }


  // Recovers the last image, colors and paint layer.
  function undo() {
    if (!canvasReady.value || draftBusy.value) return;
    finishProcessing();
    const previous = history.value.pop();
    if (!previous) return;
    uploadId++;
    backgroundUploadId++;
    restoreState(previous);
    markNotSaved();
  }

  // Reuse decoded image sources from history for immediate restoration.
  function restoreSources(sources: NonNullable<EditorState["sources"]>) {
    for (const id of ["achtergrond", "afbeelding"]) {
      const isBackground = id === "achtergrond";
      const source = isBackground ? sources.background : sources.image;
      if (source === (isBackground ? backgroundSource : photoSource)) continue;
      const previousObject = isBackground ? backgroundSprite : photoSprite;
      lightingProcessor.remove(id);
      if (previousObject) {
        app.stage.removeChild(previousObject);
        previousObject.destroy({ texture: true, textureSource: true });
      }
      let sprite: Sprite | null = null;
      if (source) {
        sprite = new Sprite(Texture.from(source.image));
        sprite.anchor.set(0.5);
        sprite.eventMode = "static";
        sprite.cursor = "grab";
        sprite.on("pointerdown", (event) => startDrag(event, sprite));
        lightingProcessor.register(id, sprite, source.image);
        if (isBackground) app.stage.addChildAt(sprite, 0);
        else app.stage.addChild(sprite);
      }
      if (isBackground) {
        backgroundSprite = sprite;
        backgroundSource = source;
        backgroundFile = source?.file ?? null;
        backgroundFileName.value = source?.file.name ?? "";
      } else {
        photoSprite = sprite;
        photoSource = source;
        photoFile = source?.file ?? null;
        fileName.value = source?.file.name ?? "";
      }
    }
    const textObject = getTextObject();
    if (textObject) app.stage.addChild(textObject);
    app.stage.addChild(photoFrame);
  }

  function restoreState(previous: EditorState) {
    restoringState = true;

    try {
      if (previous.sources) restoreSources(previous.sources);
      selectedType = previous.selection ?? selectedType;
      if (previous.brushstrokes) {
        loadPaintStrokes(previous.brushstrokes);
      } else {
        restorePaintLayer(previous.strokeCount);
      }
      restoreText(previous.text ?? null);


      for (const layer of layers.value) {
        const previousLayer = previous.layers?.find(
            (item) => item.id === layer.id
        );

        layer.visible = previousLayer?.visible ?? true;
        layer.locked = previousLayer?.locked ?? false;
      }

      // Restore position, both scale factors, and rotation.
      if (photoSprite && previous.scaleX !== null && previous.scaleY !== null) {
        photoSprite.position.set(previous.x ?? 400, previous.y ?? 250);
        photoSprite.scale.set(previous.scaleX, previous.scaleY);
        photoSprite.angle = previous.corner;
      }

      const backgroundPosition = previous.backgroundPosition;

      // Only saves the position of the same background image
      if (
          backgroundSprite &&
          backgroundPosition &&
          (previous.sources || backgroundPosition.uploadId === backgroundUploadId)
      ) {
        if (backgroundPosition.scaleX != null) backgroundSprite.scale.set(backgroundPosition.scaleX, backgroundPosition.scaleY);
        backgroundSprite.position.set(
            backgroundPosition.x,
            backgroundPosition.y,
        );
      }
      lightingValues.value = {
        "afbeelding": previous.exposures?.["afbeelding"] ?? 0,
        "achtergrond":
            (previous.sources || previous.lightingBackgroundUploadId === backgroundUploadId)
                ? previous.exposures?.["achtergrond"] ?? 0
                : lightingValues.value["achtergrond"],
      };
      backgroundDarkness.value = previous.backgroundDarkness ?? 0;
      backgroundConfigured.value = previous.backgroundSet ?? false;
      red.value = previous.red;
      green.value = previous.green;
      blue.value = previous.blue;

      applyBackground();
      app.renderer.background.color = getBackgroundColor();
      renderCanvas();
    } finally {
      restoringState = false;
    }
  }


async function newDesign(){
    if (!canvasReady.value || draftBusy.value) return;

    const confirmed = window.confirm(
        "Een nieuw ontwerp starten ?\n\n" +
        "Je huidige ontwerp en het opgeslagen concept worden verwijderd." +
        "Dit kun je niet ongedaan maken",
    );

    if (!confirmed) return;

    draftBusy.value = true;
    draftStatus.value = "bezig";
    draftMessage.value = "Je lege canvas wordt voorbereid...";

    try{
      await draftTransaction("delete");

      // Reloads after concept is deleted
      window.location.reload();
    } catch {
      draftStatus.value = "fout";
      draftMessage.value =
          "Een nieuwe ontwerp strten is niet gelukt" +
          "Je canvas is niet leeggemaakt. Probeer opnieuw";

      draftBusy.value = false;
    }
}



  // Saves sourcefiles, changes and paint
  async function saveDraft() {
    if (!canvasReady.value || draftBusy.value) return;
    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();
    stopCanvasText();
    draftBusy.value = true;
    draftStatus.value = "bezig";
    draftMessage.value = "Je ontwerp wordt opgeslagen. Even geduld…";
    try {
      console.info("[Draft · editor] Collect original upload files and current edits.");
      const {sources: sources, ...state} = getCurrentState();
      const draft = {
        version: 1,
        condition: JSON.parse(JSON.stringify(state)),
        image: photoFile,
        background: backgroundFile,
        brushstrokes: readPaintStrokes(),
      };
      await draftTransaction("write", draft);

      const timestamp = new Intl.DateTimeFormat("nl-NL", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());

      draftStatus.value = "opgeslagen";
      draftMessage.value = `Concept opgeslagen om ${timestamp}. Je kunt later in deze browser verder werken.`;
    } catch {
      draftStatus.value = "fout";
      draftMessage.value = "Opslaan mislukt. Controleer de beschikbare browseropslag en probeer opnieuw.";
    } finally {
      draftBusy.value = false;
    }
  }

  async function loadDraft() {
    draftBusy.value = true;
    draftStatus.value = "bezig";
    draftMessage.value = "Je opgeslagen ontwerp wordt geladen. Even geduld…";
    try {
      const draft = await draftTransaction("read");
      if (unmounted) return;
      if (!draft) {
        draftStatus.value = "info";
        draftMessage.value = "";
        return;
      }
      if (draft.version !== 1 || !draft.condition || !Array.isArray(draft.brushstrokes)) {
        throw new Error("Unknown draft format");
      }
      const uploadEvent = (file: File) => ({ target: { files: [file], value: "" } });
      if (draft.background) {
        console.info("[Draft · restore] Reload background file from IndexedDB:", draft.background.name);
        await uploadBackground(uploadEvent(draft.background));
        if (unmounted) return;
        if (!backgroundSprite) throw new Error("Failed to restore background");
      }
      if (draft.image) {
        console.info("[Draft · restore] Reload photo file from IndexedDB:", draft.image.name);
        await uploadPhoto(uploadEvent(draft.image));
        if (unmounted) return;
        if (!photoSprite) throw new Error("Failed to restore photo");
      }
      const state = draft.condition;
      state.lightingBackgroundUploadId = backgroundUploadId;
      if (state.backgroundPosition) state.backgroundPosition.uploadId = backgroundUploadId;
      console.info("[Draft · restore] Apply paint strokes, text, colors, lighting, and positions.");
      loadPaintStrokes(draft.brushstrokes);
      restoreState(state);
      history.value = [];
      console.info("[Draft · restore] Complete: the draft is editable on the canvas again.");
      draftStatus.value = "opgeslagen";
      draftMessage.value = "Opgeslagen concept hersteld. Nieuwe wijzigingen bewaren met Concept opslaan.";
    } catch {
      draftStatus.value = "fout";
      draftMessage.value = "Het concept kon niet worden geladen. Uw opgeslagen concept is niet overschreven.";
    } finally {
      draftBusy.value = false;
    }
  }


  // Create corner and side handles with generous hit areas, plus a rotation handle.
  function makeCornerBlocks() {
    resizeHandles = handleDirections.map((direction) => {
      const handle = new Graphics()
        .rect(-5, -5, 10, 10)
        .fill({ color: 0xffffff })
        .stroke({ width: 2, color: 0x3b82f6 });

      handle.eventMode = "static";
      handle.hitArea = new Rectangle(-12, -12, 24, 24);
      handle.on("pointerdown", (event) => startResize(event, direction));

      photoFrame.addChild(handle);
      return handle;
    });

 // White button with a curved arrow.
    rotationHandle= new Graphics()
        .circle(0, 0, 14)
        .fill({ color: 0xffffff })
        .stroke({ width: 2, color: 0x3b82f6});


    // Curved arrow line.
    rotationHandle
        .arc(0, 0, 7, 0, Math.PI * 1.5)
        .stroke({
          width: 2,
          color: 0x172e2b,
          cap: "round",
        });

    // Arrowhead.
    rotationHandle
        .moveTo(-4, -11,)
        .lineTo(0, -7)
        .lineTo(-4, -3)
        .stroke({
          width: 2,
          color: 0x172e2b,
          cap: "round",
          join: "round",

        });

    rotationHandle.eventMode = "static";
    rotationHandle.cursor = "grab";
    rotationHandle.hitArea = new Rectangle(-22, -22, 44, 44);
    rotationHandle.on("pointerdown", startTurn);

    photoFrame.addChild(rotationHandle);
  }

  // Let the frame and corner blocks follow the selected photo or text.
  // Also installs the side handles and the rotary handle.
  function adjustPhotoFrame() {
    const object = getActiveObject();
    if (!photoFrame) return;

    photoFrame.clear();
    photoFrame.visible = Boolean(object) && !drawingMode.value;

    if (!photoFrame.visible || !object) return;

    photoFrame.position.copyFrom(object.position);
    photoFrame.rotation = object.rotation;

    const width = object.width;
    const height = object.height;

    photoFrame
      .rect(-width / 2, -height / 2, width, height)
      .stroke({ width: 2, color: 0x3b82f6 });

    const cursors = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];

    resizeHandles.forEach((handle, index) => {
      const direction = handleDirections[index];

      handle.position.set(
        (direction.x * width) / 2,
        (direction.y * height) / 2,
      );

      // Align the cursor with the rotated drag direction.
      const angle =
        Math.atan2(direction.y * height, direction.x * width) + object.rotation;

      const cursorIndex = ((Math.round(angle / (Math.PI / 4)) % 4) + 4) % 4;
      handle.cursor = cursors[cursorIndex];
    });

    // Connect the top edge to the rotating handle.
    const rotationHandleY = -height / 2 - 32;

    photoFrame
      .moveTo(0, -height / 2)
      .lineTo(0, rotationHandleY)
      .stroke({ width: 2, color: 0x3b82f6 });

    rotationHandle.position.set(0, rotationHandleY);
  }


  // Updates the frame before redrawing the canvas.
  function renderCanvas() {
    if (!app || !canvasReady.value) return;

    logoPreview.update(photoFile);
    backgroundUploadPreview.update(backgroundFile);

    applyLighting("afbeelding");
    applyLighting("achtergrond");

    syncLayers();
    adjustPhotoFrame();
    app.render();
  }

  function resizePoint(event: PointerEvent | FederatedPointerEvent) {
    const bounds = app.canvas.getBoundingClientRect();
    return {
      x:
        ((event.clientX - bounds.left) / bounds.width) * app.screen.width,
      y:
        ((event.clientY - bounds.top) / bounds.height) *
        app.screen.height,
    };
  }

// Maintains the starting position and the opposite, fixed angle.
// With a side grip, the opposite edge remains in place.
  function startResize(event: FederatedPointerEvent, direction: Point) {
    const object = getActiveObject();
    if (
      !canvasReady.value ||
      !object ||
      drawingMode.value ||
      resizeAction ||
      event.button !== 0
    ) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    stopDrag();
    stopColorChange();

    const width = object.width;
    const height = object.height;

    if (width <= 0 || height <= 0) return;

    activePanel.value = selectedType;

    resizeAction = {
      type: "scales",
      pointerId: event.pointerId,
      object,
      begin: readObjectState(object),
      historyBegin: getCurrentState(),
      direction: direction,
      width: width,
      height: height,
      mouseX: event.global.x,
      mouseY: event.global.y,
      cos: Math.cos(object.rotation),
      sin: Math.sin(object.rotation),
    };

    inspectorsLocked.value = true;
    app.canvas.setPointerCapture(event.pointerId);
  }

  // Starts rotating around the center of the image.
  function startTurn(event: FederatedPointerEvent) {
    const object = getActiveObject();
    if (
      !canvasReady.value ||
      !object ||
      drawingMode.value ||
      resizeAction ||
      event.button !== 0
    ) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();

    stopDrag();
    stopColorChange();
    activePanel.value = selectedType;

    resizeAction = {
      type: "turn",
      pointerId: event.pointerId,
      object,
      begin: readObjectState(object),
      historyBegin: getCurrentState(),
      lastMouseCorner: Math.atan2(
        event.global.y - object.y,
        event.global.x - object.x,
      ),
    };

    rotationHandle.cursor = "grabbing";
    inspectorsLocked.value = true;
    app.canvas.setPointerCapture(event.pointerId);
  }

  // Processes turning, separate stretching, and uniform scaling.
  // Angle handles scale both axes equally and hold the opposite angle.
  function duringResize(event: PointerEvent) {
    if (dragStart) {
      duringDrag(event);
      return;
    }
    const action = resizeAction;
    const object = action?.object;

    if (!action || !object || event.pointerId !== action.pointerId) return;

    event.preventDefault();
    const point = resizePoint(event);

    // Rotates the photo with the change in pointer angle.
    if (action.type === "turn") {
      const dx = point.x - action.begin.x;
      const dy = point.y - action.begin.y;

      // Near the center, the pointer angle is unreliable.
      if (Math.hypot(dx, dy) < 5) return;

      const pointerAngle = Math.atan2(dy, dx);
      const offset = pointerAngle - action.lastMouseCorner;

      // Prevents a jump at the transition between -180 and 180 degrees.
      const angleDelta = Math.atan2(Math.sin(offset), Math.cos(offset));

      object.rotation += angleDelta;
      action.lastMouseCorner = pointerAngle;

      renderCanvas();
      return;
    }

    const deltaX = point.x - action.mouseX;
    const deltaY = point.y - action.mouseY;

    // Converts the motion to the local axes of the image.
    const localX = deltaX * action.cos + deltaY * action.sin;

    const localY = -deltaX * action.sin + deltaY * action.cos;

    const { direction: direction, width: width, height: height } = action;

    // Prevents flipping. An already smaller photo does not suddenly jump larger.
    const minimumX = Math.min(1, 20 / width);
    const minimumY = Math.min(1, 20 / height);

    let factorX = 1;
    let factorY = 1;

    if (direction.x !== 0 && direction.y !== 0) {
      // Corner grip: projects the movement onto the diagonal.
      const diagonalX = direction.x * width;
      const diagonalY = direction.y * height;

      const factor = Math.max(
        minimumX,
        minimumY,
        1 +
          (localX * diagonalX + localY * diagonalY) /
            (diagonalX ** 2 + diagonalY ** 2),
      );

      factorX = factor;
      factorY = factor;
    } else if (direction.x !== 0) {
      // Left or right grip: changes only the width.
      factorX = Math.max(minimumX, 1 + (localX * direction.x) / width);
    } else {
      // Overhand or underhand grip: changes only the height.
      factorY = Math.max(minimumY, 1 + (localY * direction.y) / height);
    }

    object.scale.set(
      action.begin.scaleX * factorX,
      action.begin.scaleY * factorY,
    );

    // Moves the center so that the opposite edge or corner remains fixed.
    const shiftX = (direction.x * width * (factorX - 1)) / 2;

    const shiftY = (direction.y * height * (factorY - 1)) / 2;

    object.position.set(
      action.begin.x + shiftX * action.cos - shiftY * action.sin,
      action.begin.y + shiftX * action.sin + shiftY * action.cos,
    );

    renderCanvas();
  }

// Saves an entire drag as one step for Undo.
// This applies to scaling, stretching, and rotating.
  function stopResize(event?: Event) {
    if (dragStart) {
      stopDrag(event);
      return;
    }
    const action = resizeAction;
    const object = action?.object;

    if (!action) return;

    if (event && "pointerId" in event && event.pointerId !== action.pointerId) {
      return;
    }

    // Also includes the last pointer position.
    if (event?.type === "pointerup") {
      duringResize(event as PointerEvent);
    }

    // Clear first: releasing capture may trigger another event.
    resizeAction = null;
    inspectorsLocked.value = false;

    if (
      object &&
      (object.scale.x !== action.begin.scaleX ||
        object.scale.y !== action.begin.scaleY ||
        object.x !== action.begin.x ||
        object.y !== action.begin.y ||
        object.angle !== action.begin.corner)
    ) {
      saveState(action.historyBegin);
    }

    if (object === getTextObject()) syncText();

    if (rotationHandle) {
      rotationHandle.cursor = "grab";
    }

    if (app.canvas.hasPointerCapture(action.pointerId)) {
      app.canvas.releasePointerCapture(action.pointerId);
    }
  }

// Start Pixi and add the canvas to the page.
  async function makeCanvas() {
    app = new Application<Renderer<HTMLCanvasElement>>();

    await app.init({
      preference: "canvas",
      width: 800,
      height: 500,
      background: getBackgroundColor(),
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    if (unmounted) {
      app.destroy(true, { children: true });
      return;
    }

    canvasHost.value?.appendChild(app.canvas);

    photoFrame = new Graphics();
    photoFrame.eventMode = "passive";
    app.stage.addChild(photoFrame);
    app.canvas.addEventListener("wheel", zoomWithMouse, { passive: false });
    makeCornerBlocks();
    window.addEventListener("pointermove", duringResize, { passive: false });
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    window.addEventListener("blur", stopResize);
    app.canvas.addEventListener("lostpointercapture", stopResize);
    canvasReady.value = true;
  }

  // Loads the background independently of the logo.
  async function uploadBackground(event: Event | UploadEvent) {
    const input = event.target as UploadEvent["target"] | null;
    if (!input) return;
    const file = input.files?.[0];

    if (!file || !canvasReady.value) return;

    const currentUpload = ++backgroundUploadId;
    const objectUrl = URL.createObjectURL(file);

    input.value = "";
    errorMessage.value = "";

    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();

      if (unmounted || currentUpload !== backgroundUploadId) return;

      finishProcessing();
      saveState();
      const newSprite = new Sprite(Texture.from(image));

      // Fills the canvas while maintaining proportions.
      // Anything outside the canvas is cropped during export.
      const scale = Math.max(
          app.screen.width / newSprite.width,
          app.screen.height / newSprite.height,
      );

      newSprite.anchor.set(0.5);
      newSprite.scale.set(scale);
      newSprite.position.set(
          app.screen.width / 2,
          app.screen.height / 2,
      );

      newSprite.eventMode = "static";
      newSprite.cursor = "grab";

      newSprite.on("pointerdown", (event) => {
        startDrag(event, newSprite);
      });


      if (backgroundSprite) {
        lightingProcessor.remove("achtergrond");
        app.stage.removeChild(backgroundSprite);
        backgroundSprite.destroy({
          texture: true,
          textureSource: true,
        });
      }

      backgroundSource = markRaw({ file: file, image: image });
      backgroundFile = file;
      backgroundSprite = newSprite;
      lightingProcessor.register("achtergrond", backgroundSprite, image);
      lightingValues.value["achtergrond"] = 0;
      resetUploadLayer("achtergrond");
      applyBackground();

      // Index 0 places the background below the logo and the text.
      app.stage.addChildAt(backgroundSprite, 0);
      backgroundFileName.value = file.name;

      renderCanvas();
    } catch {
      if (!unmounted && currentUpload === backgroundUploadId) {
        errorMessage.value =
            "Deze achtergrond kan niet worden geopend. Probeer een andere afbeelding.";
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

// Let text fields handle their own undo; sliders use the editor history.
  function historyTouch(event: KeyboardEvent) {
    if (!canvasReady.value || draftBusy.value || event.defaultPrevented ||
        event.isComposing || event.altKey || event.shiftKey ||
        !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;

    const target = event.target as HTMLElement | null;
    const inputElement = target?.closest?.("input");
    const textInput = inputElement && !["range", "color", "checkbox", "radio", "button", "submit", "file"].includes(inputElement.type);
    if (canvasTextActive.value || target?.isContentEditable || textInput ||
        target?.closest?.('textarea, [role="textbox"]')) return;

    event.preventDefault();
    undo();
  }


// Loads the logo and places it appropriately in the center.
  async function uploadPhoto(event: Event | UploadEvent) {
    const input = event.target as UploadEvent["target"] | null;
    if (!input) return;
    const file = input.files?.[0];

    if (!file || !canvasReady.value) return;

    const currentUpload = ++uploadId;
    const objectUrl = URL.createObjectURL(file);
    errorMessage.value = "";
    input.value = "";

    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();

      if (unmounted || currentUpload !== uploadId) return;

      const texture = Texture.from(image);

      stopResize();

      stopDrag();
      stopDrawing();
      stopColorChange();
      stopCanvasText();
      saveState();
      selectedType = "afbeelding";

      if (photoSprite) {
        lightingProcessor.remove("afbeelding");
        app.stage.removeChild(photoSprite);
        photoSprite.destroy({ texture: true, textureSource: true });
      }
      photoSource = markRaw({ file: file, image: image });
      photoFile = file;
      fileName.value = file.name;

      photoSprite = new Sprite(texture);
      lightingProcessor.register("afbeelding", photoSprite, image);
      lightingValues.value["afbeelding"] = 0;
      resetUploadLayer("afbeelding");
      photoSprite.anchor.set(0.5);
      photoSprite.position.set(app.screen.width / 2, app.screen.height / 2);

      const scale = Math.min(
        (app.screen.width * 0.8) / photoSprite.width,
        (app.screen.height * 0.8) / photoSprite.height,
      );

      photoSprite.scale.set(scale);
      photoSprite.eventMode = "static";
      photoSprite.cursor = "grab";

      photoSprite.on("pointerdown", startDrag);

      app.stage.addChild(photoSprite);
      const textObject = getTextObject();
    if (textObject) app.stage.addChild(textObject);
      app.stage.addChild(photoFrame);
      selectPanel("uploads");
      dragStart = null;
      renderCanvas();
    } catch {
      if (!unmounted && currentUpload === uploadId) {
        errorMessage.value =
          "Deze foto kan niet worden geopend. Probeer een JPG-, PNG-, WebP- of SVG-bestand.";
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // Deletes the image as recoverable modification
  function deletePhoto() {
    if (!canvasReady.value) return;

    // This action only removes images.
    if (selectedType === "tekst") return;

    const isBackground = selectedType === "achtergrond";
    const object = isBackground ? backgroundSprite : photoSprite;

    if (!object) return;

    stopResize();
    stopDrag();
    stopDrawing();
    stopColorChange();

    saveState();
    if (isBackground) {
      backgroundSource = null;
      backgroundUploadId++;
      backgroundFile = null;
      backgroundSprite = null;
      backgroundFileName.value = "";
    } else {
      photoSource = null;
      uploadId++;
      photoFile = null;
      photoSprite = null;
      fileName.value = "";
    }

    lightingProcessor.remove(isBackground ? "achtergrond" : "afbeelding");
    lightingValues.value[isBackground ? "achtergrond" : "afbeelding"] = 0;
    app.stage.removeChild(object);
    object.destroy({
      texture: true,
      textureSource: true,
    });

    // The source remains available for restoration via the history.
    dragStart = null;
    colorChangeStart = null;
    drawingMode.value = false;

    selectedType = photoSprite ? "afbeelding" : "achtergrond";
    activePanel.value = "uploads";
    errorMessage.value = "";

    renderCanvas();
  }

// Start moving the image or text.
  function startDrag(event: FederatedPointerEvent, object: EditableObject | null = photoSprite) {

    const layerId =
        object === backgroundSprite
            ? "achtergrond"
            : object === getTextObject()
                ? "tekst"
                : "afbeelding";

    if (!canMoveLayer(layerId)) return;

    if (
      !canvasReady.value ||
      !object ||
      drawingMode.value ||
      resizeAction ||
      dragStart ||
      event.button !== 0
    )
      return;
    event.stopPropagation();
    event.preventDefault();
    stopColorChange();
    if (object === backgroundSprite) {
      selectedType = "achtergrond";
    } else if (object === getTextObject()) {
      selectedType = "tekst";
    } else {
      selectedType = "afbeelding";
    }

    activePanel.value =
        selectedType === "tekst" ? "tekst" : "afbeelding";

    dragStart = {
      object,
      pointerId: event.pointerId,
      x: object.x,
      y: object.y,
      history: getCurrentState(),
    };
    dragging = true;
    object.cursor = "grabbing";
    offset = {
      x: event.global.x - object.x,
      y: event.global.y - object.y,
    };
    inspectorsLocked.value = true;
    app.canvas.setPointerCapture(event.pointerId);
    renderCanvas();
  }

  function duringDrag(event: PointerEvent) {
    const action = dragStart;

    if (!dragging || !action || event.pointerId !== action.pointerId) {
      return;
    }

    event.preventDefault();

    const point = resizePoint(event);
    const object = action.object;

    let x = point.x - offset.x;
    let y = point.y - offset.y;

    if (object === backgroundSprite) {
      const halfWidth = object.width / 2;
      const halfHeight = object.height / 2;

      // The background has a center point as an anchor.
      // Set the position so that every canvas edge remains covered.
      x = Math.max(
          app.screen.width - halfWidth,
          Math.min(halfWidth, x),
      );

      y = Math.max(
          app.screen.height - halfHeight,
          Math.min(halfHeight, y),
      );
    }

    // Keeps the snapping tolerance at six screen pixels even on a smaller canvas.
    const rect = app.canvas.getBoundingClientRect();
    const vertical = Math.abs(x - app.screen.width / 2) <= 6 * app.screen.width / rect.width;
    const horizontal = Math.abs(y - app.screen.height / 2) <= 6 * app.screen.height / rect.height;
    if (vertical) x = app.screen.width / 2;
    if (horizontal) y = app.screen.height / 2;
    centerGuides.value = { vertical, horizontal };
    object.position.set(x, y);
    renderCanvas();
  }

  // Stops dragging and saves the previous position.
  function stopDrag(event?: Event) {
    const action = dragStart;
    if (!action) return;
    if (event && "pointerId" in event && event.pointerId !== action.pointerId)
      return;
    if (event?.type === "pointerup") duringDrag(event as PointerEvent);

    // Clear first: releasePointerCapture may trigger another stop event.
    dragStart = null;
    dragging = false;
    centerGuides.value = { vertical: false, horizontal: false };
    inspectorsLocked.value = false;
    const object = action.object;
    if (object.x !== action.x || object.y !== action.y) {
      saveState(action.history);
    }
    object.cursor = "grab";
    if (object === getTextObject()) syncText();
    if (app.canvas.hasPointerCapture(action.pointerId)) {
      app.canvas.releasePointerCapture(action.pointerId);
    }
  }

  // Places the entire logo, including rotation, within a 32 px margin.
  function placeLogo(position: string) {
    if (!canMoveLayer("afbeelding")) return;

    const positions: Record<string, [number, number]> = {
      midden: [0.5, 0.5],
      linksboven: [0, 0],
      rechtsboven: [1, 0],
      linksonder: [0, 1],
      rechtsonder: [1, 1],
    };
    if (!photoSprite || !canvasReady.value || !positions[position]) return;
    selectPanel("afbeelding");
    const previous = getCurrentState();
    const margin = 32;
    const cos = Math.abs(Math.cos(photoSprite.rotation));
    const sin = Math.abs(Math.sin(photoSprite.rotation));
    let width = photoSprite.width * cos + photoSprite.height * sin;
    let height = photoSprite.width * sin + photoSprite.height * cos;
    const factor = Math.min(1,
      (app.screen.width - 2 * margin) / width,
      (app.screen.height - 2 * margin) / height);
    photoSprite.scale.set(photoSprite.scale.x * factor, photoSprite.scale.y * factor);
    width *= factor;
    height *= factor;
    const [x, y] = positions[position];
    photoSprite.position.set(
      margin + width / 2 + x * (app.screen.width - 2 * margin - width),
      margin + height / 2 + y * (app.screen.height - 2 * margin - height),
    );
    if (JSON.stringify(previous) !== JSON.stringify(getCurrentState())) {
      saveState(previous);
    }
    renderCanvas();
  }

  // A gray tint darkens only the background photo.
  function applyBackground() {
    if (!backgroundSprite) return;
    const channel = Math.round(255 * (1 - backgroundDarkness.value / 100));
    backgroundSprite.tint = (channel << 16) | (channel << 8) | channel;
  }

  watch(backgroundDarkness, () => {
    applyBackground();
    renderCanvas();
  }, { flush: "sync" });

  // Rotates the image by the specified number of degrees.
  function rotatePhoto(degrees: number) {
    const object = getActiveObject();
    stopResize();
    if (!object || !canvasReady.value) return;

    stopDrag();
    saveState();

    object.angle += degrees;
    renderCanvas();
  }

  // Scales the image up or down.
  function changeScale(factor: number) {
    const object = getActiveObject();
    stopResize();
    if (!object) return;

    stopDrag();
    saveState();

    object.scale.set(object.scale.x * factor, object.scale.y * factor);
    renderCanvas();
  }

  // Adjusts the image size with the mouse wheel.
  function zoomWithMouse(event: WheelEvent) {
    const object = getActiveObject();
    if (!object || drawingMode.value) return;

    event.preventDefault();
    if (resizeAction) return;
    changeScale(event.deltaY < 0 ? 1.1 : 0.9);
  }

  // Combines the background, image, and paint into a PNG download.
  function downloadPhoto() {
    stopDrag();
    stopResize();
    stopCanvasText();
    if (!canvasReady.value || (!backgroundConfigured.value && !photoSprite && !backgroundSprite && !getTextObject())) return;

    stopDrawing();
    const frameWasVisible = photoFrame.visible;

    try {
      photoFrame.visible = false;

      const dimensions = { width: 1350, height: 852 };
      const source = app.renderer.extract.canvas({
        target: app.stage,
        frame: app.screen.clone(),
        resolution: dimensions.width / app.screen.width,
        clearColor: getBackgroundColor(),
      });
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No 2D context available for export.");
      context.drawImage(source as HTMLCanvasElement, 0, 0, canvas.width, canvas.height);
      if (paintCanvas.value) context.drawImage(paintCanvas.value, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a");

      // The sender supplies the company or logo name; the recipient does not need to enter anything.
      const parameters = new URLSearchParams(window.location.search);
      const name = (parameters.get("naam") ?? "")
        .normalize("NFC")
        .replace(/\.png$/i, "")
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .trim()
        .slice(0, 128)
        .trim();
      const uuid = (parameters.get("uuid") ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
      const downloadName = name || uuid;
      link.download = `${downloadName || "mijn-bewerkte-foto-1350x852"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      photoFrame.visible = frameWasVisible;
      renderCanvas();
    }
  }

  const {
    red,
    green,
    blue,

    achtergrondKanalen: backgroundChannels,

    backgroundExample: backgroundPreview,
    getBackgroundColor,
  } = useColors();

  const {
    startDrawing,
    continueDrawing,
    stopDrawing,
    restorePaintLayer,
    getPaintStrokeCount,
    readPaintStrokes,
    loadPaintStrokes,
  } = usePaintLayer({
    verfCanvas: paintCanvas,
    tekenModus: drawingMode,
    canvasKlaar: canvasReady,
    kwastKleur: brushColor,
    kwastGrootte: brushSize,
    hasPhoto: () => Boolean(photoSprite),
    stopDrag,
    stopColorChange,
    saveState,
  });

  // Connects the text controls to the canvas and history.
  const {
    canvasTekstActief: canvasTextActive,
    canvasTekstInvoer: canvasTextInput,
    canvasTekstOpmaak: canvasTextStyle,
    startCanvasText,
    stopCanvasText,
    tekstFormulier: textForm,
    applyText,
    removeText,
    restoreText,
    getCurrentText,
    getTextObject,
    syncText,
  } = useText({
    getApp: () => app,
    getPhotoFrame: () => photoFrame,
    canEdit: () =>
        canvasReady.value &&
        !inspectorsLocked.value,
    beforeEdit: () => selectPanel("tekst"),
    startDrag,
    afterApply: () => {
      selectedType = "tekst";
    },
    saveState,
    renderCanvas,
  });

  // Hides the frame while drawing and shows it again afterward.
  watch(drawingMode, () => {
    stopResize();
    renderCanvas();
  });

  // Applies a changed background color directly to the canvas.
  watch(
    [red, green, blue],
    () => {
      if (!canvasReady.value || restoringState) return;

      backgroundConfigured.value = true;
      app.renderer.background.color = getBackgroundColor();
      renderCanvas();
    },
    { flush: "sync" },
  );

  // Vue may rebuild the canvas component while the editor remains active.
  // Attach the existing Pixi canvas to the new host and restore the paint layer.
  watch([canvasHost, paintCanvas], ([host, paint], [previousHost, previousPaint]) => {
    if (unmounted || !canvasReady.value || !host || !paint) return;
    if (host !== previousHost) host.appendChild(app.canvas);
    if (paint !== previousPaint) restorePaintLayer(getPaintStrokeCount());
    renderCanvas();
  }, { flush: "post" });

  // Starts the editor when the page is ready.
  onMounted(async () => {
    try {
      await makeCanvas();
      if (!unmounted) window.addEventListener('keydown', historyTouch);
      if (!unmounted) await loadDraft();
    } catch (error) {
      console.error("Failed to start photo editor:", error);
      errorMessage.value = "De foto-editor kon niet starten. Ververs de pagina.";
    }
  });

  // Cleans up the canvas, image, and mouse wheel event listener.
  onBeforeUnmount(() => {
    stopResize();
    unmounted = true;
    backgroundUploadId++;
    window.removeEventListener("pointermove", duringResize);
    window.removeEventListener("pointerup", stopResize);
    window.removeEventListener('keydown', historyTouch);
    window.removeEventListener("pointercancel", stopResize);
    window.removeEventListener("blur", stopResize);
    uploadId++;
    stopDrawing();

    lightingProcessor.dispose();
    logoPreview.update(null);
    backgroundUploadPreview.update(null);
    if (canvasReady.value) {
      app.canvas.removeEventListener("wheel", zoomWithMouse);
      app.canvas.removeEventListener("lostpointercapture", stopResize);
      app.destroy(true, { children: true, texture: true, textureSource: true });
    }

  });

  return {
    draftBusy,
    logoPreviewUrl: logoPreview.url,
    backgroundUploadPreviewUrl: backgroundUploadPreview.url,
    draftMessage,
    draftStatus,
    canvasTextActive,
    canvasTextInput,
    canvasTextStyle,
    startCanvasText,
    stopCanvasText,
    layers,
    selectedLayer,
    selectLayer,
    removeLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    placeLogo,
    backgroundDarkness,
    backgroundConfigured,
    backgroundFileName,
    uploadBackground,
    fileName,
    history,
    undo,
    downloadPhoto,
    panels,
    activePanel,
    selectPanel,
    canvasReady,
    fileInput,
    uploadPhoto,
    changeScale,
    rotatePhoto,
    startColorChange,
    stopColorChange,
    deletePhoto,
    drawingMode,
    toggleBrush,
    brushColor,
    brushPalette,
    brushSize,
    lightingValue,
    lightingAvailable,
    changeLighting,
    resetLighting,
    backgroundPreview,
    backgroundChannels,
    selectBackgroundColor,
    errorMessage,
    centerGuides,
    canvasHost,
    newDesign,
    saveDraft,
    paintCanvas,
    startDrawing,
    continueDrawing,
    stopDrawing,
    textForm,
    applyText,
    removeText,
    inspectorsLocked,
  };
}
