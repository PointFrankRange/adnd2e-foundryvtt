import { MODULE_ID } from "../helpers/constants";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ExampleApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static override DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-example-app`,
    tag: "div",
    window: {
      title: "MY-MODULE.exampleApp.title",
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
      template: `modules/${MODULE_ID}/templates/example-app.hbs`,
    },
  };

  override async _prepareContext(): Promise<object> {
    return {
      message: game.i18n!.localize("MY-MODULE.exampleApp.message"),
    };
  }
}
