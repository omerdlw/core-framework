import { Button, defineUi, Select, Switch } from "@omerdlw/base-framework/ui";
import { createElement as h } from "react";

const ui = defineUi({
  parts: {
    button: {
      root: {
        variants: {
          intent: { brand: "bg-brand" },
          elevated: { true: "shadow-xl" },
        },
      },
    },
    switch: { track: { variants: { size: { lg: "h-8 w-14" } } } },
  },
});

declare module "@omerdlw/base-framework/recipes" {
  interface UiRegister {
    ui: typeof ui;
  }
}

h(Button, { intent: "brand", elevated: true });
// @ts-expect-error: the framework ships no intents of its own
h(Button, { intent: "primary" });
h(Switch, { size: "lg" });
ui.parts.button.root({ intent: "brand", elevated: false });

// @ts-expect-error: a value nobody defined
h(Button, { intent: "nope" });
// @ts-expect-error: a size the select never had
h(Select, { options: [], size: "xl" });
