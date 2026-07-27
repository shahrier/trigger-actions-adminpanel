import { LightningElement, api, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { refreshApex } from "@salesforce/apex";
import { NavigationMixin } from "lightning/navigation";
import getAllTriggerActions from "@salesforce/apex/TriggerActionService.getAllTriggerActions";
import getTriggerActionById from "@salesforce/apex/TriggerActionService.getTriggerActionById";
import getAvailableSObjects from "@salesforce/apex/TriggerActionService.getAvailableSObjects";
import getFlowIdByName from "@salesforce/apex/TriggerActionService.getFlowIdByName";
import getNativeAutomations from "@salesforce/apex/TriggerActionService.getNativeAutomations";
import getDiscoveredObjects from "@salesforce/apex/TriggerActionService.getDiscoveredObjects";
import createTriggerSetting from "@salesforce/apex/TriggerActionService.createTriggerSetting";
import updateTriggerActionOrders from "@salesforce/apex/TriggerActionService.updateTriggerActionOrders";
import getApexClassBody from "@salesforce/apex/TriggerActionService.getApexClassBody";
import getApexClassBodies from "@salesforce/apex/TriggerActionService.getApexClassBodies";
import getSessionId from "@salesforce/apex/OrgSessionController.getSessionId";
import getOrgDomainUrl from "@salesforce/apex/OrgSessionController.getOrgDomainUrl";
import { convertFlowToMermaid } from "c/flowLensConverter";

const CONTEXT_LABELS = [
  { field: "Before_Insert__c", label: "Before Insert" },
  { field: "After_Insert__c", label: "After Insert" },
  { field: "Before_Update__c", label: "Before Update" },
  { field: "After_Update__c", label: "After Update" },
  { field: "Before_Delete__c", label: "Before Delete" },
  { field: "After_Delete__c", label: "After Delete" },
  { field: "After_Undelete__c", label: "After Undelete" }
];

// ApexTrigger usage flags, keyed to the matching trigger-action context label.
const TRIGGER_USAGE_FIELDS = [
  { field: "UsageBeforeInsert", label: "Before Insert" },
  { field: "UsageAfterInsert", label: "After Insert" },
  { field: "UsageBeforeUpdate", label: "Before Update" },
  { field: "UsageAfterUpdate", label: "After Update" },
  { field: "UsageBeforeDelete", label: "Before Delete" },
  { field: "UsageAfterDelete", label: "After Delete" },
  { field: "UsageAfterUndelete", label: "After Undelete" }
];

// Tooling API refuses to return Metadata for more than one row per query, so a
// deep audit costs one callout per flow. Run a few at a time: enough to hide
// the latency, few enough not to swamp the browser's per-origin connections.
const DEEP_AUDIT_CONCURRENCY = 5;
const TOOLING_API_VERSION = "v62.0";
// Ids are interpolated into the Tooling API query string, so validate first.
const SFDC_ID_PATTERN = /^[a-zA-Z0-9]{15,18}$/;
// Guard against one pathological flow crowding out the rest of the payload.
const MAX_MERMAID_CHARS_PER_FLOW = 20000;
const MAX_APEX_CHARS_PER_CLASS = 20000;
// Components of a compound address/geolocation field, e.g.
// BD_Shipping_Address_Override__City__s -> BD_Shipping_Address_Override.
const COMPOUND_FIELD_COMPONENT =
  /^(.*)__(City|Street|PostalCode|StateCode|CountryCode|State|Country|Latitude|Longitude|GeocodeAccuracy)__s$/;
// Beyond this the list stops being readable; the rest are summarised.
const MAX_CONTENTION_FINDINGS = 8;

const FLOW_PHASE = {
  BEFORE_SAVE: "beforeSave",
  BEFORE_DELETE: "beforeDelete",
  AFTER_SAVE: "afterSave",
  OTHER: "other"
};

// Installed from a managed package: visible to the audit, but not editable,
// reorderable or deletable by this org.
function isManagedArtifact(artifact) {
  return !!artifact.NamespacePrefix;
}

// The Trigger Action Framework's own dispatcher trigger — the thin trigger that
// hands control to the framework (`new MetadataTriggerHandler().run();`). It is
// the mechanism that executes the TAF actions, NOT a competing automation, so
// it must never be reported as contention or as a migration candidate.
function isTafDispatcher(trigger) {
  return /MetadataTriggerHandler/.test(trigger.Body || "");
}

/**
 * Fields a flow actually WRITES on its triggering record, read straight from
 * the metadata rather than inferred from the diagram.
 *
 * Only the assign-to side counts. A field reached through a lookup on the
 * value side (`$Record.Campaign.Inbound_vs_Outbound__c`) is a read, and models
 * reliably mistake those for writes when left to interpret the diagram.
 */
function extractFlowFieldWrites(metadata) {
  const writes = new Map();
  const record = (field, element) => {
    if (!field) return;
    if (!writes.has(field)) writes.set(field, new Set());
    writes.get(field).add(element);
  };

  (metadata?.assignments || []).forEach((a) => {
    (a.assignmentItems || []).forEach((item) => {
      // "$Record.CampaignId" -> CampaignId. Anything deeper is a related
      // record, not a field on the record this flow is triggered on.
      const match = /^\$Record\.([A-Za-z0-9_]+)$/.exec(
        item.assignToReference || ""
      );
      if (match) record(match[1], a.name);
    });
  });

  (metadata?.recordUpdates || []).forEach((u) => {
    // Only updates aimed at the triggering record itself.
    if (u.inputReference && !/^\$Record$/.test(u.inputReference)) return;
    (u.inputAssignments || []).forEach((item) => record(item.field, u.name));
  });

  return writes;
}

/**
 * Cross-flow field contention, computed rather than inferred. Deliberately
 * limited to fields written by more than one *flow*: two writes inside a single
 * flow are usually exclusive branches of one decision, which is not a conflict.
 */
function buildFieldWriteMap(writesByFlow) {
  const byField = new Map();
  writesByFlow
    // An inactive flow never executes, so it cannot overwrite anything.
    // Counting one produces contention that does not exist at runtime.
    .filter(({ isActive }) => isActive)
    .forEach(({ label, writes }) => {
      writes.forEach((elements, field) => {
        // Compound fields (addresses, geolocations) surface one component per
        // subfield. Collapse them so a single address does not become five
        // near-identical findings.
        const base = COMPOUND_FIELD_COMPONENT.test(field)
          ? field.replace(COMPOUND_FIELD_COMPONENT, "$1") + " (address)"
          : field;
        if (!byField.has(base)) byField.set(base, new Map());
        const flows = byField.get(base);
        if (!flows.has(label)) flows.set(label, new Set());
        elements.forEach((e) => flows.get(label).add(e));
      });
    });

  const contested = [...byField.entries()]
    .map(([field, flows]) => [
      field,
      [...flows.entries()].map(([label, els]) => ({
        label,
        elements: [...els]
      }))
    ])
    .filter(([, flows]) => flows.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  // Field contention is fully decidable from the metadata, so it is reported
  // directly to the user instead of being routed through the model. Asked to
  // interpret the map, the model invented collisions it did not contain; asked
  // to reproduce it verbatim, it dropped the real ones. Neither is acceptable
  // for a fact we can simply compute.
  const shown = contested.slice(0, MAX_CONTENTION_FINDINGS);
  const overflow = contested.length - shown.length;
  const findings = shown.map(([field, flows]) => {
    const where = flows
      .map((f) => `"${f.label}" (${f.elements.join(", ")})`)
      .join(" and ");
    return (
      `#### [HIGH] Field contention on \`${field}\`\n` +
      `- **Evidence:** \`${field}\` is written by ${flows.length} separate flows: ${where}\n` +
      `- **Impact:** Whichever flow runs last silently overwrites the other's value for \`${field}\`; execution order between record-triggered flows is not guaranteed.\n` +
      `- **Fix:** Consolidate the \`${field}\` writes into one flow, or give the flows mutually exclusive entry criteria.`
    );
  });
  if (overflow > 0) {
    findings.push(
      `#### [HIGH] ${overflow} further field(s) written by multiple active flows\n` +
        `- **Evidence:** ${contested
          .slice(MAX_CONTENTION_FINDINGS)
          .map(([f]) => `\`${f}\``)
          .join(", ")}\n` +
        `- **Impact:** Same overwrite risk as above; listed together to keep this report readable.\n` +
        `- **Fix:** Review these alongside the contention already listed.`
    );
  }

  // What the model is told: the conclusion only, so it cannot contradict it.
  const note = contested.length
    ? `=== FIELD CONTENTION (already analysed — do not report on this) ===\n` +
      `${contested.length} field(s) on this object are written by more than one ACTIVE flow. ` +
      `This has been computed from the metadata and is already being shown to the user, ` +
      `so do not produce any finding about fields being written by multiple artifacts.\n`
    : `=== FIELD CONTENTION (already analysed — do not report on this) ===\n` +
      `No field on this object is written by more than one active flow. ` +
      `Do not produce any finding about field contention or field overwrites.\n`;

  return { note, findings: findings.join("\n\n") };
}

// Classify by the declared TriggerType rather than substring matching, so a
// before-delete flow is not also counted as an after-save flow.
function flowPhase(flow) {
  if (flow.TriggerType === "RecordBeforeSave") return FLOW_PHASE.BEFORE_SAVE;
  if (flow.TriggerType === "RecordBeforeDelete") {
    return FLOW_PHASE.BEFORE_DELETE;
  }
  if (
    flow.TriggerType === "RecordAfterSave" ||
    flow.ProcessType === "Workflow"
  ) {
    return FLOW_PHASE.AFTER_SAVE;
  }
  return FLOW_PHASE.OTHER;
}

export default class TriggerActionsManager extends NavigationMixin(
  LightningElement
) {
  @api title;
  actions = [];
  selectedAction = null;
  selectedObjectName = "";
  isLoading = false;
  showFormModal = false;
  showSettingFormModal = false;
  showDiscoveryModal = false;
  searchTerm = "";
  apexSourceCode = "";
  isApexCodeLoading = false;
  apexCodeError = null;
  isApexTrigger = false;
  isCreating = false;
  availableSObjects = [];
  discoveredObjects = [];
  nativeAutomations = { triggers: [], flows: [] };
  nativeLoading = false;
  discoverySearchTerm = "";
  discoverySortBy = "label";
  activeTab = "actions";
  nativeTypeFilter = "all";
  nativeStatusFilter = "all";
  isFlowModalOpen = false;
  selectedFlowId = "";
  selectedFlowName = "";
  isApexModalOpen = false;
  selectedApexClassName = "";
  isAiObjectAssistantOpen = false;
  objectAuditName = "";
  objectAuditPayload = "";
  objectAuditType = "OBJECT";
  objectAuditVerifiedFindings = "";
  auditProgress = "";
  _wiredActionsResult;
  _wiredSObjectsResult;
  _wiredNativeResult;

  draftOrders = {};

  get hasDraftChanges() {
    return Object.keys(this.draftOrders).length > 0;
  }

  @wire(getNativeAutomations, { objectName: "$selectedObjectName" })
  wiredNative(result) {
    this._wiredNativeResult = result;
    if (result.data) {
      this.nativeAutomations = result.data;
      this.nativeLoading = false;
    } else if (result.error) {
      this.nativeLoading = false;
      this.showError(
        "Error loading native automations",
        result.error.body?.message || result.error.message
      );
    }
  }

  @wire(getAllTriggerActions)
  wiredActions(result) {
    this._wiredActionsResult = result;
    if (result.data) {
      this.actions = result.data.map((action) => ({ ...action }));
      this.draftOrders = {};
    } else if (result.error) {
      this.showError(
        "Error loading trigger actions",
        result.error.body.message
      );
    }
  }

  @wire(getAvailableSObjects)
  wiredSObjects(result) {
    this._wiredSObjectsResult = result;
    if (result.data) {
      this.availableSObjects = result.data;
    }
  }

  // --- Computed properties ---

  get objectList() {
    if (!this.availableSObjects) return [];

    const actionCounts = {};
    if (this.actions) {
      this.actions.forEach((action) => {
        const obj = action.Object_API_Name__c
          ? action.Object_API_Name__c.toLowerCase()
          : "";
        actionCounts[obj] = (actionCounts[obj] || 0) + 1;
      });
    }

    return this.availableSObjects
      .filter(
        (obj) =>
          !this.searchTerm ||
          obj.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          (obj.label &&
            obj.label.toLowerCase().includes(this.searchTerm.toLowerCase()))
      )
      .map((obj) => ({
        name: obj.name,
        label: obj.label || obj.name,
        actionCount: obj.name ? actionCounts[obj.name.toLowerCase()] || 0 : 0,
        nativeCount: obj.nativeCount ? parseInt(obj.nativeCount, 10) : 0,
        cssClass:
          "object-item" +
          (this.selectedObjectName &&
          this.selectedObjectName.toLowerCase() === obj.name.toLowerCase()
            ? " selected"
            : "")
      }));
  }

  get objectActions() {
    if (!this.selectedObjectName) return [];

    const filtered = this.actions.filter(
      (a) =>
        a.Object_API_Name__c &&
        a.Object_API_Name__c.toLowerCase() ===
          this.selectedObjectName.toLowerCase()
    );

    const sections = [];
    for (const ctx of CONTEXT_LABELS) {
      const sorted = filtered
        .filter((a) => a[ctx.field])
        .sort((a, b) => (a.Order__c || 0) - (b.Order__c || 0));
      const contextActions = sorted.map((action, idx) => ({
        ...action,
        compositeId: `${ctx.field}-${action.Id}`,
        context: ctx.field,
        isFirst: idx === 0,
        isLast: idx === sorted.length - 1,
        cssClass:
          "action-item" +
          (this.selectedAction && this.selectedAction.Id === action.Id
            ? " selected"
            : "")
      }));

      if (contextActions.length > 0) {
        sections.push({
          key: ctx.field,
          label: ctx.label,
          actions: contextActions
        });
      }
    }
    return sections;
  }

  get hasObjectActions() {
    return this.objectActions.length > 0;
  }

  get noActionSelected() {
    return !this.selectedAction;
  }

  get activeContextLabels() {
    if (!this.selectedAction) return [];
    return CONTEXT_LABELS.filter((ctx) => this.selectedAction[ctx.field]).map(
      (ctx) => ({ label: ctx.label, key: ctx.field })
    );
  }

  get bypassIcon() {
    return this.selectedAction?.Bypass_Execution__c
      ? "utility:warning"
      : "utility:success";
  }

  get bypassLabel() {
    return this.selectedAction?.Bypass_Execution__c ? "Yes" : "No";
  }

  get flowRecursionIcon() {
    return this.selectedAction?.Allow_Flow_Recursion__c
      ? "utility:warning"
      : "utility:success";
  }

  get flowRecursionLabel() {
    return this.selectedAction?.Allow_Flow_Recursion__c ? "Yes" : "No";
  }

  get showAuditGroups() {
    return !this.nativeLoading && this.auditGroups.length > 0;
  }

  get showAuditEmpty() {
    return !this.nativeLoading && this.auditGroups.length === 0;
  }

  get auditGroups() {
    if (!this.nativeAutomations) return [];

    return CONTEXT_LABELS.map((ctx) => {
      const items = [];

      // Add Triggers
      (this.nativeAutomations.triggers || []).forEach((t) => {
        const field = ctx.field.replace("__c", "").replace("_", ""); // BeforeInsert, AfterUpdate, etc
        if (t[`Usage${field}`]) {
          const isActive = t.Status === "Active";
          const matchesType =
            this.nativeTypeFilter === "all" ||
            this.nativeTypeFilter === "trigger";
          const matchesStatus =
            this.nativeStatusFilter === "all" ||
            (this.nativeStatusFilter === "active" && isActive) ||
            (this.nativeStatusFilter === "inactive" && !isActive);

          if (matchesType && matchesStatus) {
            items.push({
              id: t.Id,
              name: t.Name,
              type: "Apex Trigger",
              icon: "utility:apex",
              status: t.Status,
              variant: t.Status === "Active" ? "success" : "lightest",
              isTrigger: true,
              isFlow: false,
              isManaged: !!t.NamespacePrefix,
              body: t.Body
            });
          }
        }
      });

      // Add Flows & Process Builders
      (this.nativeAutomations.flows || []).forEach((f) => {
        const isBefore = f.TriggerType === "RecordBeforeSave";
        const isAfter =
          f.TriggerType === "RecordAfterSave" || f.ProcessType === "Workflow";
        const triggerType = f.RecordTriggerType; // Create, Update, CreateAndUpdate, Delete

        const isInsert = !triggerType || triggerType.includes("Create");
        const isUpdate = !triggerType || triggerType.includes("Update");
        const isDelete = triggerType === "Delete";

        // Map Flow triggers to our contexts precisely
        let isRelevantContext = false;
        if (isBefore) {
          isRelevantContext =
            (isInsert && ctx.field === "Before_Insert__c") ||
            (isUpdate && ctx.field === "Before_Update__c");
        } else if (isAfter) {
          isRelevantContext =
            (isInsert && ctx.field === "After_Insert__c") ||
            (isUpdate && ctx.field === "After_Update__c") ||
            (isDelete && ctx.field === "Before_Delete__c");
        }

        if (isRelevantContext) {
          const isFlow =
            f.ProcessType === "AutoLaunchedFlow" || f.ProcessType === "Flow";
          const isManaged = f.DurableId
            ? !f.DurableId.startsWith("300")
            : false;
          const isPb = f.ProcessType === "Workflow";
          const isActive = f.IsActive;

          let matchesType = false;
          if (this.nativeTypeFilter === "all") {
            matchesType = true;
          } else if (this.nativeTypeFilter === "flow" && isFlow) {
            matchesType = true;
          } else if (this.nativeTypeFilter === "pb" && isPb) {
            matchesType = true;
          }

          const matchesStatus =
            this.nativeStatusFilter === "all" ||
            (this.nativeStatusFilter === "active" && isActive) ||
            (this.nativeStatusFilter === "inactive" && !isActive);

          if (matchesType && matchesStatus) {
            items.push({
              id: f.DurableId,
              name: f.Label,
              type: isPb ? "Process Builder" : "Flow",
              icon: isPb ? "utility:retire" : "utility:flow",
              status: f.IsActive ? "Active" : "Inactive",
              variant: f.IsActive ? "success" : "lightest",
              isTrigger: false,
              isFlow: isFlow,
              isManaged: isManaged,
              buttonTitle: isManaged
                ? "Managed Package Flow (Builder Restricted)"
                : "Open in Flow Builder"
            });
          }
        }
      });

      return {
        ...ctx,
        items,
        hasItems: items.length > 0
      };
    }).filter((group) => group.hasItems);
  }

  get typeFilterOptions() {
    return [
      { label: "All Types", value: "all" },
      { label: "Apex Triggers", value: "trigger" },
      { label: "Record-Triggered Flows", value: "flow" },
      { label: "Process Builders", value: "pb" }
    ];
  }

  get statusFilterOptions() {
    return [
      { label: "All Statuses", value: "all" },
      { label: "Active Only", value: "active" },
      { label: "Inactive Only", value: "inactive" }
    ];
  }

  handleTypeFilterChange(event) {
    this.nativeTypeFilter = event.target.value;
  }

  handleStatusFilterChange(event) {
    this.nativeStatusFilter = event.target.value;
  }

  get discoverySortOptions() {
    return [
      { label: "Object Label (A-Z)", value: "label" },
      { label: "Total Automations (High to Low)", value: "total" },
      { label: "Triggers (High to Low)", value: "triggers" },
      { label: "Flows (High to Low)", value: "flows" }
    ];
  }

  get filteredDiscoveredObjects() {
    if (!this.discoveredObjects) return [];

    let results = this.discoveredObjects.filter((obj) => {
      const term = this.discoverySearchTerm.toLowerCase();
      return (
        !term ||
        obj.objectLabel.toLowerCase().includes(term) ||
        obj.objectName.toLowerCase().includes(term)
      );
    });

    results = [...results].sort((a, b) => {
      if (this.discoverySortBy === "total") {
        const totalA = (a.triggerCount || 0) + (a.flowCount || 0);
        const totalB = (b.triggerCount || 0) + (b.flowCount || 0);
        return totalB - totalA;
      }
      if (this.discoverySortBy === "triggers") {
        return (b.triggerCount || 0) - (a.triggerCount || 0);
      }
      if (this.discoverySortBy === "flows") {
        return (b.flowCount || 0) - (a.flowCount || 0);
      }
      return a.objectLabel.localeCompare(b.objectLabel);
    });

    return results;
  }

  handleDiscoverySearch(event) {
    this.discoverySearchTerm = event.target.value;
  }

  handleDiscoverySortChange(event) {
    this.discoverySortBy = event.target.value;
  }

  // --- Event handlers ---

  handleMoveUp(event) {
    this.moveAction(event, -1);
  }

  handleMoveDown(event) {
    this.moveAction(event, 1);
  }

  // Move an action one position within its execution context. `delta` is -1
  // (up) or +1 (down). Updates the draft orders consumed by Save Order / Reset.
  moveAction(event, delta) {
    // Don't let the click bubble to the row (which opens the action details).
    event.stopPropagation();

    const actionId = event.currentTarget.dataset.actionId;
    const context = event.currentTarget.dataset.context;

    const contextActions = this.actions
      .filter((a) => a[context])
      .sort((a, b) => (a.Order__c || 0) - (b.Order__c || 0));

    const idx = contextActions.findIndex((a) => a.Id === actionId);
    const targetIdx = idx + delta;
    if (idx === -1 || targetIdx < 0 || targetIdx >= contextActions.length) {
      return;
    }

    const [moved] = contextActions.splice(idx, 1);
    contextActions.splice(targetIdx, 0, moved);

    contextActions.forEach((action, i) => {
      const newOrder = i + 1;
      if (action.Order__c !== newOrder) {
        action.Order__c = newOrder;
        this.draftOrders[action.DeveloperName] = newOrder;
      }
    });

    this.actions = [...this.actions];
  }

  async handleSaveReordering() {
    this.isLoading = true;
    try {
      await updateTriggerActionOrders({ newOrders: this.draftOrders });
      this.showSuccess(
        "Trigger Action orders deployment started. The list will refresh shortly."
      );
      this.draftOrders = {};

      // eslint-disable-next-line @lwc/lwc/no-async-operation
      setTimeout(() => {
        this.refreshList().catch(() => {});
      }, 8000);
    } catch (error) {
      this.showError(
        "Save Reordering Error",
        error.body?.message || error.message
      );
    } finally {
      this.isLoading = false;
    }
  }

  handleResetReordering() {
    this.draftOrders = {};
    if (this._wiredActionsResult && this._wiredActionsResult.data) {
      this.actions = this._wiredActionsResult.data.map((action) => ({
        ...action
      }));
    }
  }

  handleSearchChange(event) {
    this.searchTerm = event.target.value;
  }

  handleObjectClick(event) {
    const objectName = event.currentTarget.dataset.objectName;
    // No-op on re-selecting the same object (avoids a stuck loading state, since
    // the per-object wire won't re-fire when its parameter is unchanged).
    if (objectName === this.selectedObjectName) return;

    this.selectedAction = null;
    this.nativeTypeFilter = "all";
    this.nativeStatusFilter = "all";
    // Clear the previous object's native automations and show a loading state
    // until the per-object wire resolves — otherwise the prior result flashes.
    this.nativeAutomations = { triggers: [], flows: [] };
    this.nativeLoading = true;
    this.selectedObjectName = objectName;
  }

  async handleActionClick(event) {
    const actionId = event.currentTarget.dataset.actionId;
    this.isLoading = true;
    try {
      this.selectedAction = await getTriggerActionById({ actionId });
    } catch (error) {
      this.showError("Error", error.body?.message || error.message);
    } finally {
      this.isLoading = false;
    }
  }

  handleCreateNew() {
    if (!this.selectedObjectName) {
      this.showWarning("Please select an SObject first");
      return;
    }
    this.isCreating = true;
    this.selectedAction = null;
    this.showFormModal = true;
  }

  handleEdit() {
    if (!this.selectedAction) {
      this.showWarning("Please select an action to edit");
      return;
    }
    this.isCreating = false;
    this.showFormModal = true;
  }

  async handleViewTriggerActionFlow() {
    const flowName = this.selectedAction?.Flow_Name__c;
    if (!flowName) return;

    this.isLoading = true;
    try {
      const flowId = await getFlowIdByName({ flowName });
      if (flowId) {
        this.selectedFlowId = flowId;
        this.selectedFlowName = flowName;
        this.isFlowModalOpen = true;
      }
    } catch (error) {
      this.showError(
        "Error loading Flow",
        error.body?.message || error.message
      );
    } finally {
      this.isLoading = false;
    }
  }

  handleViewFlowChart(event) {
    this.selectedFlowId = event.currentTarget.dataset.id;
    this.selectedFlowName = event.currentTarget.dataset.name;
    this.isFlowModalOpen = true;
  }

  handleCloseFlowModal() {
    this.isFlowModalOpen = false;
    this.selectedFlowId = "";
    this.selectedFlowName = "";
  }

  handleViewApexFlowchart() {
    if (this.selectedAction?.Apex_Class_Name__c) {
      this.selectedApexClassName = this.selectedAction.Apex_Class_Name__c;
      this.isApexModalOpen = true;
    }
  }

  handleViewApexFlowchartFromList(event) {
    event.stopPropagation();
    const className = event.currentTarget.dataset.className;
    if (className) {
      this.selectedApexClassName = className;
      this.isApexModalOpen = true;
    }
  }

  handleCloseApexModal() {
    this.isApexModalOpen = false;
    this.selectedApexClassName = "";
    this.apexSourceCode = "";
    this.isApexTrigger = false;
    this.apexCodeError = null;
  }

  handleViewTriggerSource(event) {
    const id = event.currentTarget.dataset.id;
    const trigger = (this.nativeAutomations.triggers || []).find(
      (t) => t.Id === id
    );
    if (trigger && trigger.Body) {
      this.selectedApexClassName = trigger.Name;
      this.apexSourceCode = trigger.Body;
      this.isApexTrigger = true;
      this.isApexModalOpen = true;
    }
  }

  async handleApexTabActive(event) {
    const tabValue = event.target.value;
    if (tabValue !== "code") return;
    if (this.apexSourceCode) return;

    this.isApexCodeLoading = true;
    this.apexCodeError = null;
    try {
      const body = await getApexClassBody({
        className: this.selectedApexClassName
      });
      this.apexSourceCode = body;
    } catch (err) {
      this.apexCodeError = `Failed to retrieve class body: ${err.body?.message || err.message}`;
    } finally {
      this.isApexCodeLoading = false;
    }
  }

  handleTabChange(event) {
    this.activeTab = event.target.value;
  }

  async handleOpenDiscovery() {
    this.isLoading = true;
    try {
      this.discoveredObjects = await getDiscoveredObjects();
      this.showDiscoveryModal = true;
    } catch (error) {
      this.showError(
        "Error discovering objects",
        error.body?.message || error.message
      );
    } finally {
      this.isLoading = false;
    }
  }

  handleCloseDiscovery() {
    this.showDiscoveryModal = false;
    this.discoverySearchTerm = "";
    this.discoverySortBy = "label";
  }

  async handleInitializeObject(event) {
    const objectName = event.currentTarget.dataset.name;
    this.isLoading = true;
    try {
      await createTriggerSetting({
        objectName,
        bypassPermission: null,
        requiredPermission: null,
        objectNamespace: null
      });
      this.showSuccess(
        `Initialization of ${objectName} enqueued. This may take a few seconds.`
      );
      this.handleCloseDiscovery();
      // eslint-disable-next-line @lwc/lwc/no-async-operation
      setTimeout(() => {
        this.refreshList().catch(() => {});
      }, 8000);
    } catch (error) {
      this.showError(
        "Error initializing object",
        error.body?.message || error.message
      );
    } finally {
      this.isLoading = false;
    }
  }

  handleFormClose() {
    this.showFormModal = false;
  }

  handleSaveSuccess() {
    this.showFormModal = false;
    this.selectedAction = null;
    this.showSuccess(
      "Trigger Action deployment started. The list will refresh shortly."
    );
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    setTimeout(() => {
      this.refreshList().catch(() => {});
    }, 8000);
  }

  handleAddSObject() {
    this.showSettingFormModal = true;
  }

  handleSettingFormClose() {
    this.showSettingFormModal = false;
  }

  handleSettingSaveSuccess() {
    this.showSettingFormModal = false;
    this.showSuccess(
      "Trigger Setting deployment started. The SObject list will refresh shortly."
    );
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    setTimeout(() => {
      this.refreshList().catch(() => {});
    }, 8000);
  }

  handleRefresh() {
    this.selectedAction = null;
    this.refreshList();
  }

  refreshList() {
    this.isLoading = true;
    const promises = [];
    if (this._wiredActionsResult) {
      promises.push(refreshApex(this._wiredActionsResult));
    }
    if (this._wiredSObjectsResult) {
      promises.push(refreshApex(this._wiredSObjectsResult));
    }
    if (this._wiredNativeResult && this.selectedObjectName) {
      promises.push(refreshApex(this._wiredNativeResult));
    }
    if (promises.length === 0) {
      this.isLoading = false;
      return Promise.reject(new Error("Wire results not available"));
    }
    return Promise.all(promises)
      .then(() => {
        this.showSuccess("Data refreshed successfully.");
      })
      .catch((error) => {
        this.showError(
          "Refresh Error",
          "Failed to refresh: " + (error.body?.message || error.message)
        );
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  showSuccess(message) {
    this.dispatchEvent(
      new ShowToastEvent({ title: "Success", message, variant: "success" })
    );
  }

  showWarning(message) {
    this.dispatchEvent(
      new ShowToastEvent({ title: "Warning", message, variant: "warning" })
    );
  }

  showError(title, message) {
    this.dispatchEvent(
      new ShowToastEvent({ title, message, variant: "error" })
    );
  }

  handleAuditObjectRow(event) {
    event.stopPropagation();
    this.runObjectAudit(event.currentTarget.dataset.objectName);
  }

  handleAuditCurrentObject() {
    this.runObjectAudit(this.selectedObjectName);
  }

  /**
   * Renders the object's automation footprint as an inventory grouped by
   * automation type, plus a set of precomputed signals (contention, ordering,
   * bypasses, legacy tech) that the OBJECT prompt turns into ranked findings.
   */
  buildObjectAuditPayload(objectName, nativeData) {
    const triggers = nativeData?.triggers || [];
    const flows = nativeData?.flows || [];
    const objectActions = (this.actions || []).filter(
      (a) =>
        a.Object_API_Name__c &&
        a.Object_API_Name__c.toLowerCase() === objectName.toLowerCase()
    );

    const recordFlows = flows.filter(
      (f) => flowPhase(f) !== FLOW_PHASE.OTHER && f.ProcessType !== "Workflow"
    );
    const processBuilders = flows.filter((f) => f.ProcessType === "Workflow");
    const otherFlows = flows.filter(
      (f) => flowPhase(f) === FLOW_PHASE.OTHER && f.ProcessType !== "Workflow"
    );

    const contextsOf = (t) =>
      TRIGGER_USAGE_FIELDS.filter((u) => t[u.field]).map((u) => u.label);

    const formatAction = (a) => {
      const parts = [`- ${a.DeveloperName || "(unnamed)"}`];
      if (a.Apex_Class_Name__c) parts.push(`Apex=${a.Apex_Class_Name__c}`);
      if (a.Flow_Name__c) parts.push(`Flow=${a.Flow_Name__c}`);
      parts.push(`Order=${a.Order__c ?? "N/A"}`);
      parts.push(`Bypassed=${a.Bypass_Execution__c ? "Yes" : "No"}`);
      if (a.Entry_Criteria__c) parts.push(`Entry=${a.Entry_Criteria__c}`);
      if (a.Allow_Flow_Recursion__c) parts.push("AllowFlowRecursion=Yes");
      return parts.join(" | ");
    };

    const formatTrigger = (t) => {
      const contexts = contextsOf(t);
      return `- ${t.Name} | Status=${t.Status || "Unknown"} | Contexts=${
        contexts.length ? contexts.join(", ") : "None declared"
      }${t.NamespacePrefix ? ` | Package=${t.NamespacePrefix}` : ""}`;
    };

    const formatFlow = (f) => {
      const timing = [f.TriggerType, f.RecordTriggerType]
        .filter(Boolean)
        .join(" / ");
      return `- "${f.Label}" | API=${f.ApiName || "N/A"} | ${
        timing || f.ProcessType || "Unknown timing"
      } | ${f.IsActive ? "Active" : "Inactive"}${
        f.NamespacePrefix ? ` | Package=${f.NamespacePrefix}` : ""
      }`;
    };

    const section = (heading, lines) =>
      `${heading}\n${lines.length ? lines.join("\n") : "None"}\n\n`;

    // Three distinct populations: the framework's own dispatcher, this org's
    // other custom code, and read-only managed-package code.
    const unmanagedTriggers = triggers.filter((t) => !isManagedArtifact(t));
    const dispatcherTriggers = unmanagedTriggers.filter(isTafDispatcher);
    const customTriggers = unmanagedTriggers.filter((t) => !isTafDispatcher(t));
    const managedTriggers = triggers.filter(isManagedArtifact);
    const ownRecordFlows = recordFlows.filter((f) => !isManagedArtifact(f));
    const managedRecordFlows = recordFlows.filter(isManagedArtifact);

    const counted = (own, managed) =>
      `${own.length + managed.length}` +
      (managed.length ? ` (${own.length} own, ${managed.length} managed)` : "");

    let payload = `SObject API Name: ${objectName}\n`;
    payload += `Trigger Action Framework actions: ${objectActions.length}\n`;
    payload += `TAF dispatcher trigger present: ${
      dispatcherTriggers.length
        ? `Yes (${dispatcherTriggers.map((t) => t.Name).join(", ")})`
        : "No"
    }\n`;
    payload += `Other Apex triggers: ${counted(customTriggers, managedTriggers)}\n`;
    payload += `Record-triggered flows: ${counted(
      ownRecordFlows,
      managedRecordFlows
    )}\n`;
    payload += `Process Builders: ${processBuilders.length}\n`;
    payload += `Other flows on this object: ${otherFlows.length}\n\n`;

    payload += `=== AUTOMATION INVENTORY ===\n\n`;

    // TAF actions grouped by the context they are registered against.
    const tafLines = [];
    CONTEXT_LABELS.forEach((ctx) => {
      const inContext = objectActions
        .filter((a) => a[ctx.field])
        .sort((a, b) => (a.Order__c || 0) - (b.Order__c || 0));
      if (inContext.length) {
        tafLines.push(`[${ctx.label}]`);
        inContext.forEach((a) => tafLines.push(formatAction(a)));
      }
    });
    payload += section(
      "TRIGGER ACTION FRAMEWORK (Trigger_Action__mdt)",
      tafLines
    );
    payload += section(
      "TAF DISPATCHER TRIGGER (the framework's own entry point — this trigger " +
        "is HOW the TAF actions above execute. It is correct and expected; it " +
        "is not a competing automation and must not be migrated or merged)",
      dispatcherTriggers.map(formatTrigger)
    );
    payload += section(
      "OTHER APEX TRIGGERS (this org's own code, outside the framework)",
      customTriggers.map(formatTrigger)
    );
    payload += section(
      "RECORD-TRIGGERED FLOWS (this org's own)",
      ownRecordFlows.map(formatFlow)
    );
    payload += section(
      "PROCESS BUILDERS (retired platform feature)",
      processBuilders.map(formatFlow)
    );
    if (otherFlows.length) {
      payload += section(
        "OTHER FLOWS REFERENCING THIS OBJECT",
        otherFlows.map(formatFlow)
      );
    }
    if (managedTriggers.length || managedRecordFlows.length) {
      payload += section(
        "MANAGED PACKAGE AUTOMATION — READ-ONLY (installed from a package; " +
          "cannot be edited, reordered, deleted or migrated by this org)",
        [
          ...managedTriggers.map(formatTrigger),
          ...managedRecordFlows.map(formatFlow)
        ]
      );
    }

    payload += `=== PRECOMPUTED SIGNALS ===\n`;
    const signals = this.buildAuditSignals(
      objectActions,
      triggers,
      recordFlows,
      processBuilders
    );
    payload += signals.length
      ? signals.map((s) => `- ${s}`).join("\n") + "\n"
      : "- No structural signals detected.\n";

    return payload;
  }

  /**
   * Deterministic, factual observations about the object's automation. These
   * are inputs for the audit, not conclusions — the model decides severity.
   */
  buildAuditSignals(objectActions, triggers, recordFlows, processBuilders) {
    const signals = [];

    const dispatchers = triggers.filter(
      (t) => !isManagedArtifact(t) && isTafDispatcher(t)
    );

    // Contexts driven by more than one independent mechanism. The TAF
    // dispatcher is excluded — it is the vehicle for the TAF actions, not a
    // rival to them. Managed triggers are reported separately: they add to the
    // contention but cannot take part in any consolidation the org performs.
    CONTEXT_LABELS.forEach((ctx) => {
      const usage = TRIGGER_USAGE_FIELDS.find((u) => u.label === ctx.label);
      const tafCount = objectActions.filter((a) => a[ctx.field]).length;
      const inContext = triggers.filter((t) => t[usage.field]);
      const customCount = inContext.filter(
        (t) => !isManagedArtifact(t) && !isTafDispatcher(t)
      ).length;
      const managed = inContext.filter(isManagedArtifact);
      const mechanisms = [
        tafCount ? `${tafCount} TAF action(s)` : null,
        customCount ? `${customCount} custom Apex trigger(s) outside TAF` : null
      ].filter(Boolean);
      if (mechanisms.length > 1) {
        const suffix = managed.length
          ? `; ${managed.length} read-only managed trigger(s) also run here (${managed
              .map((t) => `${t.Name} [${t.NamespacePrefix}]`)
              .join(", ")}) and cannot be consolidated`
          : "";
        signals.push(
          `${ctx.label} is driven by multiple mechanisms this org controls: ${mechanisms.join(" and ")}${suffix}.`
        );
      } else if (managed.length && (tafCount || customCount)) {
        signals.push(
          `${ctx.label} runs both this org's automation and ${managed.length} read-only managed trigger(s) (${managed
            .map((t) => `${t.Name} [${t.NamespacePrefix}]`)
            .join(", ")}); ordering between them is fixed by the platform.`
        );
      }
    });

    // Wiring integrity: actions with no dispatcher never run at all, and a
    // dispatcher with no actions is dead weight. Both are easy to miss.
    if (objectActions.length && !dispatchers.length) {
      signals.push(
        `${objectActions.length} TAF action(s) are configured but no TAF dispatcher trigger (one calling MetadataTriggerHandler) exists on this object — none of these actions can execute.`
      );
    }
    if (dispatchers.length && !objectActions.length) {
      signals.push(
        `A TAF dispatcher trigger (${dispatchers
          .map((t) => t.Name)
          .join(
            ", "
          )}) is deployed but no Trigger_Action__mdt records target this object, so it dispatches nothing.`
      );
    }
    if (dispatchers.length > 1) {
      signals.push(
        `${dispatchers.length} TAF dispatcher triggers exist on this object (${dispatchers
          .map((t) => t.Name)
          .join(", ")}); only one is needed and the framework will run twice.`
      );
    }
    const inactiveDispatchers = dispatchers.filter(
      (t) => t.Status !== "Active"
    );
    if (inactiveDispatchers.length && objectActions.length) {
      signals.push(
        `The TAF dispatcher trigger(s) ${inactiveDispatchers
          .map((t) => t.Name)
          .join(
            ", "
          )} are INACTIVE, so none of the ${objectActions.length} configured TAF action(s) on this object currently execute.`
      );
    }

    // Duplicate Order__c inside one context leaves execution order undefined.
    CONTEXT_LABELS.forEach((ctx) => {
      const orders = objectActions
        .filter((a) => a[ctx.field])
        .map((a) => a.Order__c)
        .filter((o) => o !== null && o !== undefined);
      const dupes = [
        ...new Set(orders.filter((o, i) => orders.indexOf(o) !== i))
      ];
      if (dupes.length) {
        signals.push(
          `${ctx.label} has TAF actions sharing Order value(s) ${dupes.join(", ")} — relative execution order is not deterministic.`
        );
      }
    });

    const bypassed = objectActions.filter((a) => a.Bypass_Execution__c);
    if (bypassed.length) {
      signals.push(
        `${bypassed.length} TAF action(s) are bypassed and never execute: ${bypassed
          .map((a) => a.DeveloperName)
          .join(", ")}.`
      );
    }

    const recursive = objectActions.filter((a) => a.Allow_Flow_Recursion__c);
    if (recursive.length) {
      signals.push(
        `Flow recursion is explicitly allowed on: ${recursive
          .map((a) => a.DeveloperName)
          .join(", ")}.`
      );
    }

    const noCriteria = objectActions.filter((a) => !a.Entry_Criteria__c);
    if (noCriteria.length) {
      signals.push(
        `${noCriteria.length} of ${objectActions.length} TAF action(s) have no entry criteria and run on every qualifying record.`
      );
    }

    // Only this org's own inactive artifacts are actionable; managed ones
    // cannot be removed, so flagging them would produce an impossible fix.
    // Inactive dispatchers are reported above as a wiring failure, not clutter.
    const inactiveTriggers = triggers.filter(
      (t) =>
        t.Status !== "Active" && !isManagedArtifact(t) && !isTafDispatcher(t)
    );
    if (inactiveTriggers.length) {
      signals.push(
        `Inactive Apex trigger(s) still deployed: ${inactiveTriggers
          .map((t) => t.Name)
          .join(", ")}.`
      );
    }

    const inactiveFlows = recordFlows.filter(
      (f) => !f.IsActive && !isManagedArtifact(f)
    );
    if (inactiveFlows.length) {
      signals.push(
        `Inactive record-triggered flow(s): ${inactiveFlows
          .map((f) => f.Label)
          .join(", ")}.`
      );
    }

    const ownProcessBuilders = processBuilders.filter(
      (f) => !isManagedArtifact(f)
    );
    if (ownProcessBuilders.length) {
      signals.push(
        `${ownProcessBuilders.length} Process Builder(s) remain on this object; Process Builder is a retired platform feature.`
      );
    }

    // Ordering is only actionable among the flows this org can actually change.
    const afterSaveFlows = recordFlows.filter(
      (f) => flowPhase(f) === FLOW_PHASE.AFTER_SAVE && f.IsActive
    );
    const ownAfterSave = afterSaveFlows.filter((f) => !isManagedArtifact(f));
    if (ownAfterSave.length > 1) {
      const managedCount = afterSaveFlows.length - ownAfterSave.length;
      signals.push(
        `${ownAfterSave.length} active after-save flows this org owns run in an unspecified order relative to each other` +
          (managedCount
            ? `, alongside ${managedCount} read-only managed after-save flow(s)`
            : "") +
          `.`
      );
    }

    const managedTotal = [
      ...triggers,
      ...recordFlows,
      ...processBuilders
    ].filter(isManagedArtifact).length;
    if (managedTotal) {
      signals.push(
        `${managedTotal} of the automations above come from managed packages and are read-only: they can be worked around (ordering, bypasses, entry criteria) but never edited, merged or deleted.`
      );
    }

    return signals;
  }

  handleCloseAiObjectAssistant() {
    this.isAiObjectAssistantOpen = false;
  }

  /**
   * The object audit. Builds the inventory and computed signals, then reads the
   * definition of every artifact it can — each flow rendered to Mermaid, plus
   * the Apex this org is allowed to see — and sends the lot as a single prompt
   * so the model can reason across artifacts.
   *
   * When no definitions are readable (Tooling API unavailable, or an org of
   * entirely managed automation) this degrades to a signature-level audit and
   * says so, rather than failing.
   */
  async runObjectAudit(objectName) {
    if (!objectName) return;

    this.isLoading = true;
    this.auditProgress = "Collecting automation inventory...";

    try {
      const nativeData =
        objectName === this.selectedObjectName && this.nativeAutomations
          ? this.nativeAutomations
          : await getNativeAutomations({ objectName });

      const base = this.buildObjectAuditPayload(objectName, nativeData);
      const [flowSource, apexSource] = await Promise.all([
        this.loadFlowSource(nativeData?.flows || []),
        this.loadApexSource(objectName, nativeData?.triggers || [])
      ]);

      this.auditProgress = "Sending to Agentforce Coworker...";
      this.objectAuditName = objectName;
      this.objectAuditVerifiedFindings = flowSource.verifiedFindings;
      this.objectAuditPayload = `${base}\n${apexSource.text}\n${flowSource.text}`;
      // Only claim the model can see definitions when it actually can — the
      // deep prompt's instructions are wrong otherwise.
      this.objectAuditType =
        flowSource.readAny || apexSource.readAny ? "OBJECT_DEEP" : "OBJECT";
      this.isAiObjectAssistantOpen = true;
    } catch (err) {
      this.showError(
        "Audit Error",
        err.body?.message || err.message || String(err)
      );
    } finally {
      this.isLoading = false;
      this.auditProgress = "";
    }
  }

  /**
   * Fetches each flow's definition and renders it to Mermaid, which runs about
   * six times smaller than the raw metadata JSON and is far easier for a model
   * to reason over. Flows that cannot be read (managed packages) are reported
   * as such rather than silently dropped.
   */
  async loadFlowSource(flows) {
    if (!flows.length) {
      return {
        text: "=== FLOW DEFINITIONS ===\nNo flows on this object.\n",
        verifiedFindings: "",
        readAny: false
      };
    }

    // Reading definitions needs a session and a Tooling API round trip, which
    // some org configurations block. That must degrade the audit, not end it.
    let sessionId;
    let orgDomainUrl;
    try {
      [sessionId, orgDomainUrl] = await Promise.all([
        getSessionId(),
        getOrgDomainUrl()
      ]);
    } catch (e) {
      return {
        text:
          "=== FLOW DEFINITIONS ===\n" +
          `Flow definitions could not be read in this session (${e.body?.message || e.message || e}). ` +
          "This audit is based on automation signatures only: you can see what runs and when, " +
          "but not what any flow does internally. Do not speculate about flow contents.\n",
        verifiedFindings: "",
        readAny: false
      };
    }

    const rendered = [];
    const unreadable = [];
    const writesByFlow = [];
    let done = 0;

    const worker = async (queue) => {
      for (;;) {
        const flow = queue.shift();
        if (!flow) return;
        this.auditProgress = `Reading flow definitions (${++done} of ${flows.length})...`;
        try {
          // Sequential *within* a worker on purpose — concurrency comes from
          // running DEEP_AUDIT_CONCURRENCY workers over the shared queue.
          // eslint-disable-next-line no-await-in-loop
          const metadata = await this.queryFlowMetadata(
            flow.DurableId,
            sessionId,
            orgDomainUrl
          );
          if (!metadata) {
            unreadable.push(`- "${flow.Label}" (no readable version)`);
            continue;
          }
          writesByFlow.push({
            label: flow.Label,
            isActive: !!flow.IsActive,
            writes: extractFlowFieldWrites(metadata)
          });
          let mermaid = convertFlowToMermaid(metadata, flow.Label, false);
          if (mermaid.length > MAX_MERMAID_CHARS_PER_FLOW) {
            mermaid =
              mermaid.slice(0, MAX_MERMAID_CHARS_PER_FLOW) +
              "\n... [diagram truncated]";
          }
          rendered.push(
            `--- FLOW: "${flow.Label}" (${flow.ApiName || "N/A"}) | ${
              [flow.TriggerType, flow.RecordTriggerType]
                .filter(Boolean)
                .join(" / ") || "Unknown timing"
            } | ${flow.IsActive ? "Active" : "Inactive"} ---\n${mermaid}`
          );
        } catch (e) {
          unreadable.push(`- "${flow.Label}" (${e.message || "read failed"})`);
        }
      }
    };

    const queue = [...flows];
    await Promise.all(
      Array.from({ length: DEEP_AUDIT_CONCURRENCY }, () => worker(queue))
    );

    const contention = buildFieldWriteMap(writesByFlow);
    let out = contention.note;
    out +=
      "\n=== FLOW DEFINITIONS (each flow rendered as a Mermaid flowchart) ===\n\n";
    out += rendered.length ? rendered.join("\n\n") + "\n" : "None readable.\n";
    if (unreadable.length) {
      out += `\nFLOWS WHOSE DEFINITION COULD NOT BE READ (treat as opaque; do not guess at their contents):\n${unreadable.join("\n")}\n`;
    }
    return {
      text: out,
      verifiedFindings: contention.findings,
      readAny: rendered.length > 0
    };
  }

  async queryFlowMetadata(definitionId, sessionId, orgDomainUrl) {
    if (!SFDC_ID_PATTERN.test(definitionId || "")) return null;

    // Prefer the active version; fall back to the latest draft/obsolete one.
    for (const activeOnly of [true, false]) {
      let query = `SELECT Id, Metadata FROM Flow WHERE DefinitionId = '${definitionId}'`;
      query += activeOnly
        ? " AND Status = 'Active'"
        : " ORDER BY VersionNumber DESC LIMIT 1";

      // The second pass only runs when the first finds no active version, so
      // these awaits are deliberately sequential rather than parallel.
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(
        `${orgDomainUrl}/services/data/${TOOLING_API_VERSION}/tooling/query?q=${encodeURIComponent(query)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sessionId}`,
            "Content-Type": "application/json"
          }
        }
      );
      if (!response.ok) {
        throw new Error(`Tooling API returned ${response.status}`);
      }
      // eslint-disable-next-line no-await-in-loop
      const data = await response.json();
      if (data.records?.length && data.records[0].Metadata) {
        return data.records[0].Metadata;
      }
    }
    return null;
  }

  /**
   * Apex the org can actually read: unmanaged trigger bodies (already loaded
   * with the inventory) plus the classes behind this object's TAF actions,
   * pulled in a single call.
   */
  async loadApexSource(objectName, triggers) {
    const sections = [];

    const readableTriggers = triggers.filter(
      (t) => t.Body && t.Body !== "(hidden)"
    );
    readableTriggers.forEach((t) => {
      sections.push(`--- APEX TRIGGER: ${t.Name} ---\n${t.Body}`);
    });

    const classNames = [
      ...new Set(
        (this.actions || [])
          .filter(
            (a) =>
              a.Object_API_Name__c &&
              a.Object_API_Name__c.toLowerCase() === objectName.toLowerCase() &&
              a.Apex_Class_Name__c
          )
          .map((a) => a.Apex_Class_Name__c)
      )
    ];

    if (classNames.length) {
      this.auditProgress = "Reading Apex source...";
      try {
        const bodies = await getApexClassBodies({ classNames });
        Object.keys(bodies || {}).forEach((name) => {
          const body = bodies[name];
          sections.push(
            `--- TAF ACTION CLASS: ${name} ---\n${
              body.length > MAX_APEX_CHARS_PER_CLASS
                ? body.slice(0, MAX_APEX_CHARS_PER_CLASS) +
                  "\n// ... [source truncated]"
                : body
            }`
          );
        });
      } catch (e) {
        sections.push(
          `(Apex class source unavailable: ${e.body?.message || e.message})`
        );
      }
    }

    const hiddenCount = triggers.length - readableTriggers.length;
    let out = "=== APEX SOURCE ===\n\n";
    out += sections.length ? sections.join("\n\n") + "\n" : "None readable.\n";
    if (hiddenCount) {
      out += `\n${hiddenCount} Apex trigger(s) belong to managed packages; the platform returns their source as "(hidden)". Their internal logic is unknowable — never speculate about it.\n`;
    }
    return { text: out, readAny: sections.length > 0 };
  }
}
