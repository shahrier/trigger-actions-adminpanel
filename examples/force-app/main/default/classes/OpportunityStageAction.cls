public with sharing class OpportunityStageAction implements TriggerAction.BeforeInsert {
	public void beforeInsert(List<Opportunity> newList) {
		for (Opportunity opp : newList) {
			if (opp.Amount > 100000) {
				opp.Description = 'High Value Opportunity - Flagged by Trigger Actions Framework\n' + opp.Description;
			}
			if (String.isBlank(opp.Description)) {
				opp.Description = 'Initial creation processed by Trigger Actions Admin Panel Examples.';
			}
		}
	}
}
