import type { Sprite, Text } from "pixi.js";

export type EditableObject = Sprite | Text;
export interface Point { x: number; y: number }
export interface ImageSource { bestand: File; afbeelding: HTMLImageElement }
export interface TextContent {
  inhoud: string;
  opmaak?: number[];
  vet?: boolean;
  cursief?: boolean;
}
export interface TextState extends TextContent {
  kleur: string;
  grootte: number;
  lettertype?: string;
  x: number;
  y: number;
  schaalX?: number;
  schaalY?: number;
  hoek?: number;
}
export type TextForm = Omit<TextState, "grootte" | "x" | "y"> & {
  grootte: number | string;
  x: number | string;
  y: number | string;
};
export interface PaintStroke { kleur: string; grootte: number; punten: Point[] }
export interface ObjectState extends Point { schaalX: number; schaalY: number; hoek: number }
export interface EditorState {
  bronnen?: { foto: ImageSource | null; achtergrond: ImageSource | null };
  selectie: string;
  x: number | null;
  y: number | null;
  schaalX: number | null;
  schaalY: number | null;
  hoek: number;
  achtergrondDonkerte: number;
  achtergrondIngesteld: boolean;
  belichtingen: Record<string, number>;
  belichtingAchtergrondUploadId: number;
  rood: number;
  groen: number;
  blauw: number;
  lagen: { id: string; zichtbaar: boolean; vergrendeld: boolean }[];
  achtergrondPositie: (Point & { schaalX: number; schaalY: number; uploadId: number }) | null;
  aantalVerfstreken: number;
  verfstreken?: PaintStroke[];
  tekst: TextState | null;
}
export interface Draft {
  versie: number;
  toestand: EditorState;
  foto: File | null;
  achtergrond: File | null;
  verfstreken: PaintStroke[];
}
export interface DragAction extends Point {
  object: EditableObject;
  pointerId: number;
  geschiedenis: EditorState;
}
interface TransformAction {
  object: EditableObject;
  pointerId: number;
  begin: ObjectState;
  geschiedenisBegin: EditorState;
}
export type ResizeAction = TransformAction & (
  { type: "draaien"; laatsteMuisHoek: number } |
  { type: "schalen"; richting: Point; breedte: number; hoogte: number;
    muisX: number; muisY: number; cos: number; sin: number }
);
export type UploadEvent = { target: { files: ArrayLike<File> | null; value: string } };
