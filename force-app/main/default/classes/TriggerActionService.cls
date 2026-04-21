/**
 * @group Trigger Actions Framework - Admin
 * @description Service class for CRUD operations on `Trigger_Action__mdt` metadata.
 * Provides methods for querying, creating, updating, and deleting trigger actions.
 */
public with sharing class TriggerActionService {
	private static final String METADATA_API_NAME = 'Trigger_Action__mdt';

	/**
	 * @description Retrieves all Trigger Actions
	 * @return List<Trigger_Action__mdt> All trigger actions
	 */
	@AuraEnabled(cacheable=true)
	public static List<Trigger_Action__mdt> getAllTriggerActions() {
		return [
			SELECT
				Id,
				DeveloperName,
				Apex_Class_Name__c,
				Flow_Name__c,
				Order__c,
				Object_API_Name__c,
				Allow_Flow_Recursion__c,
				Entry_Criteria__c,
				Bypass_Execution__c,
				Description__c,
				Before_Insert__c,
				After_Insert__c,
				Before_Update__c,
				After_Update__c,
				Before_Delete__c,
				After_Delete__c,
				After_Undelete__c
			FROM Trigger_Action__mdt
			ORDER BY Object_API_Name__c, Order__c
		];
	}

	/**
	 * @description Retrieves a specific Trigger Action by ID
	 * @param actionId The metadata record ID
	 * @return Trigger_Action__mdt The trigger action record
	 */
	@AuraEnabled(cacheable=false)
	public static Trigger_Action__mdt getTriggerActionById(String actionId) {
		List<Trigger_Action__mdt> actions = [
			SELECT
				Id,
				DeveloperName,
				Apex_Class_Name__c,
				Flow_Name__c,
				Order__c,
				Object_API_Name__c,
				Allow_Flow_Recursion__c,
				Entry_Criteria__c,
				Bypass_Execution__c,
				Description__c,
				Before_Insert__c,
				After_Insert__c,
				Before_Update__c,
				After_Update__c,
				Before_Delete__c,
				After_Delete__c,
				After_Undelete__c
			FROM Trigger_Action__mdt
			WHERE Id = :actionId
		];
		return actions.isEmpty() ? null : actions[0];
	}

	/**
	 * @description Creates a new Trigger Action via Metadata API
	 * @param objectName The SObject API name this action applies to
	 * @param devName The Developer Name of the new metadata record
	 * @param apexClassName The Apex class name implementing the action
	 * @param flowName Optional Flow API name to execute
	 * @param order The execution order
	 * @param contexts A map of context names to boolean flags (e.g., {'BeforeInsert': true, 'AfterInsert': false})
	 * @param entryCriteria Optional formula to conditionally execute
	 * @param description Optional description
	 * @return String The deployment job ID
	 */
	@AuraEnabled
	public static String createTriggerAction(
		String objectName,
		String devName,
		String apexClassName,
		String flowName,
		Decimal order,
		Map<String, Boolean> contexts,
		String entryCriteria,
		String description
	) {
		TriggerActionValidator.validateApexClassName(apexClassName);
		if (String.isNotBlank(flowName)) {
			TriggerActionValidator.validateFlowName(flowName);
		}
		validateUniqueDevName(devName);
		TriggerActionValidator.validateTriggerContexts(contexts);

		// Look up the sObject Trigger Setting DeveloperName for this object
		// Context fields are MetadataRelationship fields — they must be set to the
		// DeveloperName of the sObject_Trigger_Setting__mdt record, not a boolean
		List<sObject_Trigger_Setting__mdt> settings = [
			SELECT DeveloperName
			FROM sObject_Trigger_Setting__mdt
			WHERE Object_API_Name__c = :objectName
			LIMIT 1
		];
		if (settings.isEmpty()) {
			String msg = 'No Trigger Setting found for SObject "' + objectName + '". Please create a Trigger Setting first.';
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}
		String settingDevName = settings[0].DeveloperName;

		Metadata.CustomMetadata record = new Metadata.CustomMetadata();
		record.fullName = METADATA_API_NAME + '.' + devName;
		record.label = devName;

		addMetadataValue(record, 'Object_API_Name__c', objectName);
		addMetadataValue(record, 'Apex_Class_Name__c', apexClassName);
		if (String.isNotBlank(flowName)) {
			addMetadataValue(record, 'Flow_Name__c', flowName);
		}
		addMetadataValue(record, 'Order__c', order);

		// Context fields are MetadataRelationship to sObject_Trigger_Setting__mdt
		// Enabled context = set to the setting's DeveloperName; disabled = null
		for (String contextName : contexts.keySet()) {
			String fieldName = contextName.endsWith('__c') ? contextName : contextName + '__c';
			Object fieldValue = contexts.get(contextName) ? settingDevName : null;
			addMetadataValue(record, fieldName, fieldValue);
		}

		if (String.isNotBlank(entryCriteria)) {
			addMetadataValue(record, 'Entry_Criteria__c', entryCriteria);
		}
		if (String.isNotBlank(description)) {
			addMetadataValue(record, 'Description__c', description);
		}
		addMetadataValue(record, 'Bypass_Execution__c', false);
		addMetadataValue(record, 'Allow_Flow_Recursion__c', false);

		Metadata.DeployContainer mdContainer = new Metadata.DeployContainer();
		mdContainer.addMetadata(record);

		Id jobId = Metadata.Operations.enqueueDeployment(mdContainer, new CustomMetadataCallback());
		return jobId;
	}

	/**
	 * @description Updates an existing Trigger Action via Metadata API
	 * @param devName The Developer Name of the metadata record
	 * @param apexClassName The updated Apex class name
	 * @param flowName Updated Flow name
	 * @param order Updated execution order
	 * @param contexts Updated context flags
	 * @param entryCriteria Updated entry criteria formula
	 * @param description Updated description
	 * @param bypassExecution Updated bypass flag
	 * @param allowFlowRecursion Updated flow recursion flag
	 * @return String The deployment job ID
	 */
	@AuraEnabled
	public static String updateTriggerAction(
		String devName,
		String apexClassName,
		String flowName,
		Decimal order,
		Map<String, Boolean> contexts,
		String entryCriteria,
		String description,
		Boolean bypassExecution,
		Boolean allowFlowRecursion
	) {
		TriggerActionValidator.validateApexClassName(apexClassName);
		if (String.isNotBlank(flowName)) {
			TriggerActionValidator.validateFlowName(flowName);
		}
		TriggerActionValidator.validateTriggerContexts(contexts);

		Trigger_Action__mdt existing = [
			SELECT 
				Object_API_Name__c,
				Before_Insert__c,
				After_Insert__c,
				Before_Update__c,
				After_Update__c,
				Before_Delete__c,
				After_Delete__c,
				After_Undelete__c
			FROM Trigger_Action__mdt
			WHERE DeveloperName = :devName
		];

		// Look up the sObject Trigger Setting DeveloperName for this object
		// Use Object_API_Name__c if available, otherwise find via context relationships
		List<sObject_Trigger_Setting__mdt> settings;
		if (String.isNotBlank(existing.Object_API_Name__c)) {
			settings = [
				SELECT DeveloperName
				FROM sObject_Trigger_Setting__mdt
				WHERE Object_API_Name__c = :existing.Object_API_Name__c
				LIMIT 1
			];
		} else {
			// Fallback: finding setting by related context record
			Id settingId = existing.Before_Insert__c != null ? existing.Before_Insert__c :
						  existing.After_Insert__c != null ? existing.After_Insert__c :
						  existing.Before_Update__c != null ? existing.Before_Update__c :
						  existing.After_Update__c != null ? existing.After_Update__c :
						  existing.Before_Delete__c != null ? existing.Before_Delete__c :
						  existing.After_Delete__c != null ? existing.After_Delete__c :
						  existing.After_Undelete__c;
			
			if (settingId != null) {
				settings = [
					SELECT DeveloperName, Object_API_Name__c
					FROM sObject_Trigger_Setting__mdt
					WHERE Id = :settingId
					LIMIT 1
				];
			}
		}

		if (settings == null || settings.isEmpty()) {
			String msg = 'No Trigger Setting found for Trigger Action "' + devName + '".';
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}
		String settingDevName = settings[0].DeveloperName;
		String objectName = settings[0].Object_API_Name__c;

		Metadata.CustomMetadata record = new Metadata.CustomMetadata();
		record.fullName = METADATA_API_NAME + '.' + devName;
		record.label = devName;

		addMetadataValue(record, 'Object_API_Name__c', objectName);
		addMetadataValue(record, 'Apex_Class_Name__c', apexClassName);
		addMetadataValue(record, 'Flow_Name__c', String.isNotBlank(flowName) ? flowName : null);
		addMetadataValue(record, 'Order__c', order);

		// Context fields are MetadataRelationship to sObject_Trigger_Setting__mdt
		// Enabled context = set to the setting's DeveloperName; disabled = null
		for (String contextName : contexts.keySet()) {
			String fieldName = contextName.endsWith('__c') ? contextName : contextName + '__c';
			Object fieldValue = contexts.get(contextName) ? settingDevName : null;
			addMetadataValue(record, fieldName, fieldValue);
		}

		addMetadataValue(record, 'Entry_Criteria__c', String.isNotBlank(entryCriteria) ? entryCriteria : null);
		addMetadataValue(record, 'Description__c', String.isNotBlank(description) ? description : null);
		addMetadataValue(record, 'Bypass_Execution__c', bypassExecution);
		addMetadataValue(record, 'Allow_Flow_Recursion__c', allowFlowRecursion);

		Metadata.DeployContainer mdContainer = new Metadata.DeployContainer();
		mdContainer.addMetadata(record);

		Id jobId = Metadata.Operations.enqueueDeployment(mdContainer, new CustomMetadataCallback());
		return jobId;
	}

	/**
	 * @description Gets all triggerable SObjects in the org for the picklist
	 * @return List<Map<String, String>> List of triggerable SObjects
	 */
	@AuraEnabled(cacheable=true)
	public static List<Map<String, String>> getAllOrgSObjects() {
		List<Map<String, String>> result = new List<Map<String, String>>();
		for (Schema.SObjectType sot : Schema.getGlobalDescribe().values()) {
			Schema.DescribeSObjectResult d = sot.getDescribe();
			String name = d.getName();
			if (
				!d.isCustomSetting() &&
				!name.endsWith('__Share') &&
				!name.endsWith('__History') &&
				!name.endsWith('__Feed') &&
				!name.endsWith('__ChangeEvent') &&
				d.isCreateable()
			) {
				Map<String, String> obj = new Map<String, String>();
				obj.put('label', d.getLabel() + ' (' + name + ')');
				obj.put('value', name);
				result.add(obj);
			}
		}
		return result;
	}

	/**
	 * @description Creates a new sObject Trigger Setting via Metadata API
	 * @param objectName The API name of the target SObject
	 * @param bypassPermission Optional permission to bypass execution
	 * @param requiredPermission Optional permission required to execute
	 * @return String The deployment job ID
	 */
	@AuraEnabled
	public static String createTriggerSetting(
		String objectName,
		String bypassPermission,
		String requiredPermission
	) {
		if (String.isBlank(objectName)) {
			String msg = 'Object Name is required.';
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}

		String devName = objectName.replace('__c', '').replace('__', '_');
		devName = devName.replaceAll('[^a-zA-Z0-9_]', '');
		if (devName.endsWith('_')) devName = devName.substring(0, devName.length() - 1);
		if (devName.length() > 37) devName = devName.substring(0, 37);

		List<sObject_Trigger_Setting__mdt> existingByName = [
			SELECT Id FROM sObject_Trigger_Setting__mdt WHERE DeveloperName = :devName
		];
		List<sObject_Trigger_Setting__mdt> existingByObject = [
			SELECT Id FROM sObject_Trigger_Setting__mdt WHERE Object_API_Name__c = :objectName
		];

		if (!existingByName.isEmpty() || !existingByObject.isEmpty()) {
			String msg = 'A Trigger Setting for this SObject already exists.';
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}

		Metadata.CustomMetadata record = new Metadata.CustomMetadata();
		record.fullName = 'sObject_Trigger_Setting__mdt.' + devName;
		record.label = devName;

		addMetadataValue(record, 'Object_API_Name__c', objectName);
		addMetadataValue(record, 'Bypass_Execution__c', false);
		
		if (String.isNotBlank(bypassPermission)) {
			addMetadataValue(record, 'Bypass_Permission__c', bypassPermission);
		}
		if (String.isNotBlank(requiredPermission)) {
			addMetadataValue(record, 'Required_Permission__c', requiredPermission);
		}

		Metadata.DeployContainer mdContainer = new Metadata.DeployContainer();
		mdContainer.addMetadata(record);

		return Metadata.Operations.enqueueDeployment(mdContainer, new CustomMetadataCallback());
	}
	/**
	 * @description Gets all available SObjects for filtering and selection
	 * @return List<Map<String, String>> List of available SObjects with API names and labels
	 */
	@AuraEnabled(cacheable=true)
	public static List<Map<String, String>> getAvailableSObjects() {
		List<Map<String, String>> result = new List<Map<String, String>>();
		// Get all trigger settings to show configured objects
		for (sObject_Trigger_Setting__mdt setting : [
			SELECT Object_API_Name__c
			FROM sObject_Trigger_Setting__mdt
			ORDER BY Object_API_Name__c
		]) {
			Map<String, String> obj = new Map<String, String>();
			obj.put('name', setting.Object_API_Name__c);
			obj.put('label', setting.Object_API_Name__c);
			result.add(obj);
		}
		return result;
	}

	/**
	 * @description Deletes a Trigger Action via the Metadata SOAP API
	 * @param devName The Developer Name of the trigger action record to delete
	 * @return String The result message
	 */
	@AuraEnabled
	public static String deleteTriggerAction(String devName) {
		// Deprecated in favor of Visualforce-based deletion in the LWC
		return 'Deletion of ' + devName + ' is now handled by the UI.';
	}

	/**
	 * @description Validates that the Developer Name is unique
	 * @param devName The Developer Name to validate
	 */
	private static void validateUniqueDevName(String devName) {
		List<Trigger_Action__mdt> existing = [
			SELECT Id
			FROM Trigger_Action__mdt
			WHERE DeveloperName = :devName
		];
		if (!existing.isEmpty()) {
			String msg = 'A Trigger Action with Developer Name "' + devName + '" already exists.';
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}
	}

	/**
	 * @description Gets all available Apex classes implementing TriggerAction interfaces from existing Trigger Actions
	 * @return List<Map<String, String>> List of available classes with names and labels
	 */
	@AuraEnabled(cacheable=true)
	public static List<Map<String, String>> getAvailableApexClasses() {
		Set<String> classNames = new Set<String>();
		List<Map<String, String>> result = new List<Map<String, String>>();

		// Collect all unique Apex class names from existing Trigger Actions
		for (Trigger_Action__mdt action : [
			SELECT Apex_Class_Name__c
			FROM Trigger_Action__mdt
			WHERE Apex_Class_Name__c != null
			ORDER BY Apex_Class_Name__c
		]) {
			classNames.add(action.Apex_Class_Name__c);
		}

		// Convert to map format for LWC combobox
		for (String className : classNames) {
			Map<String, String> clsMap = new Map<String, String>();
			clsMap.put('label', className);
			clsMap.put('value', className);
			result.add(clsMap);
		}

		return result;
	}

	/**
	 * @description Inspects an Apex class and returns which TriggerAction interfaces it implements
	 * @param apexClassName The name of the class to inspect
	 * @return String JSON-serialized map of context names to whether they're implemented
	 */
	@AuraEnabled
	public static String getImplementedContexts(String apexClassName) {
		Map<String, Boolean> contexts = new Map<String, Boolean>{
			'Before_Insert__c' => false,
			'After_Insert__c' => false,
			'Before_Update__c' => false,
			'After_Update__c' => false,
			'Before_Delete__c' => false,
			'After_Delete__c' => false,
			'After_Undelete__c' => false
		};

		try {
			Type classType = Type.forName(apexClassName);
			if (classType == null) {
				String msg = 'Class "' + apexClassName + '" not found.';
				AuraHandledException ahe = new AuraHandledException(msg);
				ahe.setMessage(msg);
				throw ahe;
			}

			Object instance = classType.newInstance();

			// Check which interfaces this class implements
			if (instance instanceof TriggerAction.BeforeInsert) {
				contexts.put('Before_Insert__c', true);
			}
			if (instance instanceof TriggerAction.AfterInsert) {
				contexts.put('After_Insert__c', true);
			}
			if (instance instanceof TriggerAction.BeforeUpdate) {
				contexts.put('Before_Update__c', true);
			}
			if (instance instanceof TriggerAction.AfterUpdate) {
				contexts.put('After_Update__c', true);
			}
			if (instance instanceof TriggerAction.BeforeDelete) {
				contexts.put('Before_Delete__c', true);
			}
			if (instance instanceof TriggerAction.AfterDelete) {
				contexts.put('After_Delete__c', true);
			}
			if (instance instanceof TriggerAction.AfterUndelete) {
				contexts.put('After_Undelete__c', true);
			}
		} catch (AuraHandledException ahe) {
			throw ahe;
		} catch (Exception e) {
			String msg = 'Error inspecting class "' + apexClassName + '": ' + e.getMessage();
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}

		return JSON.serialize(contexts);
	}

	/**
	 * @description Helper method to add metadata field values
	 * @param record The metadata record
	 * @param fieldName The field API name
	 * @param fieldValue The field value
	 */
	private static void addMetadataValue(Metadata.CustomMetadata record, String fieldName, Object fieldValue) {
		Metadata.CustomMetadataValue cmValue = new Metadata.CustomMetadataValue();
		cmValue.field = fieldName;
		cmValue.value = fieldValue;
		record.values.add(cmValue);
	}
}
