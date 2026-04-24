/**
 * @description Enriches the Lead record with default values based on
 * Lead Source. Runs before validation to ensure fields are populated.
 */
public with sharing class TA_Lead_EnrichData
	implements TriggerAction.BeforeInsert, TriggerAction.BeforeUpdate
{
	public void beforeInsert(List<SObject> triggerNew) {
		enrich((List<Lead>) triggerNew);
	}

	public void beforeUpdate(
		List<SObject> triggerNew,
		List<SObject> triggerOld
	) {
		Map<Id, Lead> oldMap = new Map<Id, Lead>((List<Lead>) triggerOld);
		List<Lead> changed = new List<Lead>();
		for (Lead l : (List<Lead>) triggerNew) {
			if (l.LeadSource != oldMap.get(l.Id).LeadSource) {
				changed.add(l);
			}
		}
		if (!changed.isEmpty()) {
			enrich(changed);
		}
	}

	private void enrich(List<Lead> leads) {
		for (Lead l : leads) {
			if (l.LeadSource == 'Web' && String.isBlank(l.Rating)) {
				l.Rating = 'Warm';
			} else if (l.LeadSource == 'Partner Referral' && String.isBlank(l.Rating)) {
				l.Rating = 'Hot';
			}
		}
	}
}