import { LightningElement, api } from "lwc";
import { loadScript } from "lightning/platformResourceLoader";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import MERMAID_RESOURCE from "@salesforce/resourceUrl/mermaid";

const DIAGRAM_STYLES = `
  .diagram-canvas svg .pink rect,
  .diagram-canvas svg .pink polygon,
  .diagram-canvas svg .pink circle,
  .diagram-canvas svg .pink ellipse,
  .diagram-canvas svg .pink path,
  .diagram-canvas svg .state.pink rect {
    fill: #F43F5E !important;
    stroke: #BE185D !important;
    stroke-width: 2px !important;
  }
  .diagram-canvas svg .orange rect,
  .diagram-canvas svg .orange polygon,
  .diagram-canvas svg .orange circle,
  .diagram-canvas svg .orange ellipse,
  .diagram-canvas svg .orange path,
  .diagram-canvas svg .state.orange rect {
    fill: #F97316 !important;
    stroke: #C2410C !important;
    stroke-width: 2px !important;
  }
  .diagram-canvas svg .navy rect,
  .diagram-canvas svg .navy polygon,
  .diagram-canvas svg .navy circle,
  .diagram-canvas svg .navy ellipse,
  .diagram-canvas svg .navy path,
  .diagram-canvas svg .state.navy rect {
    fill: #475569 !important;
    stroke: #1E293B !important;
    stroke-width: 2px !important;
  }
  .diagram-canvas svg .blue rect,
  .diagram-canvas svg .blue polygon,
  .diagram-canvas svg .blue circle,
  .diagram-canvas svg .blue ellipse,
  .diagram-canvas svg .blue path,
  .diagram-canvas svg .state.blue rect {
    fill: #0284C7 !important;
    stroke: #0369A1 !important;
    stroke-width: 2px !important;
  }
  .diagram-canvas svg text,
  .diagram-canvas svg tspan,
  .diagram-canvas svg span,
  .diagram-canvas svg div {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    user-select: text !important;
    -webkit-user-select: text !important;
    cursor: text !important;
  }
  .diagram-canvas svg .pink text,
  .diagram-canvas svg .pink span,
  .diagram-canvas svg .pink tspan,
  .diagram-canvas svg .orange text,
  .diagram-canvas svg .orange span,
  .diagram-canvas svg .orange tspan,
  .diagram-canvas svg .navy text,
  .diagram-canvas svg .navy span,
  .diagram-canvas svg .navy tspan,
  .diagram-canvas svg .blue text,
  .diagram-canvas svg .blue span,
  .diagram-canvas svg .blue tspan {
    color: #ffffff !important;
    fill: #ffffff !important;
    stroke: none !important;
  }
  .diagram-canvas svg .state rect,
  .diagram-canvas svg .node rect {
    rx: 8px !important;
    ry: 8px !important;
  }

  /* --- Flow-specific Typography Hierarchy --- */
  .flow-diagram svg .node text tspan.line:first-child,
  .flow-diagram svg .node text tspan:first-child {
    font-weight: 700 !important;
    font-size: 13px !important;
  }
  .flow-diagram svg .node text tspan.line:nth-child(2),
  .flow-diagram svg .node text tspan:nth-child(2) {
    font-weight: 600 !important;
    font-size: 12.5px !important;
  }
  .flow-diagram svg .node text tspan.line:nth-child(n+3),
  .flow-diagram svg .node text tspan:nth-child(n+3) {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-size: 12px !important;
    font-weight: 400 !important;
    letter-spacing: -0.1px !important;
  }
  .flow-diagram svg .node.pink text tspan.line:nth-child(n+3),
  .flow-diagram svg .node.pink text tspan:nth-child(n+3),
  .flow-diagram svg .node.orange text tspan.line:nth-child(n+3),
  .flow-diagram svg .node.orange text tspan:nth-child(n+3),
  .flow-diagram svg .node.navy text tspan.line:nth-child(n+3),
  .flow-diagram svg .node.navy text tspan:nth-child(n+3),
  .flow-diagram svg .node.blue text tspan.line:nth-child(n+3),
  .flow-diagram svg .node.blue text tspan:nth-child(n+3) {
    fill: rgba(255, 255, 255, 0.85) !important;
  }

  /* --- Edge Labels Styling --- */
  .diagram-canvas svg .edgeLabel rect,
  .diagram-canvas svg .edgeLabel .label-container {
    fill: var(--slds-g-color-surface-container-2, #f5f5f5) !important;
    stroke: var(--slds-g-color-border-1, #e0e0e0) !important;
    rx: 4px !important;
    ry: 4px !important;
  }
  .diagram-canvas svg .edgeLabel text {
    font-size: 11px !important;
    font-weight: 700 !important;
    fill: var(--slds-g-color-on-surface-1, #1e293b) !important;
    /*
     * Do NOT force text-anchor here. Mermaid lays edge text out left-anchored
     * (x=0) against a box that spans [0..width]; centering is applied per label
     * in JS once the box is re-fitted to the styled text. Forcing "middle"
     * against x=0 re-introduces the left-shift bug. If the JS pass is ever
     * skipped, mermaid's native left-anchored layout still renders correctly.
     */
  }
  .diagram-canvas svg .edgeLabel foreignObject div,
  .diagram-canvas svg .edgeLabel foreignObject span,
  .diagram-canvas svg .edgeLabel div,
  .diagram-canvas svg .edgeLabel span {
    font-size: 11px !important;
    font-weight: 700 !important;
    color: var(--slds-g-color-on-surface-1, #1e293b) !important;
    text-align: center !important;
    justify-content: center !important;
    align-items: center !important;
    display: flex !important;
    width: 100% !important;
    height: 100% !important;
  }

  /* --- Apex-specific Typography Overrides --- */
  .apex-diagram svg [id*="choice_"]:not([id*="_Logic"]) text tspan,
  .apex-diagram svg [id*="choice_"]:not([id*="_Logic"]) text tspan.line,
  .apex-diagram svg [id*="loop_cond_"]:not([id*="_Logic"]) text tspan,
  .apex-diagram svg [id*="loop_cond_"]:not([id*="_Logic"]) text tspan.line,
  .apex-diagram svg [id*="METHOD_START"] text tspan,
  .apex-diagram svg [id*="METHOD_START"] text tspan.line,
  .apex-diagram svg [id*="METHOD_END"] text tspan,
  .apex-diagram svg [id*="METHOD_END"] text tspan.line,
  .apex-diagram svg [id*="dml_"] text tspan:first-child,
  .apex-diagram svg [id*="dml_"] text tspan.line:first-child {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-weight: 700 !important;
    font-size: 13px !important;
  }
  .apex-diagram svg [id*="action_"] text,
  .apex-diagram svg [id*="action_"] span,
  .apex-diagram svg [id*="action_"] tspan,
  .apex-diagram svg [id*="return_"] text,
  .apex-diagram svg [id*="return_"] span,
  .apex-diagram svg [id*="return_"] tspan,
  .apex-diagram svg [id*="_Logic"] text,
  .apex-diagram svg [id*="_Logic"] span,
  .apex-diagram svg [id*="_Logic"] tspan {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-weight: 400 !important;
    font-size: 12px !important;
    letter-spacing: -0.1px !important;
  }
  .apex-diagram svg [id*="dml_"] text tspan:nth-child(n+2),
  .apex-diagram svg [id*="dml_"] text tspan.line:nth-child(n+2) {
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-weight: 400 !important;
    font-size: 12px !important;
    letter-spacing: -0.1px !important;
  }
`;

/**
 * Re-fit an edge label's background box to its (already styled) text and center
 * BOTH the box and the text on the edge midpoint.
 *
 * Mermaid (htmlLabels: false) emits this structure:
 *   g.edgeLabel[transform=translate(midX, midY)]
 *     g.label[transform=translate(-w/2, -h/2)]
 *       rect[width=w]          (x omitted -> box spans [0..w])
 *       text > tspan[x=0]      (left-anchored)
 * It sizes the box with the DEFAULT font, but our CSS restyles edge text to
 * 11px bold afterwards, so the box and text drift apart. Recomputing from the
 * measured `textWidth` yields a correct result regardless of that difference.
 *
 * Exported so the geometry can be unit-tested without loading Mermaid.
 *
 * @param {Element} edgeLabel - the g.edgeLabel element
 * @param {number} textWidth - measured width of the styled text
 * @param {number} [padX=8] - horizontal padding on each side of the text
 * @returns {number|null} the new box width, or null if nothing was changed
 */
export function centerEdgeLabel(edgeLabel, textWidth, padX = 8) {
  if (!edgeLabel || !textWidth) return null;
  const labelGroup = edgeLabel.querySelector(".label");
  if (!labelGroup) return null;
  const rect = labelGroup.querySelector("rect");
  const textElement = labelGroup.querySelector("text");
  if (!rect || !textElement) return null;

  const newWidth = textWidth + padX * 2;

  // Box keeps its local origin at x=0 and spans [0..newWidth].
  rect.setAttribute("x", 0);
  rect.setAttribute("width", newWidth);

  // Re-center the label group on the edge midpoint, preserving the vertical
  // offset Mermaid computed for it.
  const transform = labelGroup.getAttribute("transform") || "";
  const yMatch = transform.match(/translate\(\s*[-\d.]+[ ,]+([-\d.]+)/);
  const currentY = yMatch ? parseFloat(yMatch[1]) : 0;
  labelGroup.setAttribute(
    "transform",
    `translate(${-newWidth / 2}, ${currentY})`
  );

  // Center the text inside the re-fitted box.
  textElement.style.textAnchor = "middle";
  textElement.setAttribute("x", newWidth / 2);
  textElement
    .querySelectorAll("tspan")
    .forEach((tspan) => tspan.setAttribute("x", newWidth / 2));

  return newWidth;
}

export default class DiagramViewer extends LightningElement {
  @api title = "";
  @api diagramId = "";
  @api builderUrl = "";
  @api builderButtonLabel = "";
  @api isLoading = false;
  @api loadingMessage = "";
  @api error = "";
  @api type = "flow"; // 'flow' or 'apex'
  @api resources;
  // Administrative metadata rows ([{ label, value }]) shown atop the Details panel.
  @api details;

  isDrawerOpen = false;
  isLegendOpen = false;

  _mermaidCode = "";
  _copiedMermaidCode = "";

  get canvasClass() {
    return `diagram-canvas slds-align_absolute-center ${this.type}-diagram`;
  }

  @api
  get mermaidCode() {
    return this._mermaidCode;
  }
  set mermaidCode(value) {
    this._mermaidCode = value;
    if (this.isLibraryLoaded && value) {
      this.renderDiagram();
    }
  }

  @api
  get copiedMermaidCode() {
    return this._copiedMermaidCode;
  }
  set copiedMermaidCode(value) {
    this._copiedMermaidCode = value;
  }

  zoomLevel = 1.0;
  naturalWidth;
  naturalHeight;

  isLibraryLoaded = false;
  _isDestroyed = false;

  // Drag scroll panning state
  isMouseDown = false;
  startX = 0;
  startY = 0;
  scrollLeft = 0;
  scrollTop = 0;

  get zoomPercentage() {
    return `${Math.round(this.zoomLevel * 100)}%`;
  }

  get effectiveBuilderButtonLabel() {
    return this.builderButtonLabel || "Open Builder";
  }

  get showLoading() {
    return this.isLoading && !this.error;
  }

  get workspaceClass() {
    return !this.isLoading && !this.error && this.mermaidCode
      ? "workspace-active"
      : "slds-hide";
  }

  get hasResources() {
    if (!this.resources) return false;
    const { variables, formulas, constants, textTemplates } = this.resources;
    return (
      (variables && variables.length > 0) ||
      (formulas && formulas.length > 0) ||
      (constants && constants.length > 0) ||
      (textTemplates && textTemplates.length > 0)
    );
  }

  get hasDetails() {
    return Array.isArray(this.details) && this.details.length > 0;
  }

  // The Details button/drawer should appear if there is anything to show.
  get hasPanelContent() {
    return this.hasDetails || this.hasResources;
  }

  get drawerClass() {
    return `diagram-drawer ${this.isDrawerOpen ? "open" : ""}`;
  }

  get drawerTitle() {
    return this.type === "flow" ? "Flow Details" : "Apex Details";
  }

  get detailsButtonLabel() {
    return this.type === "flow" ? "Flow Details" : "Apex Details";
  }

  get hasVariables() {
    return (
      this.resources &&
      this.resources.variables &&
      this.resources.variables.length > 0
    );
  }
  get variablesCount() {
    return this.hasVariables ? this.resources.variables.length : 0;
  }
  get hasFormulas() {
    return (
      this.resources &&
      this.resources.formulas &&
      this.resources.formulas.length > 0
    );
  }
  get formulasCount() {
    return this.hasFormulas ? this.resources.formulas.length : 0;
  }
  get hasConstants() {
    return (
      this.resources &&
      this.resources.constants &&
      this.resources.constants.length > 0
    );
  }
  get constantsCount() {
    return this.hasConstants ? this.resources.constants.length : 0;
  }
  get hasTextTemplates() {
    return (
      this.resources &&
      this.resources.textTemplates &&
      this.resources.textTemplates.length > 0
    );
  }
  get textTemplatesCount() {
    return this.hasTextTemplates ? this.resources.textTemplates.length : 0;
  }

  toggleDrawer() {
    this.isDrawerOpen = !this.isDrawerOpen;
  }

  toggleLegend() {
    this.isLegendOpen = !this.isLegendOpen;
  }

  // Color/icon key for the diagram, matching the converters' classDef colors.
  get legendItems() {
    const rows =
      this.type === "apex"
        ? [
            { color: "#475569", icon: "", label: "Method start / end" },
            { color: "#F97316", icon: "", label: "Control flow — If / Loop" },
            {
              color: "#F43F5E",
              icon: "",
              label: "DML — insert / update / delete / query"
            },
            { color: "#0284C7", icon: "", label: "Calls & returns" }
          ]
        : [
            {
              color: "#F97316",
              icon: "📝",
              label: "Logic — Assignment, Decision, Loop"
            },
            {
              color: "#F43F5E",
              icon: "✏️",
              label: "Data — Get / Create / Update / Delete records"
            },
            {
              color: "#475569",
              icon: "⚡",
              label: "Actions — Apex, Subflow, Stage"
            },
            { color: "#0284C7", icon: "💻", label: "Screen" },
            {
              color: "#94a3b8",
              icon: "🚫",
              label: "Unsupported / other element"
            },
            { color: "", icon: "❌", label: "Fault path" }
          ];
    return rows.map((r) => ({
      ...r,
      style: r.color
        ? `background-color: ${r.color};`
        : "background-color: transparent; border: 1px dashed var(--slds-g-color-border-1, #cbd5e1);"
    }));
  }

  connectedCallback() {
    this._isDestroyed = false;
    this.loadLibrary();
  }

  disconnectedCallback() {
    this._isDestroyed = true;
  }

  async loadLibrary() {
    try {
      if (!this.isLibraryLoaded) {
        await loadScript(this, MERMAID_RESOURCE);
        this.isLibraryLoaded = true;
      }
      if (this.mermaidCode) {
        this.renderDiagram();
      }
    } catch (err) {
      if (!this._isDestroyed) {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Error loading visualization libraries",
            message: err.message || err,
            variant: "error"
          })
        );
      }
    }
  }

  async renderDiagram() {
    if (!this.mermaidCode) return;

    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        // "strict" is sufficient: we never use HTML labels, so we don't need
        // the relaxed sanitization "loose" enables. Keeps untrusted metadata
        // text from being interpreted as markup.
        securityLevel: "strict",
        htmlLabels: false,
        themeVariables: {
          fontFamily:
            "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: "13px"
        },
        state: {
          htmlLabels: false
        },
        stateDiagram: {
          htmlLabels: false
        },
        flowchart: {
          useMaxWidth: false,
          htmlLabels: false,
          padding: 18
        }
      });

      const chartUniqueId = `mermaid_chart_${this.diagramId || "default"}`;

      // Render to SVG
      const { svg: svgCode } = await window.mermaid.render(
        chartUniqueId,
        this.mermaidCode
      );

      // lwc:dom="manual" container - wait for DOM update using a short delay
      // eslint-disable-next-line @lwc/lwc/no-async-operation
      setTimeout(() => {
        if (this._isDestroyed) return;

        const canvas = this.template.querySelector(".diagram-canvas");
        if (canvas) {
          // eslint-disable-next-line @lwc/lwc/no-inner-html
          canvas.innerHTML = svgCode;

          // Inject custom styles override FIRST so that text measurements reflect the styled font/weights
          const styleTag = document.createElement("style");
          styleTag.textContent = DIAGRAM_STYLES;
          canvas.appendChild(styleTag);

          const svgElement = canvas.querySelector("svg");
          if (svgElement) {
            const viewBox = svgElement.getAttribute("viewBox");
            if (viewBox) {
              const parts = viewBox.split(/\s+/);
              if (parts.length >= 4) {
                this.naturalWidth = parseFloat(parts[2]);
                this.naturalHeight = parseFloat(parts[3]);
              }
            }

            if (!this.naturalWidth) {
              this.naturalWidth =
                parseFloat(svgElement.getAttribute("width")) || 800;
            }
            if (!this.naturalHeight) {
              this.naturalHeight =
                parseFloat(svgElement.getAttribute("height")) || 600;
            }

            this.applyZoom();
          }

          // Programmatically left-align text inside rectangle nodes
          const nodeGroups = canvas.querySelectorAll("g.node");
          nodeGroups.forEach((nodeGroup) => {
            const nodeId = nodeGroup.getAttribute("id");
            if (
              nodeId &&
              !nodeId.includes("_Logic") &&
              (nodeId.includes("FLOW_START") ||
                nodeId.includes("FLOW_END") ||
                nodeId.includes("METHOD_START") ||
                nodeId.includes("METHOD_END"))
            ) {
              return;
            }
            const rect = nodeGroup.querySelector("rect");
            const text = nodeGroup.querySelector("text");
            if (rect && text) {
              const rectWidth = parseFloat(rect.getAttribute("width"));
              if (!isNaN(rectWidth)) {
                let textWidth = 0;
                if (typeof text.getBBox === "function") {
                  try {
                    textWidth = text.getBBox().width;
                  } catch {
                    const zoom = this.zoomLevel || 1.0;
                    textWidth = text.getBoundingClientRect().width / zoom;
                  }
                } else {
                  const zoom = this.zoomLevel || 1.0;
                  textWidth = text.getBoundingClientRect().width / zoom;
                }

                const padding = 12;
                // Double padding for both left and right edges
                const requiredWidth = textWidth + padding * 2;
                let targetWidth = rectWidth;

                if (requiredWidth > rectWidth) {
                  targetWidth = requiredWidth;
                  rect.setAttribute("width", targetWidth);
                  // Since Mermaid centers rects around x = -width/2, update the rect's x coordinate
                  rect.setAttribute("x", -targetWidth / 2);
                }

                text.style.textAnchor = "start";
                const shiftX = -(targetWidth / 2) + padding;
                text.setAttribute("transform", `translate(${shiftX}, 0)`);
              }

              // Adjust tspan line heights to match our CSS overrides
              const tspans = text.querySelectorAll("tspan");
              const isFlow = this.type === "flow";
              tspans.forEach((tspan, idx) => {
                const dy = tspan.getAttribute("dy");
                if (dy) {
                  const val = parseFloat(dy);
                  if (!isNaN(val)) {
                    let multiplier = 1.0;
                    if (isFlow) {
                      if (idx === 0) {
                        multiplier = 13.0 / 13.0;
                      } else if (idx === 1) {
                        multiplier = 13.0 / 12.5;
                      } else if (idx >= 2) {
                        multiplier = 13.0 / 12.0;
                      }
                    } else {
                      const parentNode = tspan.closest("g.node");
                      const parentId = parentNode
                        ? parentNode.getAttribute("id")
                        : "";
                      const isLogicNode =
                        parentId && parentId.includes("_Logic");
                      const isHeaderNode =
                        parentId &&
                        (parentId.includes("METHOD_START") ||
                          parentId.includes("METHOD_END") ||
                          parentId.includes("choice_") ||
                          parentId.includes("loop_cond_"));
                      const isDmlNode = parentId && parentId.includes("dml_");

                      if (isLogicNode) {
                        multiplier = 13.0 / 12.0;
                      } else if (isHeaderNode) {
                        multiplier = 13.0 / 13.0;
                      } else if (isDmlNode) {
                        multiplier = idx === 0 ? 13.0 / 13.0 : 13.0 / 12.0;
                      } else {
                        multiplier = 13.0 / 12.0;
                      }
                    }
                    const unit = dy.replace(/[-\d.]+/, "") || "em";
                    tspan.setAttribute(
                      "dy",
                      `${(val * multiplier).toFixed(3)}${unit}`
                    );
                  }
                }
              });
            }
          });

          // Add click event listeners to node groups for drill-down support
          const allNodeGroups = canvas.querySelectorAll("g.node");
          allNodeGroups.forEach((nodeGroup) => {
            nodeGroup.style.cursor = "pointer";
            nodeGroup.addEventListener("click", () => {
              const fullId = nodeGroup.getAttribute("id");
              if (fullId) {
                // Mermaid flowchart node IDs are usually formatted as 'flowchart-nodeId-N' or 'nodeId'
                let nodeId = fullId;
                if (nodeId.startsWith("flowchart-")) {
                  nodeId = nodeId.substring("flowchart-".length);
                  const lastDash = nodeId.lastIndexOf("-");
                  if (lastDash !== -1) {
                    nodeId = nodeId.substring(0, lastDash);
                  }
                }
                // If it is the logic details node, strip the suffix to resolve to the main element
                if (nodeId.endsWith("_Logic")) {
                  nodeId = nodeId.substring(0, nodeId.length - "_Logic".length);
                }

                this.dispatchEvent(
                  new CustomEvent("nodeclick", {
                    detail: { nodeId }
                  })
                );
              }
            });
          });

          // Normalize every edge label: measure the styled text, then re-fit
          // and re-center its box (see centerEdgeLabel for the geometry).
          const edgeLabels = canvas.querySelectorAll(".edgeLabel");
          edgeLabels.forEach((edgeLabel) => {
            const textElement = edgeLabel.querySelector(".label text");
            if (!textElement) return;

            // Measure the text at its final, styled size.
            let textWidth = 0;
            try {
              textWidth = textElement.getBBox().width;
            } catch {
              const zoom = this.zoomLevel || 1.0;
              textWidth = textElement.getBoundingClientRect().width / zoom;
            }

            // Empty labels (e.g. unlabeled connectors) measure 0 and are left as-is.
            centerEdgeLabel(edgeLabel, textWidth);
          });

          // Custom styles already injected early
        }
      }, 50);
    } catch (err) {
      if (!this._isDestroyed) {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Mermaid Rendering Error",
            message: err.message || err,
            variant: "error"
          })
        );
      }
    }
  }

  handleZoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel + 0.15, 3.0);
    this.applyZoom();
  }

  handleZoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel - 0.15, 0.3);
    this.applyZoom();
  }

  handleZoomReset() {
    this.zoomLevel = 1.0;
    this.applyZoom();
  }

  handleZoomFit() {
    const wrapper = this.template.querySelector(".canvas-wrapper");
    if (wrapper && this.naturalWidth) {
      const wrapperWidth = wrapper.clientWidth - 48; // padding
      this.zoomLevel = Math.min(wrapperWidth / this.naturalWidth, 1.0);
      this.applyZoom();
    }
  }

  applyZoom() {
    const canvas = this.template.querySelector(".diagram-canvas");
    if (canvas) {
      const svgElement = canvas.querySelector("svg");
      if (svgElement && this.naturalWidth && this.naturalHeight) {
        svgElement.style.width = `${this.naturalWidth * this.zoomLevel}px`;
        svgElement.style.height = `${this.naturalHeight * this.zoomLevel}px`;
      }
    }
  }

  handleRetry() {
    this.dispatchEvent(new CustomEvent("retry"));
  }

  generateResourcesMarkdown() {
    if (!this.hasResources) return "";

    let md = "";
    const typeLabel = this.type === "flow" ? "Flow" : "Apex";
    md += `\n\n## ${typeLabel} Details`;

    const { variables, formulas, constants, textTemplates } = this.resources;

    const escapePipe = (str) => {
      if (!str) return "";
      return String(str).replace(/\|/g, "\\|");
    };

    // Variables & Properties
    if (variables && variables.length > 0) {
      if (this.type === "flow") {
        md += `\n\n### Variables\n| Name | Data Type | Collection | Access |\n| --- | --- | --- | --- |`;
        variables.forEach((v) => {
          const coll = v.isCollection ? "True" : "False";
          md += `\n| ${escapePipe(v.name)} | ${escapePipe(v.dataType)} | ${coll} | ${escapePipe(v.access)} |`;
        });
      } else {
        md += `\n\n### Variables & Properties\n| Name | Data Type | Collection | Access | Scope |\n| --- | --- | --- | --- | --- |`;
        variables.forEach((v) => {
          const coll = v.isCollection ? "True" : "False";
          md += `\n| ${escapePipe(v.name)} | ${escapePipe(v.dataType)} | ${coll} | ${escapePipe(v.access)} | ${escapePipe(v.scope)} |`;
        });
      }
    }

    // Formulas
    if (formulas && formulas.length > 0) {
      md += `\n\n### Formulas\n| Name | Data Type | Expression |\n| --- | --- | --- |`;
      formulas.forEach((f) => {
        const cleanExpression = escapePipe(f.expression).replace(
          /\r?\n/g,
          "<br/>"
        );
        md += `\n| ${escapePipe(f.name)} | ${escapePipe(f.dataType)} | \`${cleanExpression}\` |`;
      });
    }

    // Constants
    if (constants && constants.length > 0) {
      md += `\n\n### Constants\n| Name | Data Type | Value |\n| --- | --- | --- |`;
      constants.forEach((c) => {
        const cleanValue = escapePipe(c.value).replace(/\r?\n/g, "<br/>");
        md += `\n| ${escapePipe(c.name)} | ${escapePipe(c.dataType)} | \`${cleanValue}\` |`;
      });
    }

    // Text Templates
    if (textTemplates && textTemplates.length > 0) {
      md += `\n\n### Text Templates\n| Name | Content |\n| --- | --- |`;
      textTemplates.forEach((t) => {
        const cleanText = escapePipe(t.text).replace(/\r?\n/g, "<br/>");
        md += `\n| ${escapePipe(t.name)} | ${cleanText} |`;
      });
    }

    return md;
  }

  generateDetailsMarkdown() {
    if (!this.hasDetails) return "";
    let md = `\n\n## ${this.type === "flow" ? "Flow" : "Apex"} Information`;
    md += `\n| Field | Value |\n| --- | --- |`;
    this.details.forEach((row) => {
      const value = String(row.value)
        .replace(/\|/g, "\\|")
        .replace(/\r?\n/g, " ");
      md += `\n| ${row.label} | ${value} |`;
    });
    return md;
  }

  async handleCopyCode() {
    const codeToCopy = this.copiedMermaidCode || this.mermaidCode;
    let text = `\`\`\`mermaid\n${codeToCopy}\n\`\`\``;

    text += this.generateDetailsMarkdown();

    if (this.hasResources) {
      text += this.generateResourcesMarkdown();
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      this.dispatchEvent(
        new ShowToastEvent({
          title: "Copied!",
          message: "Mermaid flowchart code copied to clipboard.",
          variant: "success"
        })
      );
    } catch (err) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Copy Failed",
          message: err.message,
          variant: "error"
        })
      );
    }
  }

  handleRedirect() {
    if (this.builderUrl) {
      window.open(this.builderUrl, "_blank");
    }
  }

  // Export the FULL diagram (regardless of current zoom/pan) as a PNG. The SVG
  // is pure (htmlLabels disabled), so it rasterizes without tainting the canvas.
  // Note: the 'Outfit' web font may fall back to a system font in the raster.
  handleExportPng() {
    const canvas = this.template.querySelector(".diagram-canvas");
    const svg = canvas && canvas.querySelector("svg");
    if (!svg) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Nothing to export",
          message: "The diagram is not ready yet.",
          variant: "warning"
        })
      );
      return;
    }

    try {
      const SVG_NS = "http://www.w3.org/2000/svg";
      const scale = 2; // 2x for a crisp raster
      const width =
        this.naturalWidth || parseFloat(svg.getAttribute("width")) || 800;
      const height =
        this.naturalHeight || parseFloat(svg.getAttribute("height")) || 600;

      // Clone so the on-screen SVG is untouched, and make it self-contained.
      const clone = svg.cloneNode(true);
      clone.setAttribute("width", width);
      clone.setAttribute("height", height);
      clone.setAttribute("xmlns", SVG_NS);

      // Opaque white background (otherwise the PNG is transparent).
      const bg = document.createElementNS(SVG_NS, "rect");
      bg.setAttribute("x", 0);
      bg.setAttribute("y", 0);
      bg.setAttribute("width", width);
      bg.setAttribute("height", height);
      bg.setAttribute("fill", "#ffffff");
      clone.insertBefore(bg, clone.firstChild);

      // Inline our style overrides so node colors/edge labels render in the raster.
      const styleEl = document.createElementNS(SVG_NS, "style");
      styleEl.textContent = DIAGRAM_STYLES;
      clone.insertBefore(styleEl, clone.firstChild);

      const svgString = new XMLSerializer().serializeToString(clone);
      // Data URL (not a blob/object URL): Lightning Web Security rejects
      // object-URLs with the image/svg+xml MIME type ("Unsupported MIME type").
      // encodeURIComponent keeps emojis/special chars valid in the URL.
      const dataUrl =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

      const img = new Image();
      img.onload = () => {
        try {
          const offscreen = document.createElement("canvas");
          offscreen.width = width * scale;
          offscreen.height = height * scale;
          const ctx = offscreen.getContext("2d");
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          // toDataURL avoids object-URLs entirely (LWS-safe).
          const link = document.createElement("a");
          link.href = offscreen.toDataURL("image/png");
          link.download = `${this.exportFileName}.png`;
          link.click();
        } catch (e) {
          this.dispatchEvent(
            new ShowToastEvent({
              title: "Export failed",
              message: e.message || String(e),
              variant: "error"
            })
          );
        }
      };
      img.onerror = () => {
        this.dispatchEvent(
          new ShowToastEvent({
            title: "Export failed",
            message: "Could not render the diagram to an image.",
            variant: "error"
          })
        );
      };
      img.src = dataUrl;
    } catch (err) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Export failed",
          message: err.message || String(err),
          variant: "error"
        })
      );
    }
  }

  get exportFileName() {
    return (this.title || "diagram").replace(/[^a-z0-9]+/gi, "_");
  }

  // --- Drag-Scroll Event Handlers ---
  handleMouseDown(event) {
    if (event.button !== 0) return;
    const wrapper = this.template.querySelector(".canvas-wrapper");
    if (!wrapper) return;

    this.isMouseDown = true;
    wrapper.classList.add("grabbing");

    this.startX = event.pageX - wrapper.offsetLeft;
    this.startY = event.pageY - wrapper.offsetTop;
    this.scrollLeft = wrapper.scrollLeft;
    this.scrollTop = wrapper.scrollTop;
  }

  handleMouseMove(event) {
    if (!this.isMouseDown) return;
    event.preventDefault();
    const wrapper = this.template.querySelector(".canvas-wrapper");
    if (!wrapper) return;

    const x = event.pageX - wrapper.offsetLeft;
    const y = event.pageY - wrapper.offsetTop;
    const walkX = (x - this.startX) * 1.5;
    const walkY = (y - this.startY) * 1.5;

    wrapper.scrollLeft = this.scrollLeft - walkX;
    wrapper.scrollTop = this.scrollTop - walkY;
  }

  handleMouseUp() {
    this.isMouseDown = false;
    const wrapper = this.template.querySelector(".canvas-wrapper");
    if (wrapper) {
      wrapper.classList.remove("grabbing");
    }
  }

  handleMouseLeave() {
    this.isMouseDown = false;
    const wrapper = this.template.querySelector(".canvas-wrapper");
    if (wrapper) {
      wrapper.classList.remove("grabbing");
    }
  }
}
