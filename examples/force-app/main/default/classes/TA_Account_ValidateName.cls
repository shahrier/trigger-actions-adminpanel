/**
 * @description Validates that the Account Name is not a generic placeholder.
 * Runs after TA_Account_SetDefaults to validate post-default values.
 */
public with sharing class TA_Account_ValidateName
	implements TriggerAction.BeforeInsert
{
	private static final Set<String> BLOCKED_NAMES = new Set<String>{
		'test',
		'test account',
		'tbd',
		'n/a',
		'unknown'
	};

	public void beforeInsert(List<SObject> triggerNew) {
		for (Account acc : (List<Account>) triggerNew) {
			if (
				String.isNotBlank(acc.Name) &&
				BLOCKED_NAMES.contains(acc.Name.toLowerCase().trim())
			) {
				acc.Name.addError(
					'Account Name cannot be a generic placeholder like "' +
						acc.Name +
						'".'
				);
			}
		}
	}
}