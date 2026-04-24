/**
 * @description Creates a Task reminder for the Lead owner when a Lead
 * is created or restored from the Recycle Bin.
 */
public with sharing class TA_Lead_CreateFollowUp
	implements TriggerAction.AfterInsert, TriggerAction.AfterUndelete
{
	public void afterInsert(List<SObject> triggerNew) {
		createTasks((List<Lead>) triggerNew);
	}

	public void afterUndelete(List<SObject> triggerNew) {
		createTasks((List<Lead>) triggerNew);
	}

	private void createTasks(List<Lead> leads) {
		List<Task> tasks = new List<Task>();
		for (Lead l : leads) {
			tasks.add(
				new Task(
					WhoId = l.Id,
					OwnerId = l.OwnerId,
					Subject = 'Follow up with new Lead: ' + l.LastName,
					ActivityDate = Date.today().addDays(3),
					Priority = 'Normal',
					Status = 'Not Started'
				)
			);
		}
		if (!tasks.isEmpty()) {
			insert tasks;
		}
	}
}