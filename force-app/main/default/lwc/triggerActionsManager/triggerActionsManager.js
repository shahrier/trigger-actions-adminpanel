import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getAllTriggerActions from '@salesforce/apex/TriggerActionService.getAllTriggerActions';
import getTriggerActionById from '@salesforce/apex/TriggerActionService.getTriggerActionById';
import getAvailableSObjects from '@salesforce/apex/TriggerActionService.getAvailableSObjects';

const CONTEXT_LABELS = [
	{ field: 'Before_Insert__c', label: 'Before Insert', short: 'BI' },
	{ field: 'After_Insert__c', label: 'After Insert', short: 'AI' },
	{ field: 'Before_Update__c', label: 'Before Update', short: 'BU' },
	{ field: 'After_Update__c', label: 'After Update', short: 'AU' },
	{ field: 'Before_Delete__c', label: 'Before Delete', short: 'BD' },
	{ field: 'After_Delete__c', label: 'After Delete', short: 'AD' },
	{ field: 'After_Undelete__c', label: 'After Undelete', short: 'AUD' }
];

const DATATABLE_COLUMNS = [
	{ label: 'Name', fieldName: 'DeveloperName', sortable: true },
	{ label: 'Order', fieldName: 'Order__c', type: 'number', sortable: true, initialWidth: 80, cellAttributes: { alignment: 'left' } },
	{ label: 'Contexts', fieldName: 'contextString', sortable: true },
	{ label: 'Class', fieldName: 'Apex_Class_Name__c', sortable: true },
	{ 
		label: 'Bypass', 
		fieldName: 'Bypass_Execution__c', 
		type: 'boolean', 
		sortable: true, 
		initialWidth: 80,
		cellAttributes: { iconName: { fieldName: 'bypassIcon' }, iconPosition: 'left' }
	}
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

	@track sortBy = 'Order__c';
	@track sortDirection = 'asc';
	columns = DATATABLE_COLUMNS;

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

	get flattenedActions() {
		if (!this.selectedObjectName) return [];

		const filtered = this.actions
			.filter(a => a.Object_API_Name__c === this.selectedObjectName)
			.map(action => {
				const activeContexts = CONTEXT_LABELS
					.filter(c => action[c.field])
					.map(c => c.short);
				
				return {
					...action,
					contextString: activeContexts.join(', '),
					bypassIcon: action.Bypass_Execution__c ? 'utility:warning' : ''
				};
			});
		
		return this.sortData(filtered, this.sortBy, this.sortDirection);
	}

	get hasObjectActions() {
		return this.flattenedActions.length > 0;
	}

	get selectedRows() {
		return this.selectedAction ? [this.selectedAction.Id] : [];
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

	handleRowSelection(event) {
		const selectedRows = event.detail.selectedRows;
		if (selectedRows.length > 0) {
			this.loadActionDetails(selectedRows[0].Id);
		} else {
			this.selectedAction = null;
		}
	}

	async loadActionDetails(actionId) {
		this.isLoading = true;
		try {
			this.selectedAction = await getTriggerActionById({ actionId });
		} catch (error) {
			this.showError('Error', error.body?.message || error.message);
		} finally {
			this.isLoading = false;
		}
	}

	handleSort(event) {
		this.sortBy = event.detail.fieldName;
		this.sortDirection = event.detail.sortDirection;
	}

	sortData(data, fieldname, direction) {
		const parseData = [...data];
		const keyValue = (a) => a[fieldname];
		const isReverse = direction === 'asc' ? 1 : -1;

		parseData.sort((x, y) => {
			x = keyValue(x) ? keyValue(x) : '';
			y = keyValue(y) ? keyValue(y) : '';
			return isReverse * ((x > y) - (y > x));
		});
		return parseData;
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
