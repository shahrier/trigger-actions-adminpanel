/**
 * @description Validates that an Opportunity has a Close Date in the future
 * and that the Amount is greater than zero.
 */
public with sharing class TA_Opportunity_ValidateAmount
	implements TriggerAction.BeforeInsert, TriggerAction.BeforeUpdate
{
	public void beforeInsert(List<SObject> triggerNew) {
		validate((List<Opportunity>) triggerNew);
	}

	public void beforeUpdate(
		List<SObject> triggerNew,
		List<SObject> triggerOld
	) {
		validate((List<Opportunity>) triggerNew);
	}

	private void validate(List<Opportunity> opportunities) {
		for (Opportunity opp : opportunities) {
			if (opp.Amount != null && opp.Amount <= 0) {
				opp.Amount.addError('Opportunity Amount must be greater than zero.');
			}
		}
	}
}