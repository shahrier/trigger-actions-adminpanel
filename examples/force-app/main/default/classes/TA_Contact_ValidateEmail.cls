/**
 * @description Validates that every Contact has an email address.
 * Runs on insert and update to enforce the rule at all times.
 */
public with sharing class TA_Contact_ValidateEmail
	implements TriggerAction.BeforeInsert, TriggerAction.BeforeUpdate
{
	public void beforeInsert(List<SObject> triggerNew) {
		validate((List<Contact>) triggerNew);
	}

	public void beforeUpdate(
		List<SObject> triggerNew,
		List<SObject> triggerOld
	) {
		validate((List<Contact>) triggerNew);
	}

	private void validate(List<Contact> contacts) {
		for (Contact c : contacts) {
			if (String.isBlank(c.Email)) {
				c.Email.addError('Email is required for all Contacts.');
			}
		}
	}
}