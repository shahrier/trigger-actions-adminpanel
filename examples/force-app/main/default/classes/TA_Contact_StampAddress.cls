/**
 * @description Stamps the MailingAddress from the parent Account's BillingAddress
 * when a Contact is created or when its Account changes.
 */
public with sharing class TA_Contact_StampAddress
	implements TriggerAction.BeforeInsert, TriggerAction.BeforeUpdate
{
	public void beforeInsert(List<SObject> triggerNew) {
		stampAddress((List<Contact>) triggerNew);
	}

	public void beforeUpdate(
		List<SObject> triggerNew,
		List<SObject> triggerOld
	) {
		List<Contact> changed = new List<Contact>();
		Map<Id, Contact> oldMap = new Map<Id, Contact>(
			(List<Contact>) triggerOld
		);
		for (Contact c : (List<Contact>) triggerNew) {
			if (c.AccountId != oldMap.get(c.Id).AccountId) {
				changed.add(c);
			}
		}
		if (!changed.isEmpty()) {
			stampAddress(changed);
		}
	}

	private void stampAddress(List<Contact> contacts) {
		Set<Id> accountIds = new Set<Id>();
		for (Contact c : contacts) {
			if (c.AccountId != null) {
				accountIds.add(c.AccountId);
			}
		}
		if (accountIds.isEmpty()) {
			return;
		}

		Map<Id, Account> accounts = new Map<Id, Account>(
			[
				SELECT Id, BillingStreet, BillingCity, BillingState, BillingPostalCode
				FROM Account
				WHERE Id IN :accountIds
			]
		);

		for (Contact c : contacts) {
			Account acc = accounts.get(c.AccountId);
			if (acc != null) {
				c.MailingStreet = acc.BillingStreet;
				c.MailingCity = acc.BillingCity;
				c.MailingState = acc.BillingState;
				c.MailingPostalCode = acc.BillingPostalCode;
			}
		}
	}
}