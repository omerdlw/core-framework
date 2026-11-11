import { createElement as h } from "react";
import { Button, Select, Switch, defineUi } from "@omerdlw/base-framework/ui";

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

declare module "@omerdlw/base-framework/ui/recipes" {
  interface UiRegister {
    ui: typeof ui;
  }
}

h(Button, { intent: "brand", elevated: true });
h(Button, { intent: "primary", size: "lg" });
h(Switch, { size: "lg" });
ui.parts.button.root({ intent: "brand", elevated: false });

// @ts-expect-error: a value nobody defined
h(Button, { intent: "nope" });
// @ts-expect-error: a size the select never had
h(Select, { options: [], size: "xl" });
