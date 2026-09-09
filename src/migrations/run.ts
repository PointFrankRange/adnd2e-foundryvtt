// Foundry glue for the migration framework (spec §8). All decision logic is in
// the pure `src/data/migrations.ts`; this file registers the two world settings,
// and on `ready` (GM only) applies every pending migration to the world's actors.
// Not unit-tested (spec §9) — verified in a linked dev world.
import { SYSTEM_ID } from "../constants";
import { MIGRATIONS, pendingMigrations } from "../data/migrations";

type SettingKey = foundry.helpers.ClientSettings.KeyFor<typeof SYSTEM_ID>;

const MIGRATION_VERSION_KEY = "systemMigrationVersion";
const DRY_RUN_KEY = "migrationDryRun";

/** Register the framework's two world settings. Call once, on `init`. */
export function registerMigrationSettings(): void {
  game.settings!.register(SYSTEM_ID, MIGRATION_VERSION_KEY as SettingKey, {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });
  game.settings!.register(SYSTEM_ID, DRY_RUN_KEY as SettingKey, {
    name: "ADND2E.migration.dryRunSetting.name",
    hint: "ADND2E.migration.dryRunSetting.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
}

/**
 * Compare the stored migration version to the running system version and apply
 * every newer migration to the world's actors. GM-only; call on `ready`.
 * On success advances the stored version; on any error leaves it unchanged.
 */
export async function runMigrations(): Promise<void> {
  if (!game.user?.isActiveGM) return;

  const stored =
    (game.settings!.get(SYSTEM_ID, MIGRATION_VERSION_KEY as SettingKey) as string) || "0.0.0";
  const current = game.system!.version;
  const dryRun = game.settings!.get(SYSTEM_ID, DRY_RUN_KEY as SettingKey) as boolean;

  const pending = pendingMigrations(stored, MIGRATIONS);
  if (pending.length === 0) return;

  console.log(
    `${SYSTEM_ID} | migrating world ${stored} → ${current}${dryRun ? " (DRY RUN — no writes)" : ""}`,
  );

  try {
    for (const migration of pending) {
      const updates: Record<string, unknown>[] = [];
      for (const actor of game.actors!) {
        const source = (actor as unknown as { _source: { system: Record<string, unknown> } })._source;
        const payload = migration.actorUpdate(source.system, actor.type);
        if (!payload) continue;
        if (dryRun) {
          console.log(
            `${SYSTEM_ID} | migration ${migration.version} would update "${actor.name}":`,
            payload,
          );
        } else {
          updates.push({ _id: actor.id, ...payload });
        }
      }
      if (!dryRun && updates.length > 0) {
        await CONFIG.Actor.documentClass.updateDocuments(updates);
        console.log(
          `${SYSTEM_ID} | migration ${migration.version}: updated ${updates.length} actor(s)`,
        );
      }
    }

    if (dryRun) {
      ui.notifications!.info(game.i18n!.localize("ADND2E.migration.dryRunComplete"));
    } else {
      await game.settings!.set(SYSTEM_ID, MIGRATION_VERSION_KEY as SettingKey, current);
      ui.notifications!.info(game.i18n!.format("ADND2E.migration.migrated", { version: current }));
    }
  } catch (err) {
    console.error(`${SYSTEM_ID} | migration failed — version left at ${stored}`, err);
    ui.notifications!.error(game.i18n!.localize("ADND2E.migration.failed"));
  }
}
