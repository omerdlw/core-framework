import { after } from "node:test";
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });

for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis) continue;
  Object.defineProperty(globalThis, key, {
    configurable: true,
    get: () => window[key],
  });
}
for (const key of [
  "window",
  "document",
  "navigator",
  "location",
  "localStorage",
  "sessionStorage",
  "self",
  "Event",
  "CustomEvent",
  "EventTarget",
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    get: () => (key === "self" || key === "window" ? window : window[key]),
  });
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

after(async () => {
  await window.happyDOM.abort();
  window.close();
});
