/**
 * @description Notifies the Account owner via Task when a high-value
 * Opportunity is created on their Account.
 */
public with sharing class TA_Opportunity_NotifyOwner
	implements TriggerAction.AfterInsert
{
	private static final Decimal HIGH_VALUE_THRESHOLD = 100000;

	public void afterInsert(List<SObject> triggerNew) {
		List<Task> tasks = new List<Task>();
		for (Opportunity opp : (List<Opportunity>) triggerNew) {
			if (opp.Amount != null && opp.Amount >= HIGH_VALUE_THRESHOLD) {
				tasks.add(
					new Task(
						WhatId = opp.Id,
						OwnerId = opp.OwnerId,
						Subject = 'High-value Opportunity: ' + opp.Name,
						Description = 'A new Opportunity worth $' +
							opp.Amount.format() +
							' has been created. Please review and prioritize.',
						ActivityDate = Date.today().addDays(1),
						Priority = 'High',
						Status = 'Not Started'
					)
				);
			}
		}
		if (!tasks.isEmpty()) {
			insert tasks;
		}
	}
}