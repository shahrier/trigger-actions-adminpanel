import { createElement } from "lwc";
import TriggerActionsManager from "c/triggerActionsManager";
// Apex methods imported into a Jest test double as test wire adapters — call
// .emit()/.error() directly (registerApexTestWireAdapter is deprecated).
import getAllTriggerActions from "@salesforce/apex/TriggerActionService.getAllTriggerActions";
import getAvailableSObjects from "@salesforce/apex/TriggerActionService.getAvailableSObjects";
import getGlobalStats from "@salesforce/apex/TriggerActionService.getGlobalStats";
import getNativeAutomations from "@salesforce/apex/TriggerActionService.getNativeAutomations";
import updateTriggerActionOrders from "@salesforce/apex/TriggerActionService.updateTriggerActionOrders";

// Wired Apex methods: mock each as an emit-able test wire adapter.
jest.mock(
  "@salesforce/apex/TriggerActionService.getAllTriggerActions",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TriggerActionService.getAvailableSObjects",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TriggerActionService.getGlobalStats",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TriggerActionService.getNativeAutomations",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/TriggerActionService.updateTriggerActionOrders",
  () => {
    return {
      default: jest.fn().mockResolvedValue("MockJobId")
    };
  },
  { virtual: true }
);

describe("c-trigger-actions-manager", () => {
  const mockActions = [
    {
      Id: "a1",
      DeveloperName: "ActionOne",
      Apex_Class_Name__c: "ClassOne",
      Object_API_Name__c: "Account",
      Order__c: 1,
      Before_Insert__c: "settingId"
    },
    {
      Id: "a2",
      DeveloperName: "ActionTwo",
      Apex_Class_Name__c: "ClassTwo",
      Object_API_Name__c: "Account",
      Order__c: 2,
      Before_Insert__c: "settingId"
    }
  ];

  const mockSObjects = [
    {
      name: "Account",
      label: "Account",
      nativeCount: 0
    }
  ];

  const mockStats = {
    managedObjectCount: 1,
    activeActionCount: 2,
    unmanagedObjectCount: 0
  };

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  async function flushPromises() {
    // Macrotask flush so wire emissions and re-renders settle before asserting.
    // eslint-disable-next-line @lwc/lwc/no-async-operation -- test-only flush
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("loads and displays SObjects list and dashboard initially", async () => {
    const element = createElement("c-trigger-actions-manager", {
      is: TriggerActionsManager
    });
    document.body.appendChild(element);

    // Emit mock wire data
    getAvailableSObjects.emit(mockSObjects);
    getAllTriggerActions.emit(mockActions);
    getGlobalStats.emit(mockStats);

    await flushPromises();

    // Verify SObject Sidebar items
    const sidebarItems = element.shadowRoot.querySelectorAll(".object-item");
    expect(sidebarItems.length).toBe(1);
    expect(sidebarItems[0].textContent).toContain("Account");

    // Dashboard title
    const title = element.shadowRoot.querySelector(".command-title");
    expect(title.textContent).toBe("Trigger Actions Admin Panel");
  });

  it("selects SObject and displays actions list with reordering capabilities", async () => {
    const element = createElement("c-trigger-actions-manager", {
      is: TriggerActionsManager
    });
    document.body.appendChild(element);

    getAvailableSObjects.emit(mockSObjects);
    getAllTriggerActions.emit(mockActions);
    getGlobalStats.emit(mockStats);

    await flushPromises();

    // Select Account object
    const sidebarItem = element.shadowRoot.querySelector(".object-item");
    sidebarItem.click();

    await flushPromises();

    // Action list header
    const listHeader = element.shadowRoot.querySelector(
      ".context-header-label"
    );
    expect(listHeader.textContent).toBe("Before Insert");

    // Check actions rendered
    const actionCards = element.shadowRoot.querySelectorAll(".action-item");
    expect(actionCards.length).toBe(2);
    expect(actionCards[0].textContent).toContain("ActionOne");
    expect(actionCards[1].textContent).toContain("ActionTwo");

    // Verify draft banner is not visible initially
    let banner = element.shadowRoot.querySelector(".draft-banner");
    expect(banner).toBeNull();
  });

  it("shows a loading spinner (not stale data) until native automations resolve", async () => {
    const element = createElement("c-trigger-actions-manager", {
      is: TriggerActionsManager
    });
    document.body.appendChild(element);

    getAvailableSObjects.emit(mockSObjects);
    getAllTriggerActions.emit(mockActions);
    getGlobalStats.emit(mockStats);

    await flushPromises();

    // Select the object — native panel enters loading until the wire resolves.
    element.shadowRoot.querySelector(".object-item").click();
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".audit-panel lightning-spinner")
    ).not.toBeNull();
    // No audit rows rendered while loading (no stale/unfiltered flash).
    expect(element.shadowRoot.querySelector(".audit-item")).toBeNull();

    // Native automations resolve → spinner clears.
    getNativeAutomations.emit({ triggers: [], flows: [] });
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".audit-panel lightning-spinner")
    ).toBeNull();
  });

  // Reorders the first context's two actions by clicking "move down" on row 0.
  function moveFirstActionDown(element) {
    const firstRow = element.shadowRoot.querySelectorAll(".action-item")[0];
    const reorderBtns = firstRow.querySelectorAll(
      ".action-reorder lightning-button-icon"
    );
    // [0] = up, [1] = down
    reorderBtns[1].click();
  }

  it("reorders via the move buttons and shows the draft banner", async () => {
    const element = createElement("c-trigger-actions-manager", {
      is: TriggerActionsManager
    });
    document.body.appendChild(element);

    getAvailableSObjects.emit(mockSObjects);
    getAllTriggerActions.emit(mockActions);
    getGlobalStats.emit(mockStats);

    await flushPromises();

    const sidebarItem = element.shadowRoot.querySelector(".object-item");
    sidebarItem.click();

    await flushPromises();

    // Boundary: first row's "up" is disabled, last row's "down" is disabled.
    const rows = element.shadowRoot.querySelectorAll(".action-item");
    const firstRowBtns = rows[0].querySelectorAll(
      ".action-reorder lightning-button-icon"
    );
    const lastRowBtns = rows[1].querySelectorAll(
      ".action-reorder lightning-button-icon"
    );
    expect(firstRowBtns[0].disabled).toBe(true); // up disabled on first
    expect(lastRowBtns[1].disabled).toBe(true); // down disabled on last

    // Move ActionOne down.
    moveFirstActionDown(element);

    await flushPromises();

    // Draft banner appears.
    expect(element.shadowRoot.querySelector(".draft-banner")).not.toBeNull();

    // Order swapped: ActionTwo now #1, ActionOne now #2.
    const orderBadges = element.shadowRoot.querySelectorAll(".action-order");
    expect(orderBadges[0].textContent).toBe("#1");
    expect(orderBadges[1].textContent).toBe("#2");

    const compactNames = element.shadowRoot.querySelectorAll(
      ".action-name-compact"
    );
    expect(compactNames[0].textContent).toContain("ActionTwo");
    expect(compactNames[1].textContent).toContain("ActionOne");
  });

  it("resets draft changes when Reset is clicked", async () => {
    const element = createElement("c-trigger-actions-manager", {
      is: TriggerActionsManager
    });
    document.body.appendChild(element);

    getAvailableSObjects.emit(mockSObjects);
    getAllTriggerActions.emit(mockActions);
    getGlobalStats.emit(mockStats);

    await flushPromises();

    const sidebarItem = element.shadowRoot.querySelector(".object-item");
    sidebarItem.click();

    await flushPromises();

    moveFirstActionDown(element);

    await flushPromises();
    expect(element.shadowRoot.querySelector(".draft-banner")).not.toBeNull();

    // Click Reset Button using property-based find
    const buttons = element.shadowRoot.querySelectorAll("lightning-button");
    const resetBtn = Array.from(buttons).find((b) => b.label === "Reset");
    expect(resetBtn).toBeDefined();
    resetBtn.click();

    await flushPromises();

    // Verify draft banner is hidden
    expect(element.shadowRoot.querySelector(".draft-banner")).toBeNull();

    // Verify restored original order
    const compactNames = element.shadowRoot.querySelectorAll(
      ".action-name-compact"
    );
    expect(compactNames[0].textContent).toContain("ActionOne");
    expect(compactNames[1].textContent).toContain("ActionTwo");
  });

  it("submits updateTriggerActionOrders when Save is clicked", async () => {
    const element = createElement("c-trigger-actions-manager", {
      is: TriggerActionsManager
    });
    document.body.appendChild(element);

    getAvailableSObjects.emit(mockSObjects);
    getAllTriggerActions.emit(mockActions);
    getGlobalStats.emit(mockStats);

    await flushPromises();

    const sidebarItem = element.shadowRoot.querySelector(".object-item");
    sidebarItem.click();

    await flushPromises();

    moveFirstActionDown(element);

    await flushPromises();

    // Click Save Button using property-based find
    const buttons = element.shadowRoot.querySelectorAll("lightning-button");
    const saveBtn = Array.from(buttons).find((b) => b.label === "Save Order");
    expect(saveBtn).toBeDefined();
    saveBtn.click();

    await flushPromises();

    expect(updateTriggerActionOrders).toHaveBeenCalledWith({
      newOrders: {
        ActionOne: 2,
        ActionTwo: 1
      }
    });

    // Verify banner is hidden after save
    expect(element.shadowRoot.querySelector(".draft-banner")).toBeNull();
  });
});
