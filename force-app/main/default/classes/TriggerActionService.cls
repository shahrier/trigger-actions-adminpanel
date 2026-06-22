/**
 * @group Trigger Actions Admin Panel
 * @description Service class for CRUD operations on `Trigger_Action__mdt` metadata.
 * Provides methods for querying, creating, and updating trigger actions.
 */
public with sharing class TriggerActionService {
  private static final String METADATA_API_NAME = 'Trigger_Action__mdt';

  @TestVisible
  private static List<Trigger_Action__mdt> mockActions;
  @TestVisible
  private static List<sObject_Trigger_Setting__mdt> mockSettings;

  /**
   * @description Retrieves all Trigger Actions
   * @return List<Trigger_Action__mdt> All trigger actions
   */
  @AuraEnabled(cacheable=true)
  public static List<Trigger_Action__mdt> getAllTriggerActions() {
    if (mockActions != null) {
      return mockActions;
    }
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
        After_Undelete__c,
        Before_Insert__r.Object_API_Name__c,
        After_Insert__r.Object_API_Name__c,
        Before_Update__r.Object_API_Name__c,
        After_Update__r.Object_API_Name__c,
        Before_Delete__r.Object_API_Name__c,
        After_Delete__r.Object_API_Name__c,
        After_Undelete__r.Object_API_Name__c
      FROM Trigger_Action__mdt
      WITH USER_MODE
      ORDER BY Object_API_Name__c, Order__c
    ];
    for (Trigger_Action__mdt action : actions) {
      populateObjectApiNameIfBlank(action);
    }
    return actions;
  }

  /**
   * @description Retrieves a specific Trigger Action by ID
   * @param actionId The metadata record ID
   * @return Trigger_Action__mdt The trigger action record
   */
  @AuraEnabled(cacheable=false)
  public static Trigger_Action__mdt getTriggerActionById(String actionId) {
    if (mockActions != null) {
      for (Trigger_Action__mdt action : mockActions) {
        if (
          (action.Id != null && String.valueOf(action.Id) == actionId) ||
          action.DeveloperName == actionId
        ) {
          return action;
        }
      }
      return null;
    }
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
        After_Undelete__c,
        Before_Insert__r.Object_API_Name__c,
        After_Insert__r.Object_API_Name__c,
        Before_Update__r.Object_API_Name__c,
        After_Update__r.Object_API_Name__c,
        Before_Delete__r.Object_API_Name__c,
        After_Delete__r.Object_API_Name__c,
        After_Undelete__r.Object_API_Name__c
      FROM Trigger_Action__mdt
      WHERE Id = :actionId
      WITH USER_MODE
    ];
    if (actions.isEmpty()) {
      return null;
    }
    populateObjectApiNameIfBlank(actions[0]);
    return actions[0];
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
    String description,
    Boolean allowFlowRecursion
  ) {
    TriggerActionValidator.validateApexClassName(apexClassName);
    if (String.isNotBlank(flowName)) {
      TriggerActionValidator.validateFlowName(flowName);
      TriggerActionValidator.validateFlowExists(flowName);
    }
    validateUniqueDevName(devName);
    TriggerActionValidator.validateTriggerContexts(contexts);

    // Look up the sObject Trigger Setting DeveloperName for this object
    List<sObject_Trigger_Setting__mdt> settings;
    if (mockSettings != null) {
      settings = new List<sObject_Trigger_Setting__mdt>();
      for (sObject_Trigger_Setting__mdt setting : mockSettings) {
        if (setting.Object_API_Name__c == objectName) {
          settings.add(setting);
          break;
        }
      }
    } else {
      settings = [
        SELECT DeveloperName
        FROM sObject_Trigger_Setting__mdt
        WHERE Object_API_Name__c = :objectName
        WITH USER_MODE
        LIMIT 1
      ];
    }

    if (settings.isEmpty()) {
      String msg =
        'No Trigger Setting found for SObject "' +
        objectName +
        '". Please create a Trigger Setting first.';
      throw createAuraException(msg);
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
      String fieldName = contextName.endsWith('__c')
        ? contextName
        : contextName + '__c';
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
    addMetadataValue(
      record,
      'Allow_Flow_Recursion__c',
      allowFlowRecursion != null ? allowFlowRecursion : false
    );

    Metadata.DeployContainer mdContainer = new Metadata.DeployContainer();
    mdContainer.addMetadata(record);

    if (Test.isRunningTest()) {
      return 'MockJobId';
    }
    Id jobId = Metadata.Operations.enqueueDeployment(
      mdContainer,
      new CustomMetadataCallback()
    );
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
      TriggerActionValidator.validateFlowExists(flowName);
    }
    TriggerActionValidator.validateTriggerContexts(contexts);

    Trigger_Action__mdt existing;
    if (mockActions != null) {
      for (Trigger_Action__mdt action : mockActions) {
        if (action.DeveloperName == devName) {
          existing = action;
          break;
        }
      }
    }
    if (existing == null) {
      existing = [
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
        WITH USER_MODE
      ];
    }

    // Look up the sObject Trigger Setting DeveloperName for this object
    // Use Object_API_Name__c if available, otherwise find via context relationships
    List<sObject_Trigger_Setting__mdt> settings;
    if (mockSettings != null) {
      settings = mockSettings;
    } else if (String.isNotBlank(existing.Object_API_Name__c)) {
      settings = [
        SELECT DeveloperName, Object_API_Name__c
        FROM sObject_Trigger_Setting__mdt
        WHERE Object_API_Name__c = :existing.Object_API_Name__c
        WITH USER_MODE
        LIMIT 1
      ];
    } else {
      // Fallback: finding setting by related context record (checks all 7 contexts)
      Id settingId = existing.Before_Insert__c != null
        ? existing.Before_Insert__c
        : existing.After_Insert__c != null
            ? existing.After_Insert__c
            : existing.Before_Update__c != null
                ? existing.Before_Update__c
                : existing.After_Update__c != null
                    ? existing.After_Update__c
                    : existing.Before_Delete__c != null
                        ? existing.Before_Delete__c
                        : existing.After_Delete__c != null
                            ? existing.After_Delete__c
                            : existing.After_Undelete__c;

      if (settingId != null) {
        settings = [
          SELECT DeveloperName, Object_API_Name__c
          FROM sObject_Trigger_Setting__mdt
          WHERE Id = :settingId
          WITH USER_MODE
          LIMIT 1
        ];
      }
    }

    if (settings == null || settings.isEmpty()) {
      String msg =
        'No Trigger Setting found for Trigger Action "' +
        devName +
        '".';
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
    addMetadataValue(
      record,
      'Flow_Name__c',
      String.isNotBlank(flowName) ? flowName : null
    );
    addMetadataValue(record, 'Order__c', order);

    // Context fields are MetadataRelationship to sObject_Trigger_Setting__mdt
    // Enabled context = set to the setting's DeveloperName; disabled = null
    for (String contextName : contexts.keySet()) {
      String fieldName = contextName.endsWith('__c')
        ? contextName
        : contextName + '__c';
      Object fieldValue = contexts.get(contextName) ? settingDevName : null;
      addMetadataValue(record, fieldName, fieldValue);
    }

    addMetadataValue(
      record,
      'Entry_Criteria__c',
      String.isNotBlank(entryCriteria) ? entryCriteria : null
    );
    addMetadataValue(
      record,
      'Description__c',
      String.isNotBlank(description) ? description : null
    );
    addMetadataValue(
      record,
      'Bypass_Execution__c',
      bypassExecution != null ? bypassExecution : false
    );
    addMetadataValue(
      record,
      'Allow_Flow_Recursion__c',
      allowFlowRecursion != null ? allowFlowRecursion : false
    );

    Metadata.DeployContainer mdContainer = new Metadata.DeployContainer();
    mdContainer.addMetadata(record);

    if (Test.isRunningTest()) {
      return 'MockJobId';
    }
    Id jobId = Metadata.Operations.enqueueDeployment(
      mdContainer,
      new CustomMetadataCallback()
    );
    return jobId;
  }

  /**
   * @description Updates the execution orders of multiple Trigger Actions in a single metadata deployment.
   * @param newOrders Map of DeveloperNames to their new execution Order values
   * @return String The deployment job ID
   */
  @AuraEnabled
  public static String updateTriggerActionOrders(
    Map<String, Decimal> newOrders
  ) {
    if (newOrders == null || newOrders.isEmpty()) {
      throw createAuraException('No orders to update.');
    }

    List<Trigger_Action__mdt> existingActions = new List<Trigger_Action__mdt>();
    if (mockActions != null) {
      for (Trigger_Action__mdt action : mockActions) {
        if (newOrders.containsKey(action.DeveloperName)) {
          existingActions.add(action);
        }
      }
    } else {
      existingActions = [
        SELECT
          DeveloperName,
          MasterLabel,
          Object_API_Name__c,
          Apex_Class_Name__c,
          Flow_Name__c,
          Order__c,
          Before_Insert__c,
          After_Insert__c,
          Before_Update__c,
          After_Update__c,
          Before_Delete__c,
          After_Delete__c,
          After_Undelete__c,
          Entry_Criteria__c,
          Description__c,
          Bypass_Execution__c,
          Allow_Flow_Recursion__c
        FROM Trigger_Action__mdt
        WHERE DeveloperName IN :newOrders.keySet()
        WITH USER_MODE
      ];
    }

    // Gather setting IDs
    Set<Id> settingIds = new Set<Id>();
    for (Trigger_Action__mdt action : existingActions) {
      if (action.Before_Insert__c != null)
        settingIds.add(action.Before_Insert__c);
      if (action.After_Insert__c != null)
        settingIds.add(action.After_Insert__c);
      if (action.Before_Update__c != null)
        settingIds.add(action.Before_Update__c);
      if (action.After_Update__c != null)
        settingIds.add(action.After_Update__c);
      if (action.Before_Delete__c != null)
        settingIds.add(action.Before_Delete__c);
      if (action.After_Delete__c != null)
        settingIds.add(action.After_Delete__c);
      if (action.After_Undelete__c != null)
        settingIds.add(action.After_Undelete__c);
    }

    Map<Id, String> settingDevNames = new Map<Id, String>();
    if (mockSettings != null) {
      for (sObject_Trigger_Setting__mdt setting : mockSettings) {
        if (settingIds.contains(setting.Id)) {
          settingDevNames.put(setting.Id, setting.DeveloperName);
        }
      }
    } else if (!settingIds.isEmpty()) {
      for (sObject_Trigger_Setting__mdt setting : [
        SELECT Id, DeveloperName
        FROM sObject_Trigger_Setting__mdt
        WHERE Id IN :settingIds
        WITH USER_MODE
      ]) {
        settingDevNames.put(setting.Id, setting.DeveloperName);
      }
    }

    Metadata.DeployContainer mdContainer = new Metadata.DeployContainer();

    for (Trigger_Action__mdt action : existingActions) {
      Decimal newOrder = newOrders.get(action.DeveloperName);

      Metadata.CustomMetadata record = new Metadata.CustomMetadata();
      record.fullName = METADATA_API_NAME + '.' + action.DeveloperName;
      record.label = action.DeveloperName;

      addMetadataValue(record, 'Object_API_Name__c', action.Object_API_Name__c);
      addMetadataValue(record, 'Apex_Class_Name__c', action.Apex_Class_Name__c);
      addMetadataValue(record, 'Flow_Name__c', action.Flow_Name__c);
      addMetadataValue(record, 'Order__c', newOrder);
      addMetadataValue(record, 'Entry_Criteria__c', action.Entry_Criteria__c);
      addMetadataValue(record, 'Description__c', action.Description__c);
      addMetadataValue(
        record,
        'Bypass_Execution__c',
        action.Bypass_Execution__c
      );
      addMetadataValue(
        record,
        'Allow_Flow_Recursion__c',
        action.Allow_Flow_Recursion__c
      );

      // Context fields
      Map<String, Id> contexts = new Map<String, Id>{
        'Before_Insert__c' => action.Before_Insert__c,
        'After_Insert__c' => action.After_Insert__c,
        'Before_Update__c' => action.Before_Update__c,
        'After_Update__c' => action.After_Update__c,
        'Before_Delete__c' => action.Before_Delete__c,
        'After_Delete__c' => action.After_Delete__c,
        'After_Undelete__c' => action.After_Undelete__c
      };

      for (String ctxField : contexts.keySet()) {
        Id refId = contexts.get(ctxField);
        Object val = (refId != null && settingDevNames.containsKey(refId))
          ? settingDevNames.get(refId)
          : null;
        addMetadataValue(record, ctxField, val);
      }

      mdContainer.addMetadata(record);
    }

    if (Test.isRunningTest()) {
      return 'MockJobId';
    }

    Id jobId = Metadata.Operations.enqueueDeployment(
      mdContainer,
      new CustomMetadataCallback()
    );
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
        !name.endsWith('Share') &&
        !name.endsWith('History') &&
        !name.endsWith('Feed') &&
        !name.endsWith('Event') &&
        !name.endsWith('ChangeEvent') &&
        d.isCreateable()
      ) {
        Map<String, String> obj = new Map<String, String>();
        obj.put('label', d.getLabel() + ' (' + name + ')');
        obj.put('value', name);
        result.add(obj);
      }
    }

    // Sort by label
    for (Integer i = 0; i < result.size(); i++) {
      for (Integer j = i + 1; j < result.size(); j++) {
        if (result[i].get('label').compareTo(result[j].get('label')) > 0) {
          Map<String, String> temp = result[i];
          result[i] = result[j];
          result[j] = temp;
        }
      }
    }
    return result;
  }

  /**
   * @description Creates a new sObject Trigger Setting via Metadata API
   * @param objectName The API name of the target SObject
   * @param bypassPermission Optional permission to bypass execution
   * @param requiredPermission Optional permission required to execute
   * @param objectNamespace Optional namespace of the target SObject
   * @return String The deployment job ID
   */
  @AuraEnabled
  public static String createTriggerSetting(
    String objectName,
    String bypassPermission,
    String requiredPermission,
    String objectNamespace
  ) {
    if (String.isBlank(objectName)) {
      String msg = 'Object Name is required.';
      AuraHandledException ahe = new AuraHandledException(msg);
      ahe.setMessage(msg);
      throw ahe;
    }

    String devName = objectName.replace('__c', '').replace('__', '_');
    devName = devName.replaceAll('[^a-zA-Z0-9_]', '');
    if (devName.endsWith('_'))
      devName = devName.substring(0, devName.length() - 1);
    if (devName.length() > 37)
      devName = devName.substring(0, 37);

    List<sObject_Trigger_Setting__mdt> existingByName;
    List<sObject_Trigger_Setting__mdt> existingByObject;
    if (mockSettings != null) {
      existingByName = new List<sObject_Trigger_Setting__mdt>();
      existingByObject = new List<sObject_Trigger_Setting__mdt>();
      for (sObject_Trigger_Setting__mdt setting : mockSettings) {
        if (setting.DeveloperName == devName) {
          existingByName.add(setting);
        }
        if (setting.Object_API_Name__c == objectName) {
          existingByObject.add(setting);
        }
      }
    } else {
      existingByName = [
        SELECT Id
        FROM sObject_Trigger_Setting__mdt
        WHERE DeveloperName = :devName
        WITH USER_MODE
      ];
      existingByObject = [
        SELECT Id
        FROM sObject_Trigger_Setting__mdt
        WHERE Object_API_Name__c = :objectName
        WITH USER_MODE
      ];
    }

    if (!existingByName.isEmpty() || !existingByObject.isEmpty()) {
      String msg = 'A Trigger Setting for this SObject already exists.';
      AuraHandledException ahe = new AuraHandledException(msg);
      ahe.setMessage(msg);
      throw ahe;
    }

    // Automatically resolve namespace if blank
    String resolvedNamespace = objectNamespace;
    if (String.isBlank(resolvedNamespace) && String.isNotBlank(objectName)) {
      List<String> parts = objectName.split('__');
      if (parts.size() >= 3) {
        resolvedNamespace = parts[0];
      }
    }

    String fqName = objectName;
    if (
      String.isNotBlank(resolvedNamespace) &&
      objectName != null &&
      !objectName.startsWithIgnoreCase(resolvedNamespace + '__')
    ) {
      fqName = resolvedNamespace + '__' + objectName;
    }

    String recordLabel = devName;
    try {
      Schema.DescribeSObjectResult describeResult = Schema.describeSObjects(
        new List<String>{ fqName }
      )[0];
      recordLabel = describeResult.getLabel();
    } catch (Exception e) {
      // Fallback to devName
    }
    if (recordLabel.length() > 40) {
      recordLabel = recordLabel.substring(0, 40);
    }

    Metadata.CustomMetadata record = new Metadata.CustomMetadata();
    record.fullName = 'sObject_Trigger_Setting__mdt.' + devName;
    record.label = recordLabel;

    addMetadataValue(record, 'Object_API_Name__c', objectName);
    addMetadataValue(record, 'Bypass_Execution__c', false);

    if (String.isNotBlank(resolvedNamespace)) {
      addMetadataValue(record, 'Object_Namespace__c', resolvedNamespace);
    }
    if (String.isNotBlank(bypassPermission)) {
      addMetadataValue(record, 'Bypass_Permission__c', bypassPermission);
    }
    if (String.isNotBlank(requiredPermission)) {
      addMetadataValue(record, 'Required_Permission__c', requiredPermission);
    }

    Metadata.DeployContainer mdContainer = new Metadata.DeployContainer();
    mdContainer.addMetadata(record);

    if (Test.isRunningTest()) {
      return 'MockJobId';
    }
    return Metadata.Operations.enqueueDeployment(
      mdContainer,
      new CustomMetadataCallback()
    );
  }

  /**
   * @description Overload of createTriggerSetting for backward compatibility with 3-parameter callers
   */
  public static String createTriggerSetting(
    String objectName,
    String bypassPermission,
    String requiredPermission
  ) {
    return createTriggerSetting(
      objectName,
      bypassPermission,
      requiredPermission,
      null
    );
  }
  /**
   * @description Gets all available SObjects for filtering and selection
   * @return List<Map<String, String>> List of available SObjects with API names and labels
   */
  @AuraEnabled(cacheable=true)
  public static List<Map<String, String>> getAvailableSObjects() {
    List<Map<String, String>> result = new List<Map<String, String>>();
    List<sObject_Trigger_Setting__mdt> settings = mockSettings != null
      ? mockSettings
      : [
          SELECT Object_API_Name__c, Object_Namespace__c
          FROM sObject_Trigger_Setting__mdt
          WITH USER_MODE
          ORDER BY Object_API_Name__c
        ];
    Set<String> objectNames = new Set<String>();
    Set<String> lowercaseObjectNames = new Set<String>();
    for (sObject_Trigger_Setting__mdt setting : settings) {
      String objName = setting.Object_API_Name__c;
      if (objName != null) {
        String fqName = objName;
        if (
          String.isNotBlank(setting.Object_Namespace__c) &&
          !objName.startsWithIgnoreCase(setting.Object_Namespace__c + '__')
        ) {
          fqName = setting.Object_Namespace__c + '__' + objName;
        }
        objectNames.add(fqName);
        lowercaseObjectNames.add(fqName.toLowerCase());
      }
    }
    Map<String, Integer> triggerCounts = new Map<String, Integer>();
    List<ApexTrigger> trgs = mockTriggers != null
      ? mockTriggers
      : [
          SELECT TableEnumOrId
          FROM ApexTrigger
          WHERE Status = 'Active' AND TableEnumOrId IN :objectNames
          WITH USER_MODE
        ];
    for (ApexTrigger trg : trgs) {
      String objName = trg.TableEnumOrId;
      if (
        objName != null && lowercaseObjectNames.contains(objName.toLowerCase())
      ) {
        String matchName = objName.toLowerCase();
        Integer count = triggerCounts.containsKey(matchName)
          ? triggerCounts.get(matchName)
          : 0;
        triggerCounts.put(matchName, count + 1);
      }
    }

    // Get target identifiers for FlowDefinitionView query optimization
    Set<String> targetIdentifiers = new Set<String>();
    Map<String, String> entityIdToApiName = new Map<String, String>();
    Map<String, String> objectLabels = new Map<String, String>();
    for (String objName : objectNames) {
      targetIdentifiers.add(objName);
    }

    List<EntityDefinition> eds = mockSettings != null
      ? new List<EntityDefinition>()
      : [
          SELECT DurableId, QualifiedApiName, Label
          FROM EntityDefinition
          WHERE QualifiedApiName IN :objectNames
          WITH USER_MODE
        ];
    for (EntityDefinition ed : eds) {
      String dId = ed.DurableId;
      String apiName = ed.QualifiedApiName;
      targetIdentifiers.add(dId);
      entityIdToApiName.put(dId, apiName);
      if (apiName != null) {
        objectLabels.put(apiName.toLowerCase(), ed.Label);
      }
      if (dId.startsWith('01I')) {
        if (dId.length() == 18) {
          String dId15 = dId.substring(0, 15);
          targetIdentifiers.add(dId15);
          entityIdToApiName.put(dId15, apiName);
        } else if (dId.length() == 15) {
          try {
            String dId18 = Id.valueOf(dId);
            targetIdentifiers.add(dId18);
            entityIdToApiName.put(dId18, apiName);
          } catch (Exception e) {
          }
        }
      }
    }

    List<FlowDefinitionView> flws = mockFlows != null
      ? mockFlows
      : [
          SELECT TriggerObjectOrEventId
          FROM FlowDefinitionView
          WHERE IsActive = TRUE AND TriggerObjectOrEventId IN :targetIdentifiers
          WITH USER_MODE
        ];
    Map<String, Integer> flowCounts = new Map<String, Integer>();
    for (FlowDefinitionView flw : flws) {
      String rawObjName = entityIdToApiName.containsKey(
          flw.TriggerObjectOrEventId
        )
        ? entityIdToApiName.get(flw.TriggerObjectOrEventId)
        : flw.TriggerObjectOrEventId;
      if (
        rawObjName != null &&
        lowercaseObjectNames.contains(rawObjName.toLowerCase())
      ) {
        String matchName = rawObjName.toLowerCase();
        Integer count = flowCounts.containsKey(matchName)
          ? flowCounts.get(matchName)
          : 0;
        flowCounts.put(matchName, count + 1);
      }
    }
    for (sObject_Trigger_Setting__mdt setting : settings) {
      String objName = setting.Object_API_Name__c;
      String fqName = objName;
      if (
        String.isNotBlank(setting.Object_Namespace__c) &&
        objName != null &&
        !objName.startsWithIgnoreCase(setting.Object_Namespace__c + '__')
      ) {
        fqName = setting.Object_Namespace__c + '__' + objName;
      }
      String label = objName;
      if (fqName != null && objectLabels.containsKey(fqName.toLowerCase())) {
        label = objectLabels.get(fqName.toLowerCase());
      }
      String matchName = fqName != null ? fqName.toLowerCase() : '';
      Integer tCount = triggerCounts.containsKey(matchName)
        ? triggerCounts.get(matchName)
        : 0;
      Integer fCount = flowCounts.containsKey(matchName)
        ? flowCounts.get(matchName)
        : 0;
      Integer totalNative = tCount + fCount;
      Map<String, String> obj = new Map<String, String>();
      obj.put('name', objName);
      obj.put('label', label);
      obj.put('nativeCount', String.valueOf(totalNative));
      result.add(obj);
    }
    return result;
  }

  public class AutomationAuditWrapper {
    @AuraEnabled
    public List<ApexTrigger> triggers;
    @AuraEnabled
    public List<FlowDefinitionView> flows;
  }

  @TestVisible
  private static List<ApexTrigger> mockTriggers;
  @TestVisible
  private static List<FlowDefinitionView> mockFlows;
  @TestVisible
  private static Map<String, String> mockEntityIdToApiName;

  /**
   * @description Retrieves native automations (Apex Triggers and Flows) for a given SObject
   * @param objectName The API name of the SObject
   * @return AutomationAuditWrapper Wrapper containing lists of triggers and flows
   */
  @AuraEnabled(cacheable=true)
  public static AutomationAuditWrapper getNativeAutomations(String objectName) {
    AutomationAuditWrapper wrapper = new AutomationAuditWrapper();
    wrapper.triggers = new List<ApexTrigger>();
    wrapper.flows = new List<FlowDefinitionView>();

    // No object selected: return an empty result rather than an unfiltered query.
    if (String.isBlank(objectName)) {
      return wrapper;
    }

    String resolvedObjectName = objectName;
    List<sObject_Trigger_Setting__mdt> settings = [
      SELECT Object_Namespace__c
      FROM sObject_Trigger_Setting__mdt
      WHERE Object_API_Name__c = :objectName
      WITH USER_MODE
      LIMIT 1
    ];
    if (
      !settings.isEmpty() && String.isNotBlank(settings[0].Object_Namespace__c)
    ) {
      String ns = settings[0].Object_Namespace__c;
      if (objectName != null && !objectName.startsWithIgnoreCase(ns + '__')) {
        resolvedObjectName = ns + '__' + objectName;
      }
    }

    wrapper.triggers = mockTriggers != null
      ? mockTriggers
      : [
          SELECT
            Id,
            Name,
            Status,
            ApiVersion,
            LastModifiedDate,
            NamespacePrefix,
            Body,
            UsageBeforeInsert,
            UsageAfterInsert,
            UsageBeforeUpdate,
            UsageAfterUpdate,
            UsageBeforeDelete,
            UsageAfterDelete,
            UsageAfterUndelete
          FROM ApexTrigger
          WHERE TableEnumOrId = :resolvedObjectName
          WITH USER_MODE
          ORDER BY Name
        ];
    String targetId = resolvedObjectName;
    String targetId18 = resolvedObjectName;
    List<EntityDefinition> eds = [
      SELECT DurableId
      FROM EntityDefinition
      WHERE QualifiedApiName = :resolvedObjectName
      WITH USER_MODE
      LIMIT 1
    ];
    if (!eds.isEmpty()) {
      targetId = eds[0].DurableId;
      if (targetId.startsWith('01I')) {
        if (targetId.length() == 15) {
          try {
            targetId18 = Id.valueOf(targetId);
          } catch (Exception e) {
          }
        } else if (targetId.length() == 18) {
          targetId18 = targetId;
          targetId = targetId.substring(0, 15);
        }
      }
    }
    wrapper.flows = mockFlows != null
      ? mockFlows
      : [
          SELECT
            Id,
            DurableId,
            Label,
            ApiName,
            ProcessType,
            TriggerType,
            RecordTriggerType,
            IsActive,
            LastModifiedDate
          FROM FlowDefinitionView
          WHERE
            TriggerObjectOrEventId = :targetId
            OR TriggerObjectOrEventId = :targetId18
            OR TriggerObjectOrEventId = :resolvedObjectName
          WITH USER_MODE
          ORDER BY Label
        ];
    return wrapper;
  }

  public class DiscoveredObjectWrapper implements Comparable {
    @AuraEnabled
    public String objectName;
    @AuraEnabled
    public String objectLabel;
    @AuraEnabled
    public Integer triggerCount;
    @AuraEnabled
    public Integer flowCount;

    public DiscoveredObjectWrapper(String name, String label) {
      this.objectName = name;
      this.objectLabel = label;
      this.triggerCount = 0;
      this.flowCount = 0;
    }

    public Integer compareTo(Object compareTo) {
      DiscoveredObjectWrapper other = (DiscoveredObjectWrapper) compareTo;
      if (this.objectLabel == other.objectLabel) {
        if (this.objectName == other.objectName)
          return 0;
        if (this.objectName > other.objectName)
          return 1;
        return -1;
      }
      if (this.objectLabel > other.objectLabel)
        return 1;
      return -1;
    }
  }

  /**
   * @description Discovers SObjects with native automation that are NOT yet in the framework
   * @return List<DiscoveredObjectWrapper> List of discovered objects and their automation counts
   */
  @AuraEnabled(cacheable=true)
  public static List<DiscoveredObjectWrapper> getDiscoveredObjects() {
    Map<String, DiscoveredObjectWrapper> discoveryMap = new Map<String, DiscoveredObjectWrapper>();
    Set<String> managedObjects = new Set<String>();
    Map<String, SObjectType> gd = Schema.getGlobalDescribe();
    List<sObject_Trigger_Setting__mdt> settings = mockSettings != null
      ? mockSettings
      : [
          SELECT Object_API_Name__c
          FROM sObject_Trigger_Setting__mdt
          WITH USER_MODE
        ];
    for (sObject_Trigger_Setting__mdt setting : settings) {
      managedObjects.add(setting.Object_API_Name__c);
    }

    // Scan Triggers
    List<ApexTrigger> trgs = mockTriggers != null
      ? mockTriggers
      : [
          SELECT TableEnumOrId
          FROM ApexTrigger
          WHERE Status = 'Active'
          WITH USER_MODE
        ];
    for (ApexTrigger trg : trgs) {
      String objName = trg.TableEnumOrId;
      if (gd.containsKey(objName) && !managedObjects.contains(objName)) {
        if (!discoveryMap.containsKey(objName)) {
          String label = gd.get(objName).getDescribe().getLabel();
          discoveryMap.put(
            objName,
            new DiscoveredObjectWrapper(objName, label)
          );
        }
        discoveryMap.get(objName).triggerCount++;
      }
    }

    // Scan Flows
    List<FlowDefinitionView> flws = mockFlows != null
      ? mockFlows
      : [
          SELECT TriggerObjectOrEventId
          FROM FlowDefinitionView
          WHERE IsActive = TRUE AND TriggerObjectOrEventId != NULL
          WITH USER_MODE
        ];
    Set<String> triggerObjectIds = new Set<String>();
    for (FlowDefinitionView flw : flws) {
      if (flw.TriggerObjectOrEventId != null) {
        String idStr = flw.TriggerObjectOrEventId;
        triggerObjectIds.add(idStr);
        if (idStr.startsWith('01I')) {
          if (idStr.length() == 15) {
            try {
              triggerObjectIds.add(Id.valueOf(idStr));
            } catch (Exception e) {
            }
          } else if (idStr.length() == 18) {
            triggerObjectIds.add(idStr.substring(0, 15));
          }
        }
      }
    }
    Map<String, String> entityIdToApiName = new Map<String, String>();
    if (mockEntityIdToApiName != null) {
      for (String key : mockEntityIdToApiName.keySet()) {
        String val = mockEntityIdToApiName.get(key);
        entityIdToApiName.put(key, val);
        if (key.startsWith('01I')) {
          if (key.length() == 15) {
            try {
              entityIdToApiName.put(Id.valueOf(key), val);
            } catch (Exception e) {
            }
          } else if (key.length() == 18) {
            entityIdToApiName.put(key.substring(0, 15), val);
          }
        }
      }
    }
    Set<String> queryIds = new Set<String>();
    for (String idStr : triggerObjectIds) {
      if (!entityIdToApiName.containsKey(idStr)) {
        queryIds.add(idStr);
      }
    }
    if (!queryIds.isEmpty()) {
      for (EntityDefinition ed : [
        SELECT DurableId, QualifiedApiName
        FROM EntityDefinition
        WHERE DurableId IN :queryIds
        WITH USER_MODE
      ]) {
        entityIdToApiName.put(ed.DurableId, ed.QualifiedApiName);
        if (ed.DurableId.startsWith('01I') && ed.DurableId.length() == 15) {
          try {
            entityIdToApiName.put(
              Id.valueOf(ed.DurableId),
              ed.QualifiedApiName
            );
          } catch (Exception e) {
          }
        }
      }
    }
    for (FlowDefinitionView flw : flws) {
      String objName = entityIdToApiName.containsKey(flw.TriggerObjectOrEventId)
        ? entityIdToApiName.get(flw.TriggerObjectOrEventId)
        : flw.TriggerObjectOrEventId;
      // Only include objects that are actually in the Global Describe (ignoring ghost objects/events)
      if (gd.containsKey(objName) && !managedObjects.contains(objName)) {
        if (!discoveryMap.containsKey(objName)) {
          String label = gd.get(objName).getDescribe().getLabel();
          discoveryMap.put(
            objName,
            new DiscoveredObjectWrapper(objName, label)
          );
        }
        discoveryMap.get(objName).flowCount++;
      }
    }

    List<DiscoveredObjectWrapper> discoveredList = discoveryMap.values();
    discoveredList.sort();
    return discoveredList;
  }

  /**
   * @description Validates that the Developer Name is unique
   * @param devName The Developer Name to validate
   */
  private static void validateUniqueDevName(String devName) {
    if (mockActions != null) {
      for (Trigger_Action__mdt action : mockActions) {
        if (action.DeveloperName == devName) {
          String msg =
            'A Trigger Action with Developer Name "' +
            devName +
            '" already exists.';
          throw createAuraException(msg);
        }
      }
      return;
    }
    List<Trigger_Action__mdt> existing = [
      SELECT Id
      FROM Trigger_Action__mdt
      WHERE DeveloperName = :devName
      WITH USER_MODE
    ];
    if (!existing.isEmpty()) {
      String msg =
        'A Trigger Action with Developer Name "' +
        devName +
        '" already exists.';
      throw createAuraException(msg);
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

    // Query ApexTypeImplementor to discover all concrete classes that implement TriggerAction interfaces in the org.
    // Note: TriggerActionServiceSampleStub is packaged specifically to guarantee this query returns at least one result
    // in clean scratch orgs, ensuring test coverage for the loop and conversion logic below.
    for (ApexTypeImplementor impl : [
      SELECT ClassName
      FROM ApexTypeImplementor
      WHERE
        InterfaceName IN (
          'TriggerAction.BeforeInsert',
          'TriggerAction.AfterInsert',
          'TriggerAction.BeforeUpdate',
          'TriggerAction.AfterUpdate',
          'TriggerAction.BeforeDelete',
          'TriggerAction.AfterDelete',
          'TriggerAction.AfterUndelete'
        )
        AND IsConcrete = TRUE
        AND ClassName NOT IN (
          'MetadataTriggerHandler',
          'TriggerActionFlow',
          'TriggerActionFlowChangeEvent'
        )
      ORDER BY ClassName
    ]) {
      classNames.add(impl.ClassName);
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
   * @description Retrieves the source code (body) of an Apex class by name.
   * @param className The name of the Apex class.
   * @return String The class body.
   */
  @AuraEnabled(cacheable=true)
  public static String getApexClassBody(String className) {
    List<ApexClass> classes = [
      SELECT Body
      FROM ApexClass
      WHERE Name = :className
      WITH USER_MODE
      LIMIT 1
    ];
    if (classes.isEmpty()) {
      throw createAuraException(
        'Apex class "' + className + '" not found in the org.'
      );
    }
    return classes[0].Body;
  }

  /**
   * @description Retrieves the ID of a Flow by its DeveloperName.
   * @param flowName The API name of the Flow.
   * @return String The Flow ID.
   */
  @AuraEnabled(cacheable=true)
  public static String getFlowIdByName(String flowName) {
    List<FlowDefinitionView> flows = [
      SELECT DurableId
      FROM FlowDefinitionView
      WHERE ApiName = :flowName
      WITH USER_MODE
      LIMIT 1
    ];
    if (flows.isEmpty()) {
      flows = [
        SELECT DurableId
        FROM FlowDefinitionView
        WHERE DurableId = :flowName
        WITH USER_MODE
        LIMIT 1
      ];
    }
    if (flows.isEmpty()) {
      throw createAuraException(
        'Flow "' + flowName + '" not found in the org.'
      );
    }
    return flows[0].DurableId;
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
        throw createAuraException(msg);
      }

      Object instance;
      try {
        instance = classType.newInstance();
      } catch (System.TypeException e) {
        String msg =
          'Class "' +
          apexClassName +
          '" must have a public default (no-arg) constructor to be auto-detected.';
        throw createAuraException(msg);
      } catch (Exception e) {
        String msg =
          'Error instantiating class "' +
          apexClassName +
          '": ' +
          e.getMessage();
        throw createAuraException(msg);
      }

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
      String msg =
        'Error inspecting class "' +
        apexClassName +
        '": ' +
        e.getMessage();
      throw createAuraException(msg);
    }

    return JSON.serialize(contexts);
  }

  private static void populateObjectApiNameIfBlank(Trigger_Action__mdt action) {
    if (action != null && String.isBlank(action.Object_API_Name__c)) {
      if (
        action.Before_Insert__r != null &&
        String.isNotBlank(action.Before_Insert__r.Object_API_Name__c)
      ) {
        action.Object_API_Name__c = action.Before_Insert__r.Object_API_Name__c;
      } else if (
        action.After_Insert__r != null &&
        String.isNotBlank(action.After_Insert__r.Object_API_Name__c)
      ) {
        action.Object_API_Name__c = action.After_Insert__r.Object_API_Name__c;
      } else if (
        action.Before_Update__r != null &&
        String.isNotBlank(action.Before_Update__r.Object_API_Name__c)
      ) {
        action.Object_API_Name__c = action.Before_Update__r.Object_API_Name__c;
      } else if (
        action.After_Update__r != null &&
        String.isNotBlank(action.After_Update__r.Object_API_Name__c)
      ) {
        action.Object_API_Name__c = action.After_Update__r.Object_API_Name__c;
      } else if (
        action.Before_Delete__r != null &&
        String.isNotBlank(action.Before_Delete__r.Object_API_Name__c)
      ) {
        action.Object_API_Name__c = action.Before_Delete__r.Object_API_Name__c;
      } else if (
        action.After_Delete__r != null &&
        String.isNotBlank(action.After_Delete__r.Object_API_Name__c)
      ) {
        action.Object_API_Name__c = action.After_Delete__r.Object_API_Name__c;
      } else if (
        action.After_Undelete__r != null &&
        String.isNotBlank(action.After_Undelete__r.Object_API_Name__c)
      ) {
        action.Object_API_Name__c = action.After_Undelete__r.Object_API_Name__c;
      }
    }
  }

  private static AuraHandledException createAuraException(String msg) {
    AuraHandledException ahe = new AuraHandledException(msg);
    ahe.setMessage(msg);
    return ahe;
  }

  /**
   * @description Helper method to add metadata field values
   * @param record The metadata record
   * @param fieldName The field API name
   * @param fieldValue The field value
   */
  private static void addMetadataValue(
    Metadata.CustomMetadata record,
    String fieldName,
    Object fieldValue
  ) {
    Metadata.CustomMetadataValue cmValue = new Metadata.CustomMetadataValue();
    cmValue.field = fieldName;
    cmValue.value = fieldValue;
    record.values.add(cmValue);
  }
}
