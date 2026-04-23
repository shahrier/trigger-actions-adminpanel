import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getAllTriggerActions from '@salesforce/apex/TriggerActionService.getAllTriggerActions';
import getTriggerActionById from '@salesforce/apex/TriggerActionService.getTriggerActionById';
import getAvailableSObjects from '@salesforce/apex/TriggerActionService.getAvailableSObjects';

const CONTEXT_LABELS = [
	{ field: 'Before_Insert__c', label: 'Before Insert' },
	{ field: 'After_Insert__c', label: 'After Insert' },
	{ field: 'Before_Update__c', label: 'Before Update' },
	{ field: 'After_Update__c', label: 'After Update' },
	{ field: 'Before_Delete__c', label: 'Before Delete' },
	{ field: 'After_Delete__c', label: 'After Delete' },
	{ field: 'After_Undelete__c', label: 'After Undelete' }
];

export default class TriggerActionsManager extends LightningElement {
	@api title;
	actions = [];
	selectedAction = null;
	selectedObjectName = '';
	isLoading = false;
	showFormModal = false;
	showSettingFormModal = false;
	isCreating = false;
	availableSObjects = [];
	_wiredActionsResult;
	_wiredSObjectsResult;

	@wire(getAllTriggerActions)
	wiredActions(result) {
		this._wiredActionsResult = result;
		if (result.data) {
			this.actions = result.data;
		} else if (result.error) {
			this.showError('Error loading trigger actions', result.error.body.message);
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
		const actionCounts = {};
		this.actions.forEach(action => {
			const obj = action.Object_API_Name__c;
			actionCounts[obj] = (actionCounts[obj] || 0) + 1;
		});

		return this.availableSObjects.map(obj => ({
			name: obj.name,
			actionCount: actionCounts[obj.name] || 0,
			cssClass: 'object-item' + (this.selectedObjectName === obj.name ? ' selected' : '')
		}));
	}

	get objectActions() {
		if (!this.selectedObjectName) return [];

		const filtered = this.actions
			.filter(a => a.Object_API_Name__c === this.selectedObjectName);

		const sections = [];
		for (const ctx of CONTEXT_LABELS) {
			const contextActions = filtered
				.filter(a => a[ctx.field])
				.sort((a, b) => (a.Order__c || 0) - (b.Order__c || 0))
				.map(action => ({
					...action,
					compositeId: `${ctx.field}-${action.Id}`,
					cssClass: 'action-item' + (this.selectedAction && this.selectedAction.Id === action.Id ? ' selected' : '')
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
		return CONTEXT_LABELS
			.filter(ctx => this.selectedAction[ctx.field])
			.map(ctx => ({ label: ctx.label, key: ctx.field }));
	}

	get bypassIcon() {
		return this.selectedAction?.Bypass_Execution__c
			? 'utility:warning' : 'utility:success';
	}

	get bypassLabel() {
		return this.selectedAction?.Bypass_Execution__c ? 'Yes' : 'No';
	}

	get flowRecursionIcon() {
		return this.selectedAction?.Allow_Flow_Recursion__c
			? 'utility:warning' : 'utility:success';
	}

	get flowRecursionLabel() {
		return this.selectedAction?.Allow_Flow_Recursion__c ? 'Yes' : 'No';
	}

	// --- Event handlers ---

	handleObjectClick(event) {
		const objectName = event.currentTarget.dataset.objectName;
		this.selectedObjectName = objectName;
		this.selectedAction = null;
	}

	async handleActionClick(event) {
		const actionId = event.currentTarget.dataset.actionId;
		this.isLoading = true;
		try {
			this.selectedAction = await getTriggerActionById({ actionId });
		} catch (error) {
			this.showError('Error', error.body?.message || error.message);
		} finally {
			this.isLoading = false;
		}
	}

	handleCreateNew() {
		if (!this.selectedObjectName) {
			this.showWarning('Please select an SObject first');
			return;
		}
		this.isCreating = true;
		this.selectedAction = null;
		this.showFormModal = true;
	}

	handleEdit() {
		if (!this.selectedAction) {
			this.showWarning('Please select an action to edit');
			return;
		}
		this.isCreating = false;
		this.showFormModal = true;
	}

	handleFormClose() {
		this.showFormModal = false;
	}

	handleSaveSuccess() {
		this.showFormModal = false;
		this.selectedAction = null;
		this.showSuccess('Trigger Action deployment started. The list will refresh shortly.');
		setTimeout(() => {
			this.refreshList().catch(() => { });
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
		this.showSuccess('Trigger Setting deployment started. The SObject list will refresh shortly.');
		setTimeout(() => {
			this.refreshList().catch(() => { });
		}, 8000);
	}

	handleRefresh() {
		this.selectedAction = null;
		this.refreshList();
	}

	refreshList() {
		const promises = [];
		if (this._wiredActionsResult) {
			promises.push(refreshApex(this._wiredActionsResult));
		}
		if (this._wiredSObjectsResult) {
			promises.push(refreshApex(this._wiredSObjectsResult));
		}
		if (promises.length === 0) {
			return Promise.reject(new Error('Wire results not available'));
		}
		return Promise.all(promises)
			.then(() => {
				this.showSuccess('Data refreshed successfully.');
			})
			.catch(error => {
				this.showError('Refresh Error', 'Failed to refresh: ' + error.message);
			});
	}

	showSuccess(message) {
		this.dispatchEvent(new ShowToastEvent({ title: 'Success', message, variant: 'success' }));
	}

	showWarning(message) {
		this.dispatchEvent(new ShowToastEvent({ title: 'Warning', message, variant: 'warning' }));
	}

	showError(title, message) {
		this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'error' }));
	}
}
