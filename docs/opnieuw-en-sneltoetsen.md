# Ongedaan maken en sneltoetsen

De knop **Ongedaan maken** blijft beschikbaar. **Ctrl+Z** en **Cmd+Z** roepen dezelfde functie aan. Dit werkt ook wanneer een kleur- of belichtingsslider nog de focus heeft.

Tijdens tekstinvoer blijven de normale tekstbewerkingssneltoetsen werken. Opnieuw en de bijbehorende geschiedenis en sneltoetsen zijn verwijderd.

De bediening staat in `src/components/photostyler/EditorBovenbalk.vue`. De gedeelde undo-functie en toetsenbordafhandeling staan in `src/composables/photostyler/usePhotoStyler.js`.

Uploads, vervangingen en verwijderingen van logo en achtergrond zijn ook herstelbaar. De geschiedenis geldt voor de huidige sessie: een hersteld concept start met een lege geschiedenis.
