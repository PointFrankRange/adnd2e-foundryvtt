# Building your own bestiary

This system ships no monster stat blocks — only mechanical tooling. To build
your own creature compendium:

1. Create `creature`-type actors using the new Creature sheet (Sub-project 6).
2. Fill in HD, attacks, saves, and the free-text special-attacks/defenses/
   description fields yourself, from whatever source you're legally entitled
   to use (your own notes, a licensed digital tool's export, etc.).
3. Drag your finished actors into a Compendium pack (right-click the
   Compendium sidebar tab → Create Compendium, choose type "Actor"), or use
   Foundry's own compendium-export tooling on a folder of actors.
4. For bulk import from a JSON file, use the system's generic import API from
   the console or a macro:

   ```js
   const json = await fetch("path/to/your-creatures.json").then(r => r.json());
   await game.system.api.importContent(json, { folderName: "My Bestiary" });
   ```

   See `docs/importing-content.md` for the exact JSON envelope format
   (Sub-project 1c.4b).

This system's manifest reserves a "Bestiary" folder in its own compendium
sidebar for a GM's own creature packs, mirroring the existing
"Equipment"/"Spells" folders — but Foundry does not display a compendium
folder in the sidebar until at least one pack is assigned to it. The
"Bestiary" folder itself won't be visible until you create your own
compendium (step 3 above) and assign it to that folder — when creating a
Compendium, use the "Folder" dropdown in Foundry's own creation dialog to
place it under "Bestiary".

## Shapechange forms (druids)

Druids with a shapechange power (SP16) assume the form of a Monster NPC from your own bestiary; the system ships no animal stat blocks.

1. Create or import the animals as Monster NPCs (see above).
2. On each animal's sheet, use the Shapechange form panel to tag it: category (reptile, bird or mammal), habitats (desert, swamp, mountains and so on), and whether it is a giant form. These are stored in `details.shapechange`.
3. Give players Observer permission on the folder holding the animals so a druid's player can pick a form.
4. The GM judges size: a form should be no smaller than a bullfrog or small bird and no larger than a black bear. The system does not enforce it.
