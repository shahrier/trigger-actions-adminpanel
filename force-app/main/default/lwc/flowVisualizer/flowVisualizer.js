import { LightningElement, api } from "lwc";
import getSessionId from "@salesforce/apex/OrgSessionController.getSessionId";
import getOrgDomainUrl from "@salesforce/apex/OrgSessionController.getOrgDomainUrl";
import getFlowIdByName from "@salesforce/apex/TriggerActionService.getFlowIdByName";
import getApexClassBody from "@salesforce/apex/TriggerActionService.getApexClassBody";
import { convertFlowToMermaid } from "c/flowLensConverter";
import { resolveFlowRecordReferences } from "./relationshipResolver";
export { convertFlowToMermaid };

// Salesforce ID format: 15 or 18 alphanumeric characters
const SFDC_ID_PATTERN = /^[a-zA-Z0-9]{15,18}$/;

// Flow Metadata runInMode enum → human-readable sharing/context label.
const RUN_MODE_LABELS = {
  DefaultMode: "User or System Context (default)",
  SystemModeWithSharing: "System Context with Sharing",
  SystemModeWithoutSharing: "System Context without Sharing"
};

/**
 * Build the administrative "Flow Information" rows shown in the Flow Details
 * panel. Returns a list of { label, value } for the fields that are present.
 * @param {object} flowRecord - the Flow Tooling record (VersionNumber, Status)
 * @param {object} metadata - the Flow Metadata (apiVersion, triggerOrder, ...)
 */
export function buildFlowDetails(flowRecord, metadata) {
  const rows = [];
  const has = (v) => v !== undefined && v !== null && v !== "";

  if (flowRecord && has(flowRecord.VersionNumber)) {
    const status = flowRecord.Status ? ` (${flowRecord.Status})` : "";
    rows.push({
      label: "Version",
      value: `${flowRecord.VersionNumber}${status}`
    });
  }
  if (metadata && has(metadata.apiVersion)) {
    rows.push({ label: "API Version", value: String(metadata.apiVersion) });
  }
  const triggerOrder =
    metadata && has(metadata.triggerOrder)
      ? metadata.triggerOrder
      : metadata && metadata.start
        ? metadata.start.triggerOrder
        : undefined;
  if (has(triggerOrder)) {
    rows.push({ label: "Trigger Order", value: String(triggerOrder) });
  }
  if (metadata && has(metadata.runInMode)) {
    rows.push({
      label: "Run Mode",
      value: RUN_MODE_LABELS[metadata.runInMode] || metadata.runInMode
    });
  }
  if (metadata && has(metadata.description)) {
    rows.push({ label: "Description", value: metadata.description });
  }
  return rows;
}

export default class FlowVisualizer extends LightningElement {
  _flowId;
  @api
  get flowId() {
    return this._flowId;
  }
  set flowId(value) {
    if (this._flowId !== value) {
      this._flowId = value;
      this.navigationHistory = [];
      if (this.sessionId && this.orgDomainUrl) {
        this.loadSessionAndMetadata();
      }
    }
  }

  @api flowName;
  @api highlightNodeId;
  @api apiVersion = "v66.0";

  error;
  isLoading = true;
  loadingMessage = "Authenticating session...";
  resources;
  flowDetails;

  sessionId;
  orgDomainUrl;
  mermaidCode;
  copiedMermaidCode;
  _isDestroyed = false;
  isApexPaneExpanded = false;
  flowMetadata;

  navigationHistory = [];
  sourceCodeMap = {};
  isCodeLoading = false;
  codeError = null;
  subflowDataMap = {};

  get currentFlowMetadata() {
    const active = this.activePaneItem;
    if (active && active.type === "flow" && active.id !== this.flowId) {
      return this.activePaneData.metadata;
    }
    return this.flowMetadata;
  }

  get activePaneData() {
    return (
      this.subflowDataMap[this.activePaneId] || {
        isLoading: true,
        loadingMessage: "Loading...",
        error: null,
        mermaidCode: "",
        copiedMermaidCode: "",
        resources: null,
        metadata: null
      }
    );
  }

  get isSubflowLoading() {
    return this.activePaneData.isLoading;
  }

  get subflowLoadingMessage() {
    return this.activePaneData.loadingMessage;
  }

  get subflowError() {
    return this.activePaneData.error;
  }

  get activePaneMermaidCode() {
    return this.activePaneData.mermaidCode;
  }

  get activePaneCopiedMermaidCode() {
    return this.activePaneData.copiedMermaidCode;
  }

  get activePaneResources() {
    return this.activePaneData.resources;
  }

  get activePaneDetails() {
    return this.activePaneData.details;
  }

  get activePaneBuilderUrl() {
    if (!this.orgDomainUrl || !this.activePaneId) return "";
    return `${this.orgDomainUrl}/builder_platform_interaction/flowBuilder.app?flowDefId=${this.activePaneId}`;
  }

  get builderUrl() {
    if (!this.orgDomainUrl || !this.flowId) return "";
    // Flow Builder requires the flowDefId parameter when passing the FlowDefinition (300) ID.
    return `${this.orgDomainUrl}/builder_platform_interaction/flowBuilder.app?flowDefId=${this.flowId}`;
  }

  connectedCallback() {
    this._isDestroyed = false;
    this.loadSessionAndMetadata();
  }

  disconnectedCallback() {
    this._isDestroyed = true;
  }

  get isSplitPaneOpen() {
    return this.navigationHistory.length > 1;
  }

  get flowPaneClass() {
    if (this.isSplitPaneOpen) {
      // In compare (split) mode the right pane is now a bare diagram, structurally
      // identical to the left, so the two panes align without extra spacing.
      return this.isApexPaneExpanded
        ? "flow-pane split-hidden"
        : "flow-pane split-active";
    }
    return "flow-pane";
  }

  get splitPaneClass() {
    return this.isApexPaneExpanded
      ? "apex-split-pane expanded"
      : "apex-split-pane";
  }

  get expandButtonIcon() {
    return this.isApexPaneExpanded ? "utility:contract" : "utility:expand";
  }

  get expandButtonTitle() {
    return this.isApexPaneExpanded
      ? "Compare with parent flow"
      : "Hide parent flow";
  }

  get activePaneItem() {
    if (this.navigationHistory.length > 1) {
      return this.navigationHistory[this.navigationHistory.length - 1];
    }
    return null;
  }

  get activePaneId() {
    return this.activePaneItem ? this.activePaneItem.id : "";
  }

  get activePaneLabel() {
    return this.activePaneItem ? this.activePaneItem.label : "";
  }

  get activePaneMethod() {
    return this.activePaneItem ? this.activePaneItem.method : "";
  }

  get isSubflowActive() {
    return this.activePaneItem ? this.activePaneItem.type === "flow" : false;
  }

  get isApexActive() {
    return this.activePaneItem ? this.activePaneItem.type === "apex" : false;
  }

  // Apex in full view: show the rich chrome (breadcrumb + Logic/Source tabs).
  get isApexExpandedView() {
    return this.isApexActive && this.isApexPaneExpanded;
  }

  // Apex in compare (side-by-side) view: bare diagram, aligned with the flow pane.
  get isApexCompareView() {
    return this.isApexActive && !this.isApexPaneExpanded;
  }

  get breadcrumbs() {
    return this.navigationHistory.map((item, idx) => ({
      id: item.id + "-" + idx,
      label: item.type === "apex" ? `Apex: ${item.label}` : item.label,
      index: idx
    }));
  }

  get sourceCode() {
    const active = this.activePaneItem;
    if (active && active.type === "apex") {
      return this.sourceCodeMap[active.id] || "";
    }
    return "";
  }

  handleToggleExpand() {
    this.isApexPaneExpanded = !this.isApexPaneExpanded;
  }

  async handleNodeClick(event) {
    const nodeId = event.detail.nodeId;
    const metadata = this.currentFlowMetadata;
    if (!nodeId || !metadata) return;

    // Check if Apex Action Call
    const actionCalls = metadata.actionCalls
      ? Array.isArray(metadata.actionCalls)
        ? metadata.actionCalls
        : [metadata.actionCalls]
      : [];

    const actionCall = actionCalls.find((call) => call.name === nodeId);
    if (actionCall && actionCall.actionType === "apex") {
      const className = actionCall.actionName;

      // Extract target method name if specified in parameters (e.g. functionName)
      let targetMethod = "";
      const inputParams = actionCall.inputParameters
        ? Array.isArray(actionCall.inputParameters)
          ? actionCall.inputParameters
          : [actionCall.inputParameters]
        : [];

      const methodParam = inputParams.find((param) => {
        const pName = (param.name || "").toLowerCase();
        return (
          pName === "functionname" ||
          pName === "methodname" ||
          pName === "action" ||
          pName === "operation"
        );
      });

      if (methodParam && methodParam.value) {
        const rawVal =
          methodParam.value.stringValue ||
          methodParam.value.elementReference ||
          "";
        targetMethod = rawVal.replace(/['"]/g, "").trim();
      }

      this.navigationHistory = [
        ...this.navigationHistory,
        {
          id: className,
          label: className,
          type: "apex",
          method: targetMethod
        }
      ];
      // Default to the focused full view; the parent flow stays one tap away
      // via the "Compare with parent flow" toggle and the breadcrumb.
      this.isApexPaneExpanded = true;
      return;
    }

    // Check if Subflow Call
    const subflows = metadata.subflows
      ? Array.isArray(metadata.subflows)
        ? metadata.subflows
        : [metadata.subflows]
      : [];

    const subflow = subflows.find((s) => s.name === nodeId);
    if (subflow && subflow.flowName) {
      const tempId = "loading-" + subflow.flowName;
      this.navigationHistory = [
        ...this.navigationHistory,
        {
          id: tempId,
          label: subflow.flowName,
          type: "flow"
        }
      ];
      // Default to the focused full view (see apex branch above).
      this.isApexPaneExpanded = true;

      this.subflowDataMap = {
        ...this.subflowDataMap,
        [tempId]: {
          isLoading: true,
          loadingMessage: "Resolving Flow ID...",
          error: null,
          mermaidCode: "",
          resources: null
        }
      };

      try {
        const subflowId = await getFlowIdByName({ flowName: subflow.flowName });
        if (subflowId) {
          // Replace tempId with actual subflow ID in history
          this.navigationHistory = this.navigationHistory.map((item) => {
            if (item.id === tempId) {
              return { ...item, id: subflowId };
            }
            return item;
          });
          // Load subflow metadata
          await this.loadSubflowMetadata(subflowId, subflow.flowName);
        } else {
          throw new Error(`Flow not found for name ${subflow.flowName}`);
        }
      } catch (err) {
        const lastItem =
          this.navigationHistory[this.navigationHistory.length - 1];
        if (lastItem && lastItem.id.startsWith("loading-")) {
          const actualTempId = lastItem.id;
          this.subflowDataMap = {
            ...this.subflowDataMap,
            [actualTempId]: {
              isLoading: false,
              error: `Failed to resolve Subflow ID: ${err.body?.message || err.message}`,
              mermaidCode: "",
              resources: null
            }
          };
        }
      }
    }
  }

  async loadSubflowMetadata(subflowId, subflowName) {
    if (this.subflowDataMap[subflowId]) {
      return;
    }

    this.subflowDataMap = {
      ...this.subflowDataMap,
      [subflowId]: {
        isLoading: true,
        loadingMessage: "Fetching Flow metadata...",
        error: null,
        mermaidCode: "",
        resources: null
      }
    };

    try {
      this.subflowDataMap[subflowId].loadingMessage =
        "Querying Flow version...";
      let data = await this.queryFlow(subflowId, true);
      if (!data) {
        data = await this.queryFlow(subflowId, false);
      }

      if (!data || !data.Metadata) {
        throw new Error(`No Flow version metadata found for ID ${subflowId}.`);
      }

      this.subflowDataMap[subflowId].loadingMessage =
        "Resolving record references...";
      const resolvedMetadata = await resolveFlowRecordReferences(
        data.Metadata,
        this.sessionId,
        this.orgDomainUrl,
        this.apiVersion
      );

      this.subflowDataMap[subflowId].loadingMessage =
        "Generating flowchart diagram...";
      const mermaidCode = convertFlowToMermaid(
        resolvedMetadata,
        subflowName,
        false
      );
      const copiedMermaidCode = convertFlowToMermaid(
        resolvedMetadata,
        subflowName,
        true
      );
      const resources = this.parseFlowResources(resolvedMetadata);
      const details = buildFlowDetails(data, resolvedMetadata);

      this.subflowDataMap = {
        ...this.subflowDataMap,
        [subflowId]: {
          isLoading: false,
          error: null,
          mermaidCode,
          copiedMermaidCode,
          resources,
          details,
          metadata: resolvedMetadata
        }
      };
    } catch (err) {
      this.subflowDataMap = {
        ...this.subflowDataMap,
        [subflowId]: {
          isLoading: false,
          error: `REST callout failed: ${err.message}`,
          mermaidCode: "",
          resources: null
        }
      };
    }
  }

  handleSubflowRetry() {
    const active = this.activePaneItem;
    if (active && active.type === "flow" && active.id !== this.flowId) {
      const subflowId = active.id;
      const subflowName = active.label;
      delete this.subflowDataMap[subflowId];
      this.loadSubflowMetadata(subflowId, subflowName);
    }
  }

  handleBreadcrumbClick(event) {
    const idx = parseInt(event.currentTarget.name, 10);
    if (isNaN(idx) || idx < 0 || idx >= this.navigationHistory.length) return;
    this.navigationHistory = this.navigationHistory.slice(0, idx + 1);
    // Back at the root flow there is no drill-in pane; clear the toggle so the
    // next drill-in starts fresh in full view.
    if (this.navigationHistory.length <= 1) {
      this.isApexPaneExpanded = false;
    }
  }

  async handleTabActive() {
    const active = this.activePaneItem;
    if (!active || active.type !== "apex") return;
    const className = active.id;

    if (this.sourceCodeMap[className]) {
      this.codeError = null;
      return;
    }

    this.isCodeLoading = true;
    this.codeError = null;
    try {
      const body = await getApexClassBody({ className });
      this.sourceCodeMap = {
        ...this.sourceCodeMap,
        [className]: body
      };
    } catch (err) {
      this.codeError = `Failed to retrieve class body: ${err.body?.message || err.message}`;
    } finally {
      this.isCodeLoading = false;
    }
  }

  handleCloseSplitPane() {
    this.navigationHistory = this.navigationHistory.slice(0, 1);
    this.isApexPaneExpanded = false;
  }

  async loadSessionAndMetadata() {
    try {
      this.isLoading = true;
      this.error = null;

      if (!this.sessionId || !this.orgDomainUrl) {
        this.loadingMessage = "Authenticating session...";
        const [session, domain] = await Promise.all([
          getSessionId(),
          getOrgDomainUrl()
        ]);

        this.sessionId = session;
        this.orgDomainUrl = domain;
      }

      if (!this.sessionId) {
        throw new Error(
          "Failed to retrieve an active API session token. Please ensure your user has appropriate administrative rights."
        );
      }

      await this.fetchFlowMetadata();
    } catch (err) {
      if (this._isDestroyed) return;
      this.error = err.message || err;
      this.isLoading = false;
    }
  }

  async fetchFlowMetadata() {
    this.loadingMessage =
      "Fetching Flow metadata from Salesforce Tooling API...";

    try {
      // First try to fetch the active version of the flow
      let data = await this.queryFlow(this.flowId, true);

      // If no active version found, fetch the latest version (e.g. draft/obsolete)
      if (!data) {
        data = await this.queryFlow(this.flowId, false);
      }

      if (!data || !data.Metadata) {
        throw new Error(
          `No Flow version metadata found for ID ${this.flowId}.`
        );
      }

      this.loadingMessage = "Resolving record references...";

      // Resolve $Record paths to concrete sObject names (e.g. $Record.Owner → Account.Owner)
      const resolvedMetadata = await resolveFlowRecordReferences(
        data.Metadata,
        this.sessionId,
        this.orgDomainUrl,
        this.apiVersion
      );

      this.loadingMessage = "Generating flowchart diagram...";

      // Translate the Metadata JSON using our flow-lens port
      this.mermaidCode = convertFlowToMermaid(
        resolvedMetadata,
        this.flowName,
        false
      );
      if (this.highlightNodeId) {
        this.mermaidCode += `\n  style ${this.highlightNodeId} stroke:#FF5D5D,stroke-width:5px,stroke-dasharray:5;`;
      }
      this.copiedMermaidCode = convertFlowToMermaid(
        resolvedMetadata,
        this.flowName,
        true
      );
      this.resources = this.parseFlowResources(resolvedMetadata);
      this.flowDetails = buildFlowDetails(data, resolvedMetadata);
      this.flowMetadata = resolvedMetadata;

      if (this.navigationHistory.length === 0) {
        this.navigationHistory = [
          {
            id: this.flowId,
            label: this.flowName || "Main Flow",
            type: "flow"
          }
        ];
      }

      this.isLoading = false;
    } catch (err) {
      if (!this._isDestroyed) {
        this.error = `REST callout failed: ${err.message}. Please verify if CORS allows requests from this Lightning origin to your Salesforce API domain.`;
        this.isLoading = false;
      }
    }
  }

  async queryFlow(flowId, activeOnly) {
    // Validate flowId to prevent SOQL injection via Tooling API query string
    if (!flowId || !SFDC_ID_PATTERN.test(flowId)) {
      throw new Error(
        `Invalid Flow ID format: "${flowId}". Expected a 15 or 18-character Salesforce ID.`
      );
    }

    let query = `SELECT Id, VersionNumber, Status, Metadata FROM Flow WHERE DefinitionId = '${flowId}'`;
    if (activeOnly) {
      query += ` AND Status = 'Active'`;
    } else {
      query += ` ORDER BY VersionNumber DESC LIMIT 1`;
    }

    const url = `${this.orgDomainUrl}/services/data/${this.apiVersion}/tooling/query?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.sessionId}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Tooling API query failed with status ${response.status}: ${errText}`
      );
    }

    const resData = await response.json();
    if (resData.records && resData.records.length > 0) {
      return resData.records[0];
    }
    return null;
  }

  handleRetry() {
    this.error = null;
    this.isLoading = true;
    this.loadSessionAndMetadata();
  }

  parseFlowResources(metadata) {
    if (!metadata) return null;

    const resources = {
      variables: [],
      formulas: [],
      constants: [],
      textTemplates: []
    };

    const getArray = (val) => {
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    };

    // 1. Variables
    getArray(metadata.variables).forEach((v) => {
      let dataTypeText = v.dataType || "";
      if (dataTypeText === "SObject" && v.objectType) {
        dataTypeText = `Record (${v.objectType})`;
      }

      let accessText = "Private";
      if (v.isInput && v.isOutput) {
        accessText = "Input & Output";
      } else if (v.isInput) {
        accessText = "Input Only";
      } else if (v.isOutput) {
        accessText = "Output Only";
      }

      resources.variables.push({
        name: v.name,
        dataType: dataTypeText,
        isCollection: v.isCollection === true || v.isCollection === "true",
        access: accessText
      });
    });

    // 2. Formulas
    getArray(metadata.formulas).forEach((f) => {
      resources.formulas.push({
        name: f.name,
        dataType: f.dataType || "",
        expression: f.expression || ""
      });
    });

    // 3. Constants
    getArray(metadata.constants).forEach((c) => {
      let constValue = "";
      if (c.value) {
        if (typeof c.value === "object") {
          constValue =
            c.value.stringValue ||
            c.value.numberValue ||
            c.value.booleanValue ||
            JSON.stringify(c.value);
        } else {
          constValue = String(c.value);
        }
      }
      resources.constants.push({
        name: c.name,
        dataType: c.dataType || "",
        value: constValue
      });
    });

    // 4. Text Templates
    getArray(metadata.textTemplates).forEach((t) => {
      resources.textTemplates.push({
        name: t.name,
        text: t.text || ""
      });
    });

    // Sort alphabetically by name
    Object.keys(resources).forEach((key) => {
      resources[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return resources;
  }
}
