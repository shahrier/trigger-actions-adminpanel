import { createElement } from "lwc";
import TriggerActionSourceView from "c/triggerActionSourceView";
// Apex methods double as test wire adapters in Jest — call .emit() directly.
import getApexClassBody from "@salesforce/apex/TriggerActionService.getApexClassBody";

jest.mock(
  "@salesforce/apex/TriggerActionService.getApexClassBody",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);

describe("c-trigger-action-source-view", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  const flush = () => Promise.resolve();

  it("renders a manually provided class body without waiting on the wire", async () => {
    const element = createElement("c-trigger-action-source-view", {
      is: TriggerActionSourceView
    });
    element.showModal = true;
    element.manualBody = "public class Foo {}";
    document.body.appendChild(element);
    await flush();

    const content = element.shadowRoot.querySelector(".slds-modal__content");
    expect(content.textContent).toContain("public class Foo {}");
  });

  it("renders the class body delivered by the wire", async () => {
    const element = createElement("c-trigger-action-source-view", {
      is: TriggerActionSourceView
    });
    element.showModal = true;
    element.className = "Foo";
    document.body.appendChild(element);

    getApexClassBody.emit("public class Bar {}");
    await flush();

    const content = element.shadowRoot.querySelector(".slds-modal__content");
    expect(content.textContent).toContain("public class Bar {}");
  });

  it("dispatches close when the close button is clicked", async () => {
    const element = createElement("c-trigger-action-source-view", {
      is: TriggerActionSourceView
    });
    element.showModal = true;
    document.body.appendChild(element);
    await flush();

    const handler = jest.fn();
    element.addEventListener("close", handler);
    element.shadowRoot.querySelector(".slds-modal__close").click();

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
