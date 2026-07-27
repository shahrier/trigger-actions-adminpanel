import { createElement } from "lwc";
import TriggerActionsManager from "c/triggerActionsManager";
// Apex methods imported into a Jest test double as test wire adapters — call
// .emit()/.error() directly (registerApexTestWireAdapter is deprecated).
import getAllTriggerActions from "@salesforce/apex/TriggerActionService.getAllTriggerActions";
import getAvailableSObjects from "@salesforce/apex/TriggerActionService.getAvailableSObjects";
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

// Deep-audit collaborators.
jest.mock(
  "@salesforce/apex/TriggerActionService.getApexClassBodies",
  () => ({ default: jest.fn().mockResolvedValue({}) }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/OrgSessionController.getSessionId",
  () => ({ default: jest.fn().mockResolvedValue("SESSION") }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/OrgSessionController.getOrgDomainUrl",
  () => ({
    default: jest.fn().mockResolvedValue("https://example.my.salesforce.com")
  }),
  { virtual: true }
);
jest.mock(
  "c/flowLensConverter",
  () => ({
    convertFlowToMermaid: jest.fn(
      (metadata, label) =>
        `flowchart TD\n  %% ${label}\n  n1["${metadata.marker}"]`
    )
  }),
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

  describe("AI object audit", () => {
    const auditActions = [
      ...mockActions,
      {
        Id: "a3",
        DeveloperName: "BypassedAction",
        Apex_Class_Name__c: "ClassThree",
        Object_API_Name__c: "Account",
        Order__c: 1,
        Bypass_Execution__c: true,
        Entry_Criteria__c: "{!Record.Industry} = 'Retail'",
        After_Update__c: "settingId"
      },
      {
        // Different object — must never appear in an Account audit.
        Id: "a4",
        DeveloperName: "ContactAction",
        Apex_Class_Name__c: "ContactClass",
        Object_API_Name__c: "Contact",
        Order__c: 1,
        Before_Insert__c: "settingId"
      }
    ];

    const auditNative = {
      triggers: [
        {
          Id: "t1",
          Name: "AccountTrigger",
          Status: "Active",
          Body: "trigger AccountTrigger on Account {}",
          UsageBeforeInsert: true,
          UsageAfterUpdate: true
        }
      ],
      flows: [
        {
          DurableId: "3000000000000a1AAA",
          Label: "Set Account Rating",
          ApiName: "Set_Account_Rating",
          ProcessType: "AutoLaunchedFlow",
          TriggerType: "RecordBeforeSave",
          RecordTriggerType: "CreateAndUpdate",
          IsActive: true
        },
        {
          DurableId: "3000000000000b2AAA",
          Label: "Archive Account",
          ApiName: "Archive_Account",
          ProcessType: "AutoLaunchedFlow",
          TriggerType: "RecordBeforeDelete",
          RecordTriggerType: "Delete",
          IsActive: true
        },
        {
          DurableId: "3000000000000c3AAA",
          Label: "Stale Account Sync",
          ApiName: "Stale_Account_Sync",
          ProcessType: "AutoLaunchedFlow",
          TriggerType: "RecordAfterSave",
          RecordTriggerType: "Update",
          IsActive: false
        },
        {
          DurableId: "3000000000000d4AAA",
          Label: "Legacy Account PB",
          ApiName: "Legacy_Account_PB",
          ProcessType: "Workflow",
          TriggerType: "RecordAfterSave",
          RecordTriggerType: "CreateAndUpdate",
          IsActive: false
        }
      ]
    };

    function getAssistant(element) {
      return element.shadowRoot.querySelector("c-agentforce-assistant");
    }

    it("opens the assistant with an inventory payload for the selected object", async () => {
      const element = createElement("c-trigger-actions-manager", {
        is: TriggerActionsManager
      });
      document.body.appendChild(element);

      getAvailableSObjects.emit(mockSObjects);
      getAllTriggerActions.emit(auditActions);
      await flushPromises();

      element.shadowRoot.querySelector(".object-item").click();
      await flushPromises();

      getNativeAutomations.emit(auditNative);
      await flushPromises();

      const auditBtn = Array.from(
        element.shadowRoot.querySelectorAll("lightning-button")
      ).find((b) => b.label === "AI Audit");
      expect(auditBtn).toBeDefined();
      auditBtn.click();
      await flushPromises();

      const assistant = getAssistant(element);
      expect(assistant.isOpen).toBe(true);
      // Apex source was readable here, so the definition-aware prompt applies
      // even though the flow definitions were not fetched in this test.
      expect(assistant.artifactType).toBe("OBJECT_DEEP");
      expect(assistant.artifactName).toBe("Account");

      const payload = assistant.artifactPayload;

      // Header counts.
      expect(payload).toContain("SObject API Name: Account");
      expect(payload).toContain("Trigger Action Framework actions: 3");
      expect(payload).toContain("Other Apex triggers: 1");
      expect(payload).toContain("Record-triggered flows: 3");
      expect(payload).toContain("Process Builders: 1");

      // TAF actions are grouped by context, ordered, and fully described.
      expect(payload).toContain("[Before Insert]");
      expect(payload).toContain("- ActionOne | Apex=ClassOne | Order=1");
      expect(payload).toContain(
        "- BypassedAction | Apex=ClassThree | Order=1 | Bypassed=Yes | Entry={!Record.Industry} = 'Retail'"
      );
      // Actions belonging to another object are excluded.
      expect(payload).not.toContain("ContactAction");

      // Native automation inventory.
      expect(payload).toContain(
        "- AccountTrigger | Status=Active | Contexts=Before Insert, After Update"
      );
      expect(payload).toContain('- "Set Account Rating"');
      // Process Builders are separated from record-triggered flows.
      expect(payload).toMatch(/PROCESS BUILDERS[^\n]*\n- "Legacy Account PB"/);

      // Findings-oriented format, not a phase-by-phase walkthrough.
      expect(payload).toContain("=== PRECOMPUTED SIGNALS ===");
      expect(payload).not.toContain("PHASE 1");
    });

    it("computes contention, bypass and legacy signals", async () => {
      const element = createElement("c-trigger-actions-manager", {
        is: TriggerActionsManager
      });
      document.body.appendChild(element);

      getAvailableSObjects.emit(mockSObjects);
      getAllTriggerActions.emit(auditActions);
      await flushPromises();

      element.shadowRoot.querySelector(".object-item").click();
      await flushPromises();
      getNativeAutomations.emit(auditNative);
      await flushPromises();

      Array.from(element.shadowRoot.querySelectorAll("lightning-button"))
        .find((b) => b.label === "AI Audit")
        .click();
      await flushPromises();

      const payload = getAssistant(element).artifactPayload;

      // Before Insert has 2 TAF actions and an Apex trigger.
      expect(payload).toContain(
        "Before Insert is driven by multiple mechanisms this org controls: 2 TAF action(s) and 1 custom Apex trigger(s) outside TAF"
      );
      expect(payload).toContain(
        "1 TAF action(s) are bypassed and never execute: BypassedAction"
      );
      expect(payload).toContain("1 Process Builder(s) remain on this object");
      expect(payload).toContain("Inactive record-triggered flow(s)");
    });

    it("separates managed-package artifacts from the org's own code", async () => {
      const withManaged = {
        triggers: [
          ...auditNative.triggers,
          {
            Id: "t2",
            Name: "wocst",
            Status: "Active",
            NamespacePrefix: "rstk",
            UsageBeforeInsert: true
          },
          {
            Id: "t3",
            Name: "wocst",
            Status: "Inactive",
            NamespacePrefix: "rootstock",
            UsageBeforeInsert: true
          }
        ],
        flows: [
          ...auditNative.flows,
          {
            DurableId: "3000000000000e5AAA",
            Label: "Packaged Sync",
            ApiName: "rstk__Packaged_Sync",
            ProcessType: "AutoLaunchedFlow",
            TriggerType: "RecordAfterSave",
            RecordTriggerType: "Update",
            NamespacePrefix: "rstk",
            IsActive: true
          }
        ]
      };

      const element = createElement("c-trigger-actions-manager", {
        is: TriggerActionsManager
      });
      document.body.appendChild(element);

      getAvailableSObjects.emit(mockSObjects);
      getAllTriggerActions.emit(auditActions);
      await flushPromises();

      element.shadowRoot.querySelector(".object-item").click();
      await flushPromises();
      getNativeAutomations.emit(withManaged);
      await flushPromises();

      Array.from(element.shadowRoot.querySelectorAll("lightning-button"))
        .find((b) => b.label === "AI Audit")
        .click();
      await flushPromises();

      const payload = getAssistant(element).artifactPayload;

      // Counts distinguish own code from packaged code.
      expect(payload).toContain("Apex triggers: 3 (1 own, 2 managed)");
      expect(payload).toContain("Record-triggered flows: 4 (3 own, 1 managed)");

      // Managed artifacts are inventoried in their own read-only section.
      expect(payload).toContain("MANAGED PACKAGE AUTOMATION — READ-ONLY");
      expect(payload).toContain("- wocst | Status=Active");
      expect(payload).toContain("Package=rstk");
      expect(payload).toContain("Package=rootstock");

      // Contention names the managed triggers but marks them unconsolidatable.
      expect(payload).toContain(
        "read-only managed trigger(s) also run here (wocst [rstk], wocst [rootstock]) and cannot be consolidated"
      );
      expect(payload).toContain("come from managed packages and are read-only");

      // An inactive managed trigger is NOT reported as removable clutter.
      expect(payload).not.toContain(
        "Inactive Apex trigger(s) still deployed: wocst"
      );
    });

    // A TAF dispatcher trigger is how the framework runs; it must never be
    // reported as an automation competing with the actions it dispatches.
    async function auditWithTriggers(triggers) {
      const element = createElement("c-trigger-actions-manager", {
        is: TriggerActionsManager
      });
      document.body.appendChild(element);

      getAvailableSObjects.emit(mockSObjects);
      getAllTriggerActions.emit(auditActions);
      await flushPromises();

      element.shadowRoot.querySelector(".object-item").click();
      await flushPromises();
      getNativeAutomations.emit({ triggers, flows: [] });
      await flushPromises();

      Array.from(element.shadowRoot.querySelectorAll("lightning-button"))
        .find((b) => b.label === "AI Audit")
        .click();
      await flushPromises();

      return getAssistant(element).artifactPayload;
    }

    const dispatcher = {
      Id: "d1",
      Name: "TA_Account",
      Status: "Active",
      Body: "trigger TA_Account on Account (before insert, before update) {\n  new MetadataTriggerHandler().run();\n}",
      UsageBeforeInsert: true,
      UsageBeforeUpdate: true
    };

    it("treats the TAF dispatcher as the framework, not competing automation", async () => {
      const payload = await auditWithTriggers([dispatcher]);

      // Called out as the framework's entry point, in its own section.
      expect(payload).toContain(
        "TAF dispatcher trigger present: Yes (TA_Account)"
      );
      expect(payload).toContain("TAF DISPATCHER TRIGGER");
      expect(payload).toContain("it is not a competing automation");
      // It is not counted among the migration candidates.
      expect(payload).toContain("Other Apex triggers: 0");

      // Crucially: no contention reported between the dispatcher and the
      // Before Insert TAF actions that it exists to run.
      expect(payload).not.toContain(
        "Before Insert is driven by multiple mechanisms"
      );
    });

    it("still reports contention from custom triggers outside the framework", async () => {
      const payload = await auditWithTriggers([
        dispatcher,
        {
          Id: "c1",
          Name: "AccountLegacy",
          Status: "Active",
          Body: "trigger AccountLegacy on Account (before insert) { doWork(); }",
          UsageBeforeInsert: true
        }
      ]);

      expect(payload).toContain("Other Apex triggers: 1");
      expect(payload).toContain(
        "Before Insert is driven by multiple mechanisms this org controls: 2 TAF action(s) and 1 custom Apex trigger(s) outside TAF"
      );
    });

    it("flags TAF actions that no dispatcher can execute", async () => {
      const payload = await auditWithTriggers([]);

      expect(payload).toContain("TAF dispatcher trigger present: No");
      expect(payload).toContain(
        "3 TAF action(s) are configured but no TAF dispatcher trigger"
      );
      expect(payload).toContain("none of these actions can execute");
    });

    it("flags an inactive dispatcher as a wiring failure, not clutter", async () => {
      const payload = await auditWithTriggers([
        { ...dispatcher, Status: "Inactive" }
      ]);

      expect(payload).toContain(
        "are INACTIVE, so none of the 3 configured TAF action(s) on this object currently execute"
      );
      // Not double-reported as removable dead code.
      expect(payload).not.toContain(
        "Inactive Apex trigger(s) still deployed: TA_Account"
      );
    });

    describe("deep audit", () => {
      let getApexClassBodies;

      beforeEach(() => {
        getApexClassBodies =
          require("@salesforce/apex/TriggerActionService.getApexClassBodies").default;
        getApexClassBodies.mockResolvedValue({
          ClassOne: "public class ClassOne { /* body */ }"
        });

        global.fetch = jest.fn((url) => {
          // One Tooling API callout per flow; echo back an identifiable body.
          const id = decodeURIComponent(url).match(/DefinitionId = '(\w+)'/)[1];
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                records: [{ Id: "301", Metadata: { marker: `meta-${id}` } }]
              })
          });
        });
      });

      afterEach(() => {
        delete global.fetch;
      });

      async function runDeepAudit(native) {
        const element = createElement("c-trigger-actions-manager", {
          is: TriggerActionsManager
        });
        document.body.appendChild(element);

        getAvailableSObjects.emit(mockSObjects);
        getAllTriggerActions.emit(auditActions);
        await flushPromises();

        element.shadowRoot.querySelector(".object-item").click();
        await flushPromises();
        getNativeAutomations.emit(native);
        await flushPromises();

        Array.from(element.shadowRoot.querySelectorAll("lightning-button"))
          .find((b) => b.label === "AI Audit")
          .click();
        await flushPromises();
        await flushPromises();

        return getAssistant(element);
      }

      it("appends flow diagrams and Apex source to the audit payload", async () => {
        const assistant = await runDeepAudit(auditNative);

        // Deep audits use their own prompt.
        expect(assistant.artifactType).toBe("OBJECT_DEEP");

        const payload = assistant.artifactPayload;
        // Still carries the signature-level inventory and signals.
        expect(payload).toContain("=== AUTOMATION INVENTORY ===");
        expect(payload).toContain("=== PRECOMPUTED SIGNALS ===");

        // Plus the definitions.
        expect(payload).toContain("=== FLOW DEFINITIONS");
        expect(payload).toContain('--- FLOW: "Set Account Rating"');
        expect(payload).toContain("meta-3000000000000a1AAA");
        expect(payload).toContain("=== APEX SOURCE ===");
        expect(payload).toContain("--- APEX TRIGGER: AccountTrigger ---");
        expect(payload).toContain("trigger AccountTrigger on Account {}");
        expect(payload).toContain("--- TAF ACTION CLASS: ClassOne ---");

        // One callout per flow — the Tooling API cannot batch Metadata.
        expect(global.fetch).toHaveBeenCalledTimes(auditNative.flows.length);
        // Apex classes are fetched in a single bulk call.
        expect(getApexClassBodies).toHaveBeenCalledTimes(1);
      });

      // Modelled on the real "Opportunity - Set Campaign" / "Created or Update"
      // pair, which the model wrongly reported as a CampaignId collision.
      it("counts only real writes, not reads through a lookup", async () => {
        const metaByFlow = {
          // Two CampaignId writes, but on exclusive branches of one decision.
          "3000000000000a1AAA": {
            assignments: [
              {
                name: "Set_Opportunity_VALID_Campaign",
                assignmentItems: [
                  { assignToReference: "$Record.CampaignId", value: {} }
                ]
              },
              {
                name: "Set_Opportunity_Campaign_INVALID",
                assignmentItems: [
                  { assignToReference: "$Record.CampaignId", value: {} }
                ]
              }
            ]
          },
          // ACTIVE, and a genuine second writer of CampaignId -> real
          // contention. Also merely READS through the Campaign lookup.
          "3000000000000b2AAA": {
            assignments: [
              {
                name: "Force_Campaign",
                assignmentItems: [
                  { assignToReference: "$Record.CampaignId", value: {} }
                ]
              }
            ],
            recordUpdates: [
              {
                name: "Inbound_Outbound",
                inputReference: "$Record",
                inputAssignments: [
                  {
                    field: "Inbound_vs_Outbound__c",
                    value: {
                      elementReference:
                        "$Record.Campaign.Inbound_vs_Outbound__c"
                    }
                  }
                ]
              }
            ]
          },
          // INACTIVE: writes CampaignId too, but can never execute, so it must
          // not inflate the contention count.
          "3000000000000c3AAA": {
            assignments: [
              {
                name: "Never_Runs",
                assignmentItems: [
                  { assignToReference: "$Record.CampaignId", value: {} }
                ]
              }
            ]
          },
          "3000000000000d4AAA": {}
        };

        global.fetch = jest.fn((url) => {
          const id = decodeURIComponent(url).match(/DefinitionId = '(\w+)'/)[1];
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                records: [{ Id: "301", Metadata: metaByFlow[id] || {} }]
              })
          });
        });

        const assistant = await runDeepAudit(auditNative);
        const payload = assistant.artifactPayload;

        // The model is told the conclusion and told not to re-report it.
        expect(payload).toContain(
          "1 field(s) on this object are written by more than one ACTIVE flow"
        );
        expect(payload).toContain("do not produce any finding");
        // The finding blocks themselves never enter the prompt.
        expect(payload).not.toContain("Field contention on `CampaignId`");

        // They are handed to the drawer as verified, non-generated findings.
        const verified = assistant.verifiedFindings;
        expect(verified).toContain(
          "#### [HIGH] Field contention on `CampaignId`"
        );
        // Exactly the two ACTIVE writers — the inactive third is excluded.
        expect(verified).toContain("written by 2 separate flows");
        expect(verified).toContain('"Set Account Rating"');
        expect(verified).toContain('"Archive Account" (Force_Campaign)');
        expect(verified).not.toContain("Never_Runs");
        expect(verified).not.toContain("Stale Account Sync");

        // The lookup read must never be counted as a CampaignId writer.
        expect(verified).not.toContain("Inbound_Outbound");
        expect(verified).not.toContain("Inbound_vs_Outbound__c");
        // ...and the field it genuinely writes is written by only one flow,
        // so it is not listed as contested at all.
        expect(payload).not.toContain("Inbound_vs_Outbound__c");
      });

      it("does not report a field written by only one flow", async () => {
        global.fetch = jest.fn((url) => {
          const id = decodeURIComponent(url).match(/DefinitionId = '(\w+)'/)[1];
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                records: [
                  {
                    Id: "301",
                    Metadata:
                      id === "3000000000000a1AAA"
                        ? {
                            assignments: [
                              {
                                name: "Only_Writer",
                                assignmentItems: [
                                  {
                                    assignToReference: "$Record.Rating",
                                    value: {}
                                  }
                                ]
                              }
                            ]
                          }
                        : {}
                  }
                ]
              })
          });
        });

        const assistant = await runDeepAudit(auditNative);
        expect(assistant.artifactPayload).toContain(
          "No field on this object is written by more than one active flow."
        );
        // Nothing to show the user, so no verified-findings block.
        expect(assistant.verifiedFindings).toBe("");
      });

      it("reports unreadable flows instead of dropping them silently", async () => {
        global.fetch = jest.fn(() =>
          Promise.resolve({ ok: false, status: 403 })
        );

        const payload = (await runDeepAudit(auditNative)).artifactPayload;

        expect(payload).toContain("FLOWS WHOSE DEFINITION COULD NOT BE READ");
        expect(payload).toContain("Tooling API returned 403");
        expect(payload).toContain("do not guess at their contents");
      });

      // Deep reading is the only audit now, so losing the session must degrade
      // it to a signature-level audit rather than failing outright.
      it("falls back to a signature-level audit when the session is unavailable", async () => {
        const getSessionId =
          require("@salesforce/apex/OrgSessionController.getSessionId").default;
        getSessionId.mockRejectedValue({
          body: { message: "Session unavailable" }
        });
        // No Apex readable either, so nothing at all can be read.
        getApexClassBodies.mockResolvedValue({});

        const assistant = await runDeepAudit({
          triggers: [],
          flows: auditNative.flows
        });

        // The audit still opens.
        expect(assistant.isOpen).toBe(true);
        // ...but does not claim the model can see definitions.
        expect(assistant.artifactType).toBe("OBJECT");

        const payload = assistant.artifactPayload;
        expect(payload).toContain("=== AUTOMATION INVENTORY ===");
        expect(payload).toContain(
          "Flow definitions could not be read in this session (Session unavailable)"
        );
        expect(payload).toContain("Do not speculate about flow contents.");
        // No flows were read, so no contention could be computed.
        expect(assistant.verifiedFindings).toBe("");
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it("flags managed Apex whose source the platform hides", async () => {
        const payload = (
          await runDeepAudit({
            triggers: [
              {
                Id: "m1",
                Name: "wocst",
                Status: "Active",
                NamespacePrefix: "rstk",
                Body: "(hidden)",
                UsageBeforeUpdate: true
              }
            ],
            flows: []
          })
        ).artifactPayload;

        expect(payload).not.toContain("(hidden)\n");
        expect(payload).toContain(
          '1 Apex trigger(s) belong to managed packages; the platform returns their source as "(hidden)"'
        );
        expect(payload).toContain("never speculate about it");
      });
    });

    it("fetches automations on demand when auditing an unselected object", async () => {
      getNativeAutomations.mockResolvedValue({ triggers: [], flows: [] });

      const element = createElement("c-trigger-actions-manager", {
        is: TriggerActionsManager
      });
      document.body.appendChild(element);

      getAvailableSObjects.emit(mockSObjects);
      getAllTriggerActions.emit(auditActions);
      await flushPromises();

      // No object selected yet — the row button must fetch for that row.
      const rowBtn = element.shadowRoot.querySelector(".object-audit-btn");
      expect(rowBtn).not.toBeNull();
      rowBtn.click();
      await flushPromises();

      expect(getNativeAutomations).toHaveBeenCalledWith({
        objectName: "Account"
      });

      const assistant = getAssistant(element);
      expect(assistant.isOpen).toBe(true);
      expect(assistant.artifactName).toBe("Account");
      expect(assistant.artifactPayload).toContain("Apex triggers: 0");
      // TAF actions still come from the cached action list.
      expect(assistant.artifactPayload).toContain(
        "- ActionOne | Apex=ClassOne"
      );
    });
  });
});
