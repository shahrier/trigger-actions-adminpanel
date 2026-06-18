import { createElement } from "lwc";
import DiagramViewer, { centerEdgeLabel } from "c/diagramViewer";

describe("c-diagram-viewer", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it("does not render the 'Flow Details' button when no resources are passed", () => {
    const element = createElement("c-diagram-viewer", {
      is: DiagramViewer
    });
    document.body.appendChild(element);

    const buttons = element.shadowRoot.querySelectorAll("lightning-button");
    const viewResourcesBtn = Array.from(buttons).find(
      (btn) => btn.label === "Flow Details"
    );
    expect(viewResourcesBtn).toBeUndefined();
  });

  it("renders the 'Flow Details' button and opens side-drawer when clicked", async () => {
    const element = createElement("c-diagram-viewer", {
      is: DiagramViewer
    });
    element.resources = {
      variables: [
        {
          name: "myVar",
          dataType: "String",
          isCollection: false,
          access: "Private"
        }
      ]
    };
    document.body.appendChild(element);

    // Wait for rendering
    await Promise.resolve();

    const buttons = element.shadowRoot.querySelectorAll("lightning-button");
    const viewResourcesBtn = Array.from(buttons).find(
      (btn) => btn.label === "Flow Details"
    );
    expect(viewResourcesBtn).toBeDefined();

    // Check closed state
    let drawer = element.shadowRoot.querySelector(".diagram-drawer");
    expect(drawer.classList.contains("open")).toBe(false);

    // Click to open
    viewResourcesBtn.click();
    await Promise.resolve();

    drawer = element.shadowRoot.querySelector(".diagram-drawer");
    expect(drawer.classList.contains("open")).toBe(true);
  });

  it("generates resources markdown when copying diagram code", async () => {
    const element = createElement("c-diagram-viewer", {
      is: DiagramViewer
    });
    element.mermaidCode = "graph TD; A-->B;";
    element.resources = {
      variables: [
        {
          name: "myVar",
          dataType: "String",
          isCollection: false,
          access: "Private"
        }
      ]
    };
    document.body.appendChild(element);

    await Promise.resolve();

    // Mock clipboard API
    const writeTextMock = jest.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock
      },
      writable: true,
      configurable: true
    });

    const buttons = element.shadowRoot.querySelectorAll("lightning-button");
    const copyButton = Array.from(buttons).find(
      (btn) => btn.label === "Copy Diagram Code"
    );
    expect(copyButton).toBeDefined();

    copyButton.click();
    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain("## Flow Details");
    expect(copiedText).toContain("| myVar | String | False | Private |");
  });

  it("generates resources markdown with Scope column for Apex type", async () => {
    const element = createElement("c-diagram-viewer", {
      is: DiagramViewer
    });
    element.mermaidCode = "graph TD; A-->B;";
    element.type = "apex";
    element.resources = {
      variables: [
        {
          name: "myVar",
          dataType: "String",
          isCollection: false,
          access: "Private",
          scope: "Method: myMethod()"
        }
      ]
    };
    document.body.appendChild(element);

    await Promise.resolve();

    // Mock clipboard API
    const writeTextMock = jest.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock
      },
      writable: true,
      configurable: true
    });

    const buttons = element.shadowRoot.querySelectorAll("lightning-button");
    const copyButton = Array.from(buttons).find(
      (btn) => btn.label === "Copy Diagram Code"
    );
    copyButton.click();
    await Promise.resolve();

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain("## Apex Details");
    expect(copiedText).toContain(
      "| myVar | String | False | Private | Method: myMethod() |"
    );
  });
});

describe("centerEdgeLabel (edge label geometry)", () => {
  // Mirrors Mermaid's real edge-label structure (htmlLabels: false):
  //   g.edgeLabel[translate(midX,midY)]
  //     g.label[translate(-w/2,-h/2)]
  //       rect[width=w]          (x omitted -> box spans [0..w])
  //       text > tspan[x=0]      (left-anchored)
  function parseSvg(markup) {
    return new DOMParser().parseFromString(markup, "image/svg+xml");
  }

  function makeEdgeLabel({
    text = "Matched User Contact Count = 0",
    boxWidth = 60,
    groupTransform = "translate(-30, -8)"
  } = {}) {
    const doc = parseSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <g class="edgeLabel" transform="translate(30, 49)">
          <g class="label" transform="${groupTransform}">
            <rect rx="0" ry="0" width="${boxWidth}" height="16"></rect>
            <text style=""><tspan xml:space="preserve" dy="1em" x="0" class="row">${text}</tspan></text>
          </g>
        </g>
      </svg>`);
    return doc.querySelector(".edgeLabel");
  }

  // The label group sits at the edge midpoint, so an element's position relative
  // to the midpoint is (group translateX + its local x).
  function groupTranslateX(edge) {
    const t = edge.querySelector(".label").getAttribute("transform");
    return parseFloat(t.match(/translate\(([-\d.]+)/)[1]);
  }

  it("centers both the box and the text on the edge midpoint", () => {
    const edge = makeEdgeLabel();
    const newWidth = centerEdgeLabel(edge, 186, 8); // 186 + 2*8
    expect(newWidth).toBe(202);

    const rect = edge.querySelector("rect");
    const text = edge.querySelector("text");
    const tx = groupTranslateX(edge);

    expect(tx).toBe(-101); // -newWidth/2
    expect(parseFloat(rect.getAttribute("x"))).toBe(0);
    expect(parseFloat(rect.getAttribute("width"))).toBe(202);

    // Box center and text both land exactly on the midpoint (x = 0).
    const rectCenter = parseFloat(rect.getAttribute("x")) + newWidth / 2;
    expect(rectCenter + tx).toBeCloseTo(0);
    expect(text.style.textAnchor).toBe("middle");
    expect(parseFloat(text.getAttribute("x")) + tx).toBeCloseTo(0);
    expect(
      parseFloat(text.querySelector("tspan").getAttribute("x")) + tx
    ).toBeCloseTo(0);
  });

  // Regression: the previous implementation only resized when the styled text
  // was WIDER than Mermaid's box, so a narrower box kept Mermaid's geometry and
  // (with the forced text-anchor) drifted. We must re-fit in this case too.
  it("re-fits and re-centers when styled text is narrower than Mermaid's box", () => {
    const edge = makeEdgeLabel({ boxWidth: 300 });
    const newWidth = centerEdgeLabel(edge, 40, 8);
    expect(newWidth).toBe(56);

    const rect = edge.querySelector("rect");
    const text = edge.querySelector("text");
    const tx = groupTranslateX(edge);

    expect(parseFloat(rect.getAttribute("width"))).toBe(56);
    expect(tx).toBe(-28);
    const rectCenter = parseFloat(rect.getAttribute("x")) + newWidth / 2;
    expect(rectCenter + tx).toBeCloseTo(0);
    expect(parseFloat(text.getAttribute("x")) + tx).toBeCloseTo(0);
  });

  it("preserves the vertical offset Mermaid computed for the label", () => {
    const edge = makeEdgeLabel({ groupTransform: "translate(-30, -12.5)" });
    centerEdgeLabel(edge, 50, 8); // newWidth = 66
    expect(edge.querySelector(".label").getAttribute("transform")).toBe(
      "translate(-33, -12.5)"
    );
  });

  it("leaves empty (unlabeled) connectors untouched", () => {
    const edge = makeEdgeLabel({ text: "", boxWidth: 0 });
    const before = edge.querySelector(".label").getAttribute("transform");
    expect(centerEdgeLabel(edge, 0)).toBeNull();
    // Nothing mutated.
    expect(edge.querySelector(".label").getAttribute("transform")).toBe(before);
    expect(edge.querySelector("text").style.textAnchor).toBe("");
  });

  it("returns null when the expected structure is missing", () => {
    const doc = parseSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><g class="edgeLabel"></g></svg>`
    );
    expect(centerEdgeLabel(doc.querySelector(".edgeLabel"), 100)).toBeNull();
    expect(centerEdgeLabel(null, 100)).toBeNull();
  });
});

describe("c-diagram-viewer legend & export", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  function findButton(element, label) {
    return Array.from(
      element.shadowRoot.querySelectorAll("lightning-button")
    ).find((b) => b.label === label);
  }

  it("toggles the legend popover and lists the flow legend rows", async () => {
    const element = createElement("c-diagram-viewer", { is: DiagramViewer });
    document.body.appendChild(element);
    await Promise.resolve();

    expect(element.shadowRoot.querySelector(".legend-popover")).toBeNull();

    const legendBtn = findButton(element, "Legend");
    expect(legendBtn).toBeDefined();

    legendBtn.click();
    await Promise.resolve();

    expect(element.shadowRoot.querySelector(".legend-popover")).not.toBeNull();
    expect(element.shadowRoot.querySelectorAll(".legend-row").length).toBe(6);

    // Toggles back closed.
    legendBtn.click();
    await Promise.resolve();
    expect(element.shadowRoot.querySelector(".legend-popover")).toBeNull();
  });

  it("shows the apex legend set for apex diagrams", async () => {
    const element = createElement("c-diagram-viewer", { is: DiagramViewer });
    element.type = "apex";
    document.body.appendChild(element);
    await Promise.resolve();

    findButton(element, "Legend").click();
    await Promise.resolve();

    expect(element.shadowRoot.querySelectorAll(".legend-row").length).toBe(4);
  });

  it("renders an Export PNG button and does not throw with no diagram", async () => {
    const element = createElement("c-diagram-viewer", { is: DiagramViewer });
    document.body.appendChild(element);
    await Promise.resolve();

    const exportBtn = findButton(element, "Export PNG");
    expect(exportBtn).toBeDefined();
    expect(() => exportBtn.click()).not.toThrow();
  });
});

describe("c-diagram-viewer Flow Details panel", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  function findButton(element, label) {
    return Array.from(
      element.shadowRoot.querySelectorAll("lightning-button")
    ).find((b) => b.label === label);
  }

  it("shows the Details button and Flow Information rows when details are passed without resources", async () => {
    const element = createElement("c-diagram-viewer", { is: DiagramViewer });
    element.details = [
      { label: "Version", value: "7 (Active)" },
      { label: "API Version", value: "62.0" },
      { label: "Run Mode", value: "System Context without Sharing" }
    ];
    document.body.appendChild(element);
    await Promise.resolve();

    const detailsBtn = findButton(element, "Flow Details");
    expect(detailsBtn).toBeDefined();

    detailsBtn.click();
    await Promise.resolve();

    const rows = element.shadowRoot.querySelectorAll(".detail-row");
    expect(rows.length).toBe(3);
    const sectionTitles = Array.from(
      element.shadowRoot.querySelectorAll(".section-title")
    ).map((el) => el.textContent);
    expect(sectionTitles).toContain("Flow Information");
  });

  it("does not show the Details button when there are neither details nor resources", () => {
    const element = createElement("c-diagram-viewer", { is: DiagramViewer });
    document.body.appendChild(element);
    expect(findButton(element, "Flow Details")).toBeUndefined();
  });
});
