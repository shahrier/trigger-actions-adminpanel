import { createElement } from "lwc";
import TriggerActionForm from "c/triggerActionForm";
import createTriggerAction from "@salesforce/apex/TriggerActionService.createTriggerAction";
import updateTriggerAction from "@salesforce/apex/TriggerActionService.updateTriggerAction";

jest.mock(
  "@salesforce/apex/TriggerActionService.getAvailableApexClasses",
  () => ({
    default: jest
      .fn()
      .mockResolvedValue([{ label: "MyClass", value: "MyClass" }])
  }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TriggerActionService.getImplementedContexts",
  () => ({ default: jest.fn().mockResolvedValue("{}") }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TriggerActionService.createTriggerAction",
  () => ({ default: jest.fn().mockResolvedValue("MockJobId") }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TriggerActionService.updateTriggerAction",
  () => ({ default: jest.fn().mockResolvedValue("MockJobId") }),
  { virtual: true }
);

describe("c-trigger-action-form", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  // connectedCallback awaits getAvailableApexClasses; a few microtask ticks
  // settle it (and the async save path) before assertions.
  async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  function findButton(element, label) {
    return Array.from(
      element.shadowRoot.querySelectorAll("lightning-button")
    ).find((b) => b.label === label);
  }

  const validAction = {
    Object_API_Name__c: "Account",
    DeveloperName: "MyAction",
    Apex_Class_Name__c: "MyClass",
    Description__c: "desc",
    Order__c: 2,
    After_Update__c: "settingId"
  };

  it("saves an edited action with prepopulated data and the active context", async () => {
    const element = createElement("c-trigger-action-form", {
      is: TriggerActionForm
    });
    element.isCreating = false;
    element.action = validAction;
    document.body.appendChild(element);
    await flushPromises();

    findButton(element, "Save").click();
    await flushPromises();

    expect(updateTriggerAction).toHaveBeenCalledTimes(1);
    const args = updateTriggerAction.mock.calls[0][0];
    expect(args.devName).toBe("MyAction");
    expect(args.apexClassName).toBe("MyClass");
    expect(args.description).toBe("desc");
    expect(args.order).toBe(2);
    // Exactly one context is flagged true — the one set on the record.
    expect(args.contexts.After_Update__c).toBe(true);
    expect(args.contexts.Before_Insert__c).toBe(false);
    // Create path is not used when editing.
    expect(createTriggerAction).not.toHaveBeenCalled();
  });

  it("dispatches savesuccess after a successful save", async () => {
    const element = createElement("c-trigger-action-form", {
      is: TriggerActionForm
    });
    element.isCreating = false;
    element.action = validAction;
    document.body.appendChild(element);
    await flushPromises();

    const handler = jest.fn();
    element.addEventListener("savesuccess", handler);

    findButton(element, "Save").click();
    await flushPromises();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("blocks save and calls no Apex when required fields are missing (create mode)", async () => {
    const element = createElement("c-trigger-action-form", {
      is: TriggerActionForm
    });
    element.isCreating = true; // empty formData
    document.body.appendChild(element);
    await flushPromises();

    findButton(element, "Save").click();
    await flushPromises();

    expect(createTriggerAction).not.toHaveBeenCalled();
    expect(updateTriggerAction).not.toHaveBeenCalled();
  });

  it("dispatches close on cancel", async () => {
    const element = createElement("c-trigger-action-form", {
      is: TriggerActionForm
    });
    element.isCreating = true;
    document.body.appendChild(element);
    await flushPromises();

    const handler = jest.fn();
    element.addEventListener("close", handler);

    findButton(element, "Cancel").click();

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
