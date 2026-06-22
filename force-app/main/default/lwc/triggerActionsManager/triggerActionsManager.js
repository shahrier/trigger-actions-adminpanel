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
import getGlobalStats from "@salesforce/apex/TriggerActionService.getGlobalStats";
import updateTriggerActionOrders from "@salesforce/apex/TriggerActionService.updateTriggerActionOrders";
import getApexClassBody from "@salesforce/apex/TriggerActionService.getApexClassBody";

const CONTEXT_LABELS = [
  { field: "Before_Insert__c", label: "Before Insert" },
  { field: "After_Insert__c", label: "After Insert" },
  { field: "Before_Update__c", label: "Before Update" },
  { field: "After_Update__c", label: "After Update" },
  { field: "Before_Delete__c", label: "Before Delete" },
  { field: "After_Delete__c", label: "After Delete" },
  { field: "After_Undelete__c", label: "After Undelete" }
];

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
  globalStats = {};
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
  _wiredActionsResult;
  _wiredSObjectsResult;
  _wiredNativeResult;
  _wiredStatsResult;

  draftOrders = {};

  get hasDraftChanges() {
    return Object.keys(this.draftOrders).length > 0;
  }

  get managedObjectCount() {
    return this.globalStats?.managedObjectCount || 0;
  }

  get activeActionCount() {
    return this.globalStats?.activeActionCount || 0;
  }

  get unmanagedObjectCount() {
    return this.globalStats?.unmanagedObjectCount || 0;
  }

  @wire(getGlobalStats)
  wiredStats(result) {
    this._wiredStatsResult = result;
    if (result.data) {
      this.globalStats = result.data;
    }
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
    if (this._wiredStatsResult) {
      promises.push(refreshApex(this._wiredStatsResult));
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
}
