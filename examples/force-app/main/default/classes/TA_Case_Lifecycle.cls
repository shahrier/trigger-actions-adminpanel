/**
 * @description Handles full lifecycle management of Case records.
 * Implements multiple trigger contexts for comprehensive Case processing.
 */
public with sharing class TA_Case_Lifecycle
	implements
		TriggerAction.AfterInsert,
		TriggerAction.AfterUpdate,
		TriggerAction.AfterDelete,
		TriggerAction.AfterUndelete
{
	public void afterInsert(List<SObject> triggerNew) {
		System.debug(
			'TA_Case_Lifecycle.afterInsert: ' + triggerNew.size() + ' cases created'
		);
	}

	public void afterUpdate(
		List<SObject> triggerNew,
		List<SObject> triggerOld
	) {
		Map<Id, Case> oldMap = new Map<Id, Case>((List<Case>) triggerOld);
		for (Case c : (List<Case>) triggerNew) {
			Case oldCase = oldMap.get(c.Id);
			if (c.Status != oldCase.Status) {
				System.debug(
					'Case ' +
						c.CaseNumber +
						' status changed: ' +
						oldCase.Status +
						' -> ' +
						c.Status
				);
			}
		}
	}

	public void afterDelete(List<SObject> triggerOld) {
		System.debug(
			'TA_Case_Lifecycle.afterDelete: ' + triggerOld.size() + ' cases deleted'
		);
	}

	public void afterUndelete(List<SObject> triggerNew) {
		System.debug(
			'TA_Case_Lifecycle.afterUndelete: ' +
				triggerNew.size() +
				' cases restored'
		);
	}
}