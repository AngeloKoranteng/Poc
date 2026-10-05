import type { TextStyleOptions } from "pixi.js";
import type { TextContent } from "./types.ts";

// Each character has a formatting value:
// 0 = normal, 1 = bold, 2 = italic, 3 = both.
export function readFormatting(text: TextContent) {
    const defaultFormatting = (text.bold ? 1 : 0) | (text.italics ? 2 : 0);

    return Array.from(
        { length: text.content.length },
        (_, index) => text.formatting?.[index] ?? defaultFormatting,
    );
}

// Preserve formatting on existing characters when the content changes.
export function updateContent<T extends TextContent>(text: T, content: string) {
    const previous = text.content;
    const formatting = readFormatting(text);
    let start = 0;
    let oldEnd = previous.length;
    let newEnd = content.length;

    while (
        start < oldEnd &&
        start < newEnd &&
        previous[start] === content[start]
    ) {
        start++;
    }

    while (
        oldEnd > start &&
        newEnd > start &&
        previous[oldEnd - 1] === content[newEnd - 1]
    ) {
        oldEnd--;
        newEnd--;
    }

    const insertedFormatting = formatting[start] ?? formatting[start - 1] ?? 0;

    return {
        ...text,
        content: content,
        formatting: [
            ...formatting.slice(0, start),
            ...Array(newEnd - start).fill(insertedFormatting),
            ...formatting.slice(oldEnd),
        ],
    };
}

// Convert characters to text with PixiJS formatting tags.
export function createCanvasText(content: TextContent) {
    const formatting = readFormatting(content);

    // Prevent user-entered tags from being interpreted as formatting.
    let prefix = "characterStyle";
    while (content.content.includes(prefix)) prefix += "_";

    const tagStyles: Record<string, Partial<TextStyleOptions>> = {};
    for (let value = 0; value < 4; value++) {
        tagStyles[`${prefix}${value}`] = {
            fontWeight: value & 1 ? "bold" : "normal",
            fontStyle: value & 2 ? "italic" : "normal",
        };
    }

    let text = "";
    let start = 0;

    while (start < content.content.length) {
        const value = formatting[start];
        let end = start + 1;

        while (end < content.content.length && formatting[end] === value) {
            end++;
        }

        const tag = `${prefix}${value}`;
        text += `<${tag}>${content.content.slice(start, end)}</${tag}>`;
        start = end;
    }

    return { text, tagStyles };
}
