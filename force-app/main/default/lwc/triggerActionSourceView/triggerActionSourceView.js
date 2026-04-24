import { LightningElement, api, wire } from 'lwc';
import getApexClassBody from '@salesforce/apex/TriggerActionService.getApexClassBody';

export default class TriggerActionSourceView extends LightningElement {
	@api className;
	@api showModal = false;
	
	classBody;
	isLoading = false;
	error;

	@wire(getApexClassBody, { className: '$className' })
	wiredClassBody({ error, data }) {
		this.isLoading = true;
		if (data) {
			this.classBody = data;
			this.error = undefined;
			this.isLoading = false;
		} else if (error) {
			this.error = error.body?.message || error.message;
			this.classBody = undefined;
			this.isLoading = false;
		}
	}

	handleClose() {
		this.dispatchEvent(new CustomEvent('close'));
	}
}
