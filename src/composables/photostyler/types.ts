import type { Sprite, Text } from "pixi.js";

// Objects in the editor that can be selected and edited.
export type EditableObject = Sprite | Text;

// Basic 2D coordinate.
export interface Point {
  x: number;
  y: number;
}

// Stores the original uploaded file together with the loaded HTML image.
export interface ImageSource {
  file: File;
  image: HTMLImageElement;
}

// Basic text content and formatting options.
export interface TextContent {
  content: string;

  // Optional formatting data for individual parts of the text.
  formatting?: number[];

  // Whether the text is bold.
  bold?: boolean;

  // Whether the text is italic.
  italics?: boolean;
}

// Complete state of a text object inside the editor.
export interface TextState extends TextContent {
  // Text color.
  color: string;

  // Font size.
  size: number;

  // Optional font family.
  fontFamily?: string;

  // Position of the text on the canvas.
  x: number;
  y: number;

  // Optional horizontal and vertical scale.
  scaleX?: number;
  scaleY?: number;

  // Optional rotation angle.
  corner?: number;
}

// Form version of TextState.
// Allows size, x and y to temporarily contain strings,
// because HTML form inputs usually return string values.
export type TextForm = Omit<TextState, "size" | "x" | "y"> & {
  size: number | string;
  x: number | string;
  y: number | string;
};

// A single paint/brush stroke made by the user.
export interface PaintStroke {
  // Color of the stroke.
  color: string;

  // Brush size.
  size: number;

  // All coordinates that form the stroke.
  points: Point[];
}

// Position and transformation state of an editable object.
export interface ObjectState extends Point {
  // Horizontal scale.
  scaleX: number;

  // Vertical scale.
  scaleY: number;

  // Rotation angle.
  corner: number;
}

// Represents the complete current state of the editor.
export interface EditorState {
  // Optional uploaded image and background sources.
  sources?: {
    image: ImageSource | null;
    background: ImageSource | null;
  };

  // ID/name of the currently selected editor object.
  selection: string;

  // Current position of the selected object.
  x: number | null;
  y: number | null;

  // Current scale of the selected object.
  scaleX: number | null;
  scaleY: number | null;

  // Current rotation angle.
  corner: number;

  // Darkness applied to the background.
  backgroundDarkness: number;

  // Indicates whether a background has been set.
  backgroundSet: boolean;

  // Stores exposure values for different editor objects/settings.
  exposures: Record<string, number>;

  // ID used to track changes to the uploaded lighting background.
  lightingBackgroundUploadId: number;

  // RGB color channel values.
  red: number;
  green: number;
  blue: number;

  // List of editor layers with visibility and lock state.
  layers: {
    id: string;
    visible: boolean;
    locked: boolean;
  }[];

  // Position and scale of the current background.
  // uploadId helps identify which uploaded background this state belongs to.
  backgroundPosition:
      | (Point & {
    scaleX: number;
    scaleY: number;
    uploadId: number;
  })
      | null;

  // Number of paint strokes currently in the editor.
  strokeCount: number;

  // Optional list containing all paint/brush strokes.
  brushstrokes?: PaintStroke[];

  // Current text object, if one exists.
  text: TextState | null;
}

// Data structure used when saving/loading an editor draft.
export interface Draft {
  // Draft format/version.
  version: number;

  // Editor settings/state at the moment the draft was saved.
  condition: EditorState;

  // Original uploaded image.
  image: File | null;

  // Original uploaded background.
  background: File | null;

  // All paint strokes stored separately from the original image.
  brushstrokes: PaintStroke[];
}

// Information stored while an object is being dragged.
export interface DragAction extends Point {
  // Object being dragged.
  object: EditableObject;

  // Pointer ID used to track the mouse/touch interaction.
  pointerId: number;

  // Editor state before the drag started.
  // Can be used for undo/history.
  history: EditorState;
}

// Shared information used during resize and rotation actions.
interface TransformAction {
  // Object being transformed.
  object: EditableObject;

  // Pointer ID for the current mouse/touch interaction.
  pointerId: number;

  // Object transformation state when the action started.
  begin: ObjectState;

  // Editor state before the transformation started.
  historyBegin: EditorState;
}

// Describes either a rotation or resize action.
export type ResizeAction = TransformAction &
    (
        // Rotation action.
        | {
      type: "turn";

      // Previous mouse angle/corner used to calculate rotation.
      lastMouseCorner: number;
    }

        // Scaling/resizing action.
        | {
      type: "scales";

      // Direction in which the object is being resized.
      direction: Point;

      // Original object dimensions.
      width: number;
      height: number;

      // Mouse position when resizing started.
      mouseX: number;
      mouseY: number;

      // Cached cosine and sine values for rotated resizing calculations.
      cos: number;
      sin: number;
    }
        );

// Simplified type for a file input change event.
// Used when uploading images/backgrounds.
export type UploadEvent = {
  target: {
    files: ArrayLike<File> | null;

    // Current value of the HTML file input.
    value: string;
  };
};