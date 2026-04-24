/**
 * @description Sets default field values on new Account records.
 * Implements BeforeInsert and BeforeUpdate to ensure defaults are always applied.
 */
public with sharing class TA_Account_SetDefaults
	implements TriggerAction.BeforeInsert, TriggerAction.BeforeUpdate
{
	public void beforeInsert(List<SObject> triggerNew) {
		for (Account acc : (List<Account>) triggerNew) {
			setDefaults(acc);
		}
	}

	public void beforeUpdate(
		List<SObject> triggerNew,
		List<SObject> triggerOld
	) {
		for (Account acc : (List<Account>) triggerNew) {
			if (String.isBlank(acc.Industry)) {
				acc.Industry = 'Other';
			}
		}
	}

	private void setDefaults(Account acc) {
		if (String.isBlank(acc.Industry)) {
			acc.Industry = 'Technology';
		}
		if (acc.NumberOfEmployees == null) {
			acc.NumberOfEmployees = 1;
		}
	}
}