/**
 * @description Updates the parent Account's Description with a summary
 * when an Opportunity is closed-won.
 */
public with sharing class TA_Opportunity_UpdateAccount
	implements TriggerAction.AfterUpdate
{
	public void afterUpdate(
		List<SObject> triggerNew,
		List<SObject> triggerOld
	) {
		Map<Id, Opportunity> oldMap = new Map<Id, Opportunity>(
			(List<Opportunity>) triggerOld
		);
		List<Account> accountsToUpdate = new List<Account>();

		for (Opportunity opp : (List<Opportunity>) triggerNew) {
			Opportunity oldOpp = oldMap.get(opp.Id);
			if (
				opp.StageName == 'Closed Won' &&
				oldOpp.StageName != 'Closed Won' &&
				opp.AccountId != null
			) {
				accountsToUpdate.add(
					new Account(
						Id = opp.AccountId,
						Description = 'Last won deal: ' +
							opp.Name +
							' (' +
							opp.Amount +
							')'
					)
				);
			}
		}

		if (!accountsToUpdate.isEmpty()) {
			update accountsToUpdate;
		}
	}
}