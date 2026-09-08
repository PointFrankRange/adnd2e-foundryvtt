import { SYSTEM_ID } from "../constants";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ExampleApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static override DEFAULT_OPTIONS = {
    id: `${SYSTEM_ID}-example-app`,
    tag: "div",
    window: {
      title: "ADND2E.exampleApp.title",
      icon: "fa-solid fa-dice-d20",
      resizable: true,
    },
    position: {
      width: 400,
      height: "auto" as const,
    },
  };

  static override PARTS = {
    body: {
      template: `systems/${SYSTEM_ID}/templates/example-app.hbs`,
    },
  };

  override async _prepareContext(): Promise<object> {
    return {
      message: game.i18n!.localize("ADND2E.exampleApp.message"),
    };
  }
}
