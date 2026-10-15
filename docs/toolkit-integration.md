# Reusable Photo Styler editor

## Ownership

This repository owns the standalone Photo Styler development application and its reusable editor. The future Dappre Toolkit repository owns its website shell, header, introduction, navigation, breadcrumbs and routes.

`src/pages/index.astro` is the only application route. It renders a minimal Dutch HTML document with the Photo Styler Vue island. Its body styles apply only to this standalone page.

There is no Toolkit page wrapper, Toolkit branding/navigation, introductory section, breadcrumb or `/photo-styler` route here.

## Embedding boundary

`src/components/photostyler.vue` is the ready-to-mount editor entry point. It creates one `usePhotoStyler()` instance and provides its context to `EditorShell`. A host Vue application can render `<PhotoStyler />` inside its own page/header/intro. An Astro host can render `<PhotoStyler client:load />`.

`EditorShell` is the layout component and requires the existing editor context; it can also be rendered beneath a provider supplied by the host. It does not import or depend on Toolkit components, routing or global Toolkit CSS. Keep the provider mounted for the lifetime of the editor.

The retained layout consists of:
- `EditorShell`: editor header, body, main workspace and footer.
- `editorTopbar`: existing project-name fallback and undo/new/save/download actions.
- `EditorSidebar` and `EditorNavigation`: existing tool navigation and panels.
- Existing upload, image, background, text and drawing panels: retain `v-show`, upload refs and local panel state.
- `EditorToolbar`: existing text, image and drawing actions.
- `EditorCanvas`: canvas workspace, metadata, empty state, Pixi host and overlays.
- `EditorFooter`: existing draft status and local-storage information.

The existing `activePanel` remains the only mode state. The existing `zoom-controls` slot remains outside the Pixi host; no viewport zoom/fullscreen or redo implementation has been added.

## Styling boundary

`src/styles/photostyler.css` is scoped through `EditorShell`. Editor-local `--editor-*` variables provide defaults without styling the host document or depending on Toolkit tokens. The host can later theme the editor through its styles. Existing desktop/mobile layout and control appearance are preserved by this cleanup.

The next Figma phase can style the editor header, tabs/sidebar, toolbar, canvas workspace and footer independently of the Toolkit website shell. Do not add transforms, padding or scaling to the Pixi host without rechecking pointer/overlay alignment.

## Architecture cleanup

Removed:
- `src/components/ToolkitPageHeader.astro`
- `src/components/PhotoStylerIntro.astro`
- `src/components/PhotoStylerPage.astro`
- `src/pages/photo-styler.astro`
- `src/styles/toolkit.css`

Changed:
- `src/pages/index.astro`: restore the standalone page.
- `src/styles/photostyler.css`: local editor tokens and removal of Toolkit token references.
- `docs/toolkit-integration.md`: correct ownership and embedding instructions.

This cleanup does not change Pixi rendering, pointer calculations, transforms, uploads, text/background editing, undo, draft storage or PNG generation. Existing uncommitted component, composable and test changes are preserved.

## Cleanup validation

- `npm run build` passed, including `astro check` and `vue-tsc --noEmit --noUnusedLocals --noUnusedParameters`; zero diagnostics. Only `/` was generated.
- All 38 tests passed.
- Isolated Chrome verified the standalone `/` page, absence of Toolkit UI, actual canvas rendering, upload, text, background color, draft save/reload, pointer drag, undo and PNG download.
- Pointer resize passed at 1400px and 390px. Layout checks at 1400, 1000, 768, 390 and 320px showed no horizontal overflow and matching canvas/host widths. No runtime exceptions were observed.
- SHA-256 comparison against the start of this cleanup confirmed that all source files outside the explicit page/style removal and edits remained byte-for-byte unchanged, including ImagePanel and all editor logic.

The editor-only visual styling is documented in `editor-visual-styling.md`. Website shell integration stays in the Toolkit repository. Browser checks do not replace future Safari/Firefox and physical touch-device verification.
