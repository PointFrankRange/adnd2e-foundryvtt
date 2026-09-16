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

The empty "Bestiary" folder in this system's own compendium sidebar is where
a GM's own creature packs are expected to live, mirroring the existing
"Equipment"/"Spells" folders — it ships empty and stays that way.
