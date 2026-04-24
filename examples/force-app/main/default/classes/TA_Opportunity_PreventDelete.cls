/**
 * @description Prevents deletion of Closed Won opportunities.
 * Ensures revenue records are preserved for reporting accuracy.
 */
public with sharing class TA_Opportunity_PreventDelete
	implements TriggerAction.BeforeDelete
{
	public void beforeDelete(List<SObject> triggerOld) {
		for (Opportunity opp : (List<Opportunity>) triggerOld) {
			if (opp.StageName == 'Closed Won') {
				opp.addError(
					'Cannot delete a Closed Won Opportunity. Please contact your administrator.'
				);
			}
		}
	}
}