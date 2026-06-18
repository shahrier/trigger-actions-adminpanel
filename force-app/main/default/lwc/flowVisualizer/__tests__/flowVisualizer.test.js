import { createElement } from "lwc";
import FlowVisualizer, { buildFlowDetails } from "c/flowVisualizer";
import getFlowIdByName from "@salesforce/apex/TriggerActionService.getFlowIdByName";
import getApexClassBody from "@salesforce/apex/TriggerActionService.getApexClassBody";

jest.mock(
  "../relationshipResolver",
  () => {
    return {
      resolveFlowRecordReferences: jest
        .fn()
        .mockImplementation((metadata) => Promise.resolve(metadata))
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/OrgSessionController.getSessionId",
  () => {
    return {
      default: jest.fn().mockResolvedValue("MockSessionId")
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/OrgSessionController.getOrgDomainUrl",
  () => {
    return {
      default: jest.fn().mockResolvedValue("https://example.com")
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/TriggerActionService.getFlowIdByName",
  () => {
    return {
      default: jest.fn().mockResolvedValue("300tgSubflowId123")
    };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/TriggerActionService.getApexClassBody",
  () => {
    return {
      default: jest.fn().mockResolvedValue("public class MyApexClass {}")
    };
  },
  { virtual: true }
);

describe("c-flow-visualizer", () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          records: [
            {
              Id: "300tgL000000EhI1QA",
              Metadata: {
                label: "My Test Flow",
                actionCalls: [
                  {
                    name: "ApexActionNode",
                    actionType: "apex",
                    actionName: "MyApexClass",
                    inputParameters: [
                      {
                        name: "functionName",
                        value: {
                          stringValue: "executeAction"
                        }
                      }
                    ]
                  }
                ],
                subflows: [
                  {
                    name: "SubflowNode",
                    flowName: "MySubflow"
                  }
                ]
              }
            }
          ]
        })
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  async function flushPromises() {
    // Run multiple microtask loop ticks to ensure all sequential async awaits
    // conclude. The ticks are intentionally sequential, not concurrent.
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line no-await-in-loop -- sequential microtask flush
      await Promise.resolve();
    }
  }

  it("loads flow metadata and renders main diagram", async () => {
    const element = createElement("c-flow-visualizer", {
      is: FlowVisualizer
    });
    element.flowId = "300tgL000000EhI1QA";
    element.flowName = "Test Flow";
    document.body.appendChild(element);

    await flushPromises();

    // Verify main diagram viewer is rendered
    const viewer = element.shadowRoot.querySelector("c-diagram-viewer");
    expect(viewer).not.toBeNull();
    expect(viewer.title).toBe("Test Flow");
  });

  it("navigates to Apex Action on node click", async () => {
    const element = createElement("c-flow-visualizer", {
      is: FlowVisualizer
    });
    element.flowId = "300tgL000000EhI1QA";
    element.flowName = "Test Flow";
    document.body.appendChild(element);

    await flushPromises();

    // Find diagram viewer and fire nodeclick
    const viewer = element.shadowRoot.querySelector("c-diagram-viewer");
    viewer.dispatchEvent(
      new CustomEvent("nodeclick", {
        detail: { nodeId: "ApexActionNode" }
      })
    );

    await flushPromises();

    // Verify breadcrumbs are rendered
    const breadcrumbs = element.shadowRoot.querySelectorAll(
      "lightning-breadcrumb"
    );
    expect(breadcrumbs.length).toBe(2);
    expect(breadcrumbs[1].label).toBe("Apex: MyApexClass");

    // Verify Apex Visualizer is rendered
    const apexViewer = element.shadowRoot.querySelector("c-apex-visualizer");
    expect(apexViewer).not.toBeNull();
    expect(apexViewer.className).toBe("MyApexClass");
  });

  it("shows breadcrumb + tabs in full view, bare apex diagram in compare view", async () => {
    const element = createElement("c-flow-visualizer", {
      is: FlowVisualizer
    });
    element.flowId = "300tgL000000EhI1QA";
    element.flowName = "Test Flow";
    document.body.appendChild(element);

    await flushPromises();

    const viewer = element.shadowRoot.querySelector("c-diagram-viewer");
    viewer.dispatchEvent(
      new CustomEvent("nodeclick", { detail: { nodeId: "ApexActionNode" } })
    );
    await flushPromises();

    // Drill-in defaults to full view: breadcrumb + Logic/Source tabset present.
    expect(
      element.shadowRoot.querySelectorAll("lightning-breadcrumb").length
    ).toBe(2);
    expect(element.shadowRoot.querySelector("lightning-tabset")).not.toBeNull();

    // Toggle to compare (side-by-side) via the expand control button.
    element.shadowRoot.querySelector(".control-btn").click();
    await flushPromises();

    // Compare view: no breadcrumb, no tabset — just the bare apex diagram.
    expect(
      element.shadowRoot.querySelectorAll("lightning-breadcrumb").length
    ).toBe(0);
    expect(element.shadowRoot.querySelector("lightning-tabset")).toBeNull();
    expect(
      element.shadowRoot.querySelector("c-apex-visualizer")
    ).not.toBeNull();
  });

  it("navigates to Subflow on node click", async () => {
    const element = createElement("c-flow-visualizer", {
      is: FlowVisualizer
    });
    element.flowId = "300tgL000000EhI1QA";
    element.flowName = "Test Flow";
    document.body.appendChild(element);

    await flushPromises();

    // Trigger Node Click Event for a Subflow Call
    const viewer = element.shadowRoot.querySelector("c-diagram-viewer");
    viewer.dispatchEvent(
      new CustomEvent("nodeclick", {
        detail: { nodeId: "SubflowNode" }
      })
    );

    await flushPromises();
    expect(getFlowIdByName).toHaveBeenCalledWith({ flowName: "MySubflow" });

    await flushPromises();

    // Verify breadcrumbs length
    const breadcrumbs = element.shadowRoot.querySelectorAll(
      "lightning-breadcrumb"
    );
    expect(breadcrumbs.length).toBe(2);
    expect(breadcrumbs[1].label).toBe("MySubflow");

    // Verify a nested diagram-viewer is rendered in the split pane
    const viewers = element.shadowRoot.querySelectorAll("c-diagram-viewer");
    expect(viewers.length).toBe(2);
    const subflowViewer = viewers[1];
    expect(subflowViewer.diagramId).toBe("300tgSubflowId123");
  });

  it("pops state on breadcrumb click", async () => {
    const element = createElement("c-flow-visualizer", {
      is: FlowVisualizer
    });
    element.flowId = "300tgL000000EhI1QA";
    element.flowName = "Test Flow";
    document.body.appendChild(element);

    await flushPromises();

    // Trigger Node Click Event for an Apex Action Call
    const viewer = element.shadowRoot.querySelector("c-diagram-viewer");
    viewer.dispatchEvent(
      new CustomEvent("nodeclick", {
        detail: { nodeId: "ApexActionNode" }
      })
    );

    await flushPromises();

    let breadcrumbs = element.shadowRoot.querySelectorAll(
      "lightning-breadcrumb"
    );
    expect(breadcrumbs.length).toBe(2);

    // Click on the first breadcrumb (index 0)
    breadcrumbs[0].dispatchEvent(new CustomEvent("click"));

    await flushPromises();

    // Verify breadcrumbs are cleared since we are back at root
    breadcrumbs = element.shadowRoot.querySelectorAll("lightning-breadcrumb");
    expect(breadcrumbs.length).toBe(0);
  });

  it("closes split pane and resets stack to root", async () => {
    const element = createElement("c-flow-visualizer", {
      is: FlowVisualizer
    });
    element.flowId = "300tgL000000EhI1QA";
    element.flowName = "Test Flow";
    document.body.appendChild(element);

    await flushPromises();

    // Navigate to Apex Action
    const viewer = element.shadowRoot.querySelector("c-diagram-viewer");
    viewer.dispatchEvent(
      new CustomEvent("nodeclick", {
        detail: { nodeId: "ApexActionNode" }
      })
    );

    await flushPromises();
    expect(
      element.shadowRoot.querySelectorAll("lightning-breadcrumb").length
    ).toBe(2);

    // Click Close Button
    const buttons = element.shadowRoot.querySelectorAll("button");
    const closeBtn = Array.from(buttons).find(
      (b) => b.title === "Close Visualizer"
    );
    closeBtn.click();

    await flushPromises();

    // Verify split pane is closed
    expect(
      element.shadowRoot.querySelectorAll("lightning-breadcrumb").length
    ).toBe(0);
  });

  it("fetches source code when Tab becomes active", async () => {
    const element = createElement("c-flow-visualizer", {
      is: FlowVisualizer
    });
    element.flowId = "300tgL000000EhI1QA";
    element.flowName = "Test Flow";
    document.body.appendChild(element);

    await flushPromises();

    // Navigate to Apex Action
    const viewer = element.shadowRoot.querySelector("c-diagram-viewer");
    viewer.dispatchEvent(
      new CustomEvent("nodeclick", {
        detail: { nodeId: "ApexActionNode" }
      })
    );

    await flushPromises();

    // Find and trigger code tab
    const tabs = element.shadowRoot.querySelectorAll("lightning-tab");
    const tab = Array.from(tabs).find((t) => t.value === "code");
    tab.dispatchEvent(new CustomEvent("active"));

    await flushPromises();

    expect(getApexClassBody).toHaveBeenCalledWith({ className: "MyApexClass" });

    await flushPromises();

    const pre = element.shadowRoot.querySelector(".split-code-container code");
    expect(pre).not.toBeNull();
    expect(pre.textContent).toBe("public class MyApexClass {}");
  });
});

describe("buildFlowDetails", () => {
  it("builds all rows when every field is present", () => {
    const rows = buildFlowDetails(
      { VersionNumber: 7, Status: "Active" },
      {
        apiVersion: "62.0",
        triggerOrder: 3,
        runInMode: "SystemModeWithoutSharing",
        description: "Creates the support user"
      }
    );
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(byLabel.Version).toBe("7 (Active)");
    expect(byLabel["API Version"]).toBe("62.0");
    expect(byLabel["Trigger Order"]).toBe("3");
    expect(byLabel["Run Mode"]).toBe("System Context without Sharing");
    expect(byLabel.Description).toBe("Creates the support user");
  });

  it("omits rows for absent fields and shows version without status", () => {
    const rows = buildFlowDetails({ VersionNumber: 2 }, { apiVersion: "60.0" });
    const labels = rows.map((r) => r.label);
    expect(labels).toEqual(["Version", "API Version"]);
    expect(rows[0].value).toBe("2");
    expect(labels).not.toContain("Trigger Order");
    expect(labels).not.toContain("Run Mode");
    expect(labels).not.toContain("Description");
  });

  it("falls back to the raw runInMode value when unmapped", () => {
    const rows = buildFlowDetails({}, { runInMode: "SomethingNew" });
    const runMode = rows.find((r) => r.label === "Run Mode");
    expect(runMode.value).toBe("SomethingNew");
  });

  it("reads triggerOrder from the start element when not at the root", () => {
    const rows = buildFlowDetails({}, { start: { triggerOrder: 5 } });
    const order = rows.find((r) => r.label === "Trigger Order");
    expect(order.value).toBe("5");
  });

  it("returns an empty list when there is nothing to show", () => {
    expect(buildFlowDetails({}, {})).toEqual([]);
    expect(buildFlowDetails(null, null)).toEqual([]);
  });
});
