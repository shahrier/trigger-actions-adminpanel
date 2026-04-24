/**
 * @description Prevents deletion of Accounts that have related Opportunities.
 * Adds a user-friendly error when deletion is attempted.
 */
public with sharing class TA_Account_PreventDelete
	implements TriggerAction.BeforeDelete
{
	public void beforeDelete(List<SObject> triggerOld) {
		Set<Id> accountIds = new Set<Id>();
		for (Account acc : (List<Account>) triggerOld) {
			accountIds.add(acc.Id);
		}

		Map<Id, Account> accountsWithOpps = new Map<Id, Account>([
			SELECT Id
			FROM Account
			WHERE
				Id IN :accountIds
				AND Id IN (SELECT AccountId FROM Opportunity)
		]);

		for (Account acc : (List<Account>) triggerOld) {
			if (accountsWithOpps.containsKey(acc.Id)) {
				acc.addError(
					'Cannot delete an Account that has related Opportunities.'
				);
			}
		}
	}
}