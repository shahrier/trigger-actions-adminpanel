/**
 * @description Auto-sets Case priority based on the Case origin.
 * Web and Email cases default to Medium; Phone cases default to High.
 */
public with sharing class TA_Case_SetPriority
	implements TriggerAction.BeforeInsert
{
	public void beforeInsert(List<SObject> triggerNew) {
		for (Case c : (List<Case>) triggerNew) {
			if (String.isBlank(c.Priority)) {
				if (c.Origin == 'Phone') {
					c.Priority = 'High';
				} else {
					c.Priority = 'Medium';
				}
			}
		}
	}
}