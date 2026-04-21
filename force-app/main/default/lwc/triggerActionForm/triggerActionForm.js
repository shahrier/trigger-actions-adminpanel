import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createTriggerAction from '@salesforce/apex/TriggerActionService.createTriggerAction';
import updateTriggerAction from '@salesforce/apex/TriggerActionService.updateTriggerAction';
import getAvailableApexClasses from '@salesforce/apex/TriggerActionService.getAvailableApexClasses';
import getImplementedContexts from '@salesforce/apex/TriggerActionService.getImplementedContexts';

export default class TriggerActionForm extends LightningElement {
	@api action;
	@api isCreating = false;
	@api availableSObjects = [];

	formData = {};
	isLoading = false;
	apexClassOptions = [];
	selectedContexts = {};

	async connectedCallback() {
		try {
			this.apexClassOptions = await getAvailableApexClasses();
		} catch (error) {
			this.showError('Error', 'Failed to load options: ' + error.message);
		}

		if (this.isCreating) {
			this.formData = {
				objectName: '',
				devName: '',
				apexClassName: '',
				flowName: '',
				order: 1,
				entryCriteria: '',
				description: '',
				bypassExecution: false,
				allowFlowRecursion: false
			};
			this.selectedContexts = this.initializeContexts();
		} else if (this.action) {
			this.formData = {
				objectName: this.action.Object_API_Name__c || '',
				devName: this.action.DeveloperName || '',
				apexClassName: this.action.Apex_Class_Name__c || '',
				flowName: this.action.Flow_Name__c || '',
				order: this.action.Order__c || 1,
				entryCriteria: this.action.Entry_Criteria__c || '',
				description: this.action.Description__c || '',
				bypassExecution: this.action.Bypass_Execution__c || false,
				allowFlowRecursion: this.action.Allow_Flow_Recursion__c || false
			};
			this.selectedContexts = {
				Before_Insert__c: !!this.action.Before_Insert__c,
				After_Insert__c: !!this.action.After_Insert__c,
				Before_Update__c: !!this.action.Before_Update__c,
				After_Update__c: !!this.action.After_Update__c,
				Before_Delete__c: !!this.action.Before_Delete__c,
				After_Delete__c: !!this.action.After_Delete__c,
				After_Undelete__c: !!this.action.After_Undelete__c
			};
		}
	}

	initializeContexts() {
		return {
			Before_Insert__c: false,
			After_Insert__c: false,
			Before_Update__c: false,
			After_Update__c: false,
			Before_Delete__c: false,
			After_Delete__c: false,
			After_Undelete__c: false
		};
	}

	get formTitle() {
		return this.isCreating ? 'Create Trigger Action' : 'Edit Trigger Action';
	}

	get devNameDisabled() {
		return !this.isCreating;
	}

	get sObjectOptions() {
		return this.availableSObjects.map(obj => ({
			label: obj.label,
			value: obj.name
		}));
	}

	get detectedContextLabels() {
		const labelMap = {
			'Before_Insert__c': 'Before Insert',
			'After_Insert__c': 'After Insert',
			'Before_Update__c': 'Before Update',
			'After_Update__c': 'After Update',
			'Before_Delete__c': 'Before Delete',
			'After_Delete__c': 'After Delete',
			'After_Undelete__c': 'After Undelete'
		};
		return Object.keys(this.selectedContexts)
			.filter(key => this.selectedContexts[key])
			.map(key => labelMap[key] || key);
	}

	get hasDetectedContexts() {
		return this.detectedContextLabels.length > 0;
	}

	handleInputChange(event) {
		const field = event.target.dataset.field;
		// Handle both lightning-combobox (event.detail.value) and lightning-input (event.target.value)
		const value = event.detail !== undefined ? event.detail.value : event.target.value;
		this.formData = { ...this.formData, [field]: value };
	}

	handleNumberChange(event) {
		const field = event.target.dataset.field;
		this.formData = { ...this.formData, [field]: event.target.value ? parseInt(event.target.value, 10) : null };
	}

	handleCheckboxChange(event) {
		const field = event.target.dataset.field;
		this.formData = { ...this.formData, [field]: event.target.checked };
	}

	async handleApexClassChange(event) {
		const className = event.detail.value;
		this.formData = { ...this.formData, apexClassName: className };

		if (className) {
			try {
				this.isLoading = true;
				const result = await getImplementedContexts({ apexClassName: className });
				this.selectedContexts = JSON.parse(result);
				this.showInfo('Success', `Auto-detected contexts for ${className}`);
			} catch (error) {
				this.showError('Error', 'Failed to detect contexts: ' + error.body?.message || error.message);
				// Don't override contexts on error, let user set manually
			} finally {
				this.isLoading = false;
			}
		}
	}

	async handleSave() {
		// Validation
		if (!this.formData.objectName) {
			this.showError('Validation Error', 'SObject Name is required');
			return;
		}
		if (!this.formData.devName) {
			this.showError('Validation Error', 'Developer Name is required');
			return;
		}
		if (!this.formData.apexClassName) {
			this.showError('Validation Error', 'Apex Class Name is required');
			return;
		}
		if (!this.formData.description) {
			this.showError('Validation Error', 'Description is required');
			return;
		}
		if (this.formData.order < 1) {
			this.showError('Validation Error', 'Order must be a positive number');
			return;
		}

		// Check if at least one context was detected from the class
		const hasContext = Object.values(this.selectedContexts).some(val => val);
		if (!hasContext) {
			this.showError('Validation Error', 'The selected Apex class must implement at least one TriggerAction interface');
			return;
		}

		this.isLoading = true;
		try {
			if (this.isCreating) {
				await createTriggerAction({
					objectName: this.formData.objectName,
					devName: this.formData.devName,
					apexClassName: this.formData.apexClassName,
					flowName: this.formData.flowName || null,
					order: this.formData.order,
					contexts: this.selectedContexts,
					entryCriteria: this.formData.entryCriteria || null,
					description: this.formData.description || null
				});
			} else {
				await updateTriggerAction({
					devName: this.formData.devName,
					apexClassName: this.formData.apexClassName,
					flowName: this.formData.flowName || null,
					order: this.formData.order,
					contexts: this.selectedContexts,
					entryCriteria: this.formData.entryCriteria || null,
					description: this.formData.description || null,
					bypassExecution: this.formData.bypassExecution || false,
					allowFlowRecursion: this.formData.allowFlowRecursion || false
				});
			}
			this.dispatchEvent(new CustomEvent('savesuccess'));
		} catch (error) {
			this.showError('Save Error', error.body?.message || error.message);
		} finally {
			this.isLoading = false;
		}
	}

	handleCancel() {
		this.dispatchEvent(new CustomEvent('close'));
	}

	showError(title, message) {
		this.dispatchEvent(
			new ShowToastEvent({
				title: title,
				message: message,
				variant: 'error'
			})
		);
	}

	showInfo(title, message) {
		this.dispatchEvent(
			new ShowToastEvent({
				title: title,
				message: message,
				variant: 'info'
			})
		);
	}
}