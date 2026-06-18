import { createElement } from "lwc";
import TriggerSettingForm from "c/triggerSettingForm";
import { registerApexTestWireAdapter } from "@salesforce/sfdx-lwc-jest";
import getAllOrgSObjects from "@salesforce/apex/TriggerActionService.getAllOrgSObjects";
import createTriggerSetting from "@salesforce/apex/TriggerActionService.createTriggerSetting";

const sobjectsWire = registerApexTestWireAdapter(getAllOrgSObjects);

jest.mock(
  "@salesforce/apex/TriggerActionService.createTriggerSetting",
  () => ({ default: jest.fn().mockResolvedValue("MockJobId") }),
  { virtual: true }
);

describe("c-trigger-setting-form", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  const flush = () => Promise.resolve();
  const findButton = (el, label) =>
    Array.from(el.shadowRoot.querySelectorAll("lightning-button")).find(
      (b) => b.label === label
    );

  function setObjectName(element, value) {
    // objectName is the only combobox; LWC sets `name` as a property (not a DOM
    // attribute), so select by element type rather than [name=...].
    const combo = element.shadowRoot.querySelector("lightning-combobox");
    combo.value = value;
    // handleSave gates on checkValidity(); the base stub doesn't return true.
    combo.checkValidity = () => true;
    combo.reportValidity = () => true;
    combo.dispatchEvent(new CustomEvent("change"));
  }

  it("auto-extracts the namespace from a namespaced object on save", async () => {
    const element = createElement("c-trigger-setting-form", {
      is: TriggerSettingForm
    });
    document.body.appendChild(element);
    sobjectsWire.emit([{ label: "MyObj", value: "ns__MyObj__c" }]);
    await flush();

    setObjectName(element, "ns__MyObj__c");
    await flush();

    findButton(element, "Save").click();
    await flush();

    expect(createTriggerSetting).toHaveBeenCalledTimes(1);
    const args = createTriggerSetting.mock.calls[0][0];
    expect(args.objectName).toBe("ns__MyObj__c");
    expect(args.objectNamespace).toBe("ns");
  });

  it("leaves the namespace empty for a standard object", async () => {
    const element = createElement("c-trigger-setting-form", {
      is: TriggerSettingForm
    });
    document.body.appendChild(element);
    sobjectsWire.emit([{ label: "Account", value: "Account" }]);
    await flush();

    setObjectName(element, "Account");
    await flush();

    findButton(element, "Save").click();
    await flush();

    expect(createTriggerSetting.mock.calls[0][0].objectNamespace).toBe("");
  });

  it("dispatches close on cancel", async () => {
    const element = createElement("c-trigger-setting-form", {
      is: TriggerSettingForm
    });
    document.body.appendChild(element);
    await flush();

    const handler = jest.fn();
    element.addEventListener("close", handler);
    findButton(element, "Cancel").click();

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
