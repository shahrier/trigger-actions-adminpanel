/**
 * @description Sets default Stage and Close Date on new Opportunities.
 * Runs first so subsequent validations check post-default values.
 */
public with sharing class TA_Opportunity_SetDefaults
	implements TriggerAction.BeforeInsert
{
	public void beforeInsert(List<SObject> triggerNew) {
		for (Opportunity opp : (List<Opportunity>) triggerNew) {
			if (String.isBlank(opp.StageName)) {
				opp.StageName = 'Prospecting';
			}
			if (opp.CloseDate == null) {
				opp.CloseDate = Date.today().addDays(30);
			}
		}
	}
}