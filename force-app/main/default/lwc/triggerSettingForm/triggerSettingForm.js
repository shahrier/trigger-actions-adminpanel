import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAllOrgSObjects from '@salesforce/apex/TriggerActionService.getAllOrgSObjects';
import createTriggerSetting from '@salesforce/apex/TriggerActionService.createTriggerSetting';

export default class TriggerSettingForm extends LightningElement {
	isLoading = false;
	objectName = '';
	bypassPermission = '';
	requiredPermission = '';
	objectOptions = [];

	@wire(getAllOrgSObjects)
	wiredSObjects({ error, data }) {
		if (data) {
			this.objectOptions = data;
		} else if (error) {
			this.showError('Error loading org SObjects', error.body?.message || error.message);
		}
	}

	handleChange(event) {
		const field = event.target.name;
		if (field === 'objectName') {
			this.objectName = event.target.value;
		} else if (field === 'bypassPermission') {
			this.bypassPermission = event.target.value;
		} else if (field === 'requiredPermission') {
			this.requiredPermission = event.target.value;
		}
	}

	handleCancel() {
		this.dispatchEvent(new CustomEvent('close'));
	}

	async handleSave() {
		const allValid = [...this.template.querySelectorAll('lightning-combobox', 'lightning-input')]
			.reduce((validSoFar, inputCmp) => {
				inputCmp.reportValidity();
				return validSoFar && inputCmp.checkValidity();
			}, true);

		if (!allValid) {
			return;
		}

		this.isLoading = true;
		try {
			await createTriggerSetting({
				objectName: this.objectName,
				bypassPermission: this.bypassPermission,
				requiredPermission: this.requiredPermission
			});
			this.dispatchEvent(new CustomEvent('savesuccess'));
		} catch (error) {
			this.showError('Save Error', error.body?.message || error.message);
			this.isLoading = false;
		}
	}

	showError(title, message) {
		this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'error' }));
	}
}
