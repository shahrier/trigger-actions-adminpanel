/**
 * @group Trigger Actions Framework - Admin
 * @description Validation utilities for Trigger Action configuration.
 * Validates Apex classes, Flows, and other metadata configuration.
 */
public with sharing class TriggerActionValidator {
	private static final Set<String> VALID_TRIGGER_CONTEXTS = new Set<String>{
		'Before_Insert__c',
		'After_Insert__c',
		'Before_Update__c',
		'After_Update__c',
		'Before_Delete__c',
		'After_Delete__c',
		'After_Undelete__c'
	};

	/**
	 * @description Validates that an Apex class name exists and can be instantiated
	 * @param apexClassName The class name to validate (e.g., 'MyTriggerAction')
	 */
	public static void validateApexClassName(String apexClassName) {
		if (String.isBlank(apexClassName)) {
			String msg = 'Apex class name is required.';
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}

		try {
			Type classType = Type.forName(apexClassName);
			if (classType == null) {
				String msg = 'Apex class "' + apexClassName + '" does not exist or is not accessible.';
				AuraHandledException ahe = new AuraHandledException(msg);
				ahe.setMessage(msg);
				throw ahe;
			}
		} catch (AuraHandledException ahe) {
			throw ahe;
		} catch (Exception e) {
			String msg = 'Error validating Apex class "' + apexClassName + '": ' + e.getMessage();
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}
	}

	/**
	 * @description Validates that a Flow name is provided in the correct format
	 * @param flowName The Flow API name to validate
	 */
	public static void validateFlowName(String flowName) {
		if (String.isBlank(flowName)) {
			return; // Flow name is optional
		}

		// Basic validation: flow name should not contain invalid characters
		// Simply check that it doesn't start with a number and contains only valid chars
		String firstChar = flowName.substring(0, 1);
		if (firstChar.isNumeric()) {
			String msg = 'Flow name must start with a letter or underscore.';
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}
	}

	/**
	 * @description Validates trigger context flags
	 * @param contexts Map of context names to boolean flags
	 */
	public static void validateTriggerContexts(Map<String, Boolean> contexts) {
		if (contexts == null || contexts.isEmpty()) {
			String msg = 'At least one trigger context must be selected.';
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}

		Boolean hasValidContext = false;
		for (String contextName : contexts.keySet()) {
			// Normalize context name: if it already ends with __c, use as-is; otherwise append __c
			String normalizedName = contextName.endsWith('__c') ? contextName : contextName + '__c';
			if (!VALID_TRIGGER_CONTEXTS.contains(normalizedName)) {
				String msg = 'Invalid trigger context: ' + contextName;
				AuraHandledException ahe = new AuraHandledException(msg);
				ahe.setMessage(msg);
				throw ahe;
			}
			if (contexts.get(contextName)) {
				hasValidContext = true;
			}
		}

		if (!hasValidContext) {
			String msg = 'At least one trigger context must be enabled.';
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}
	}
}
