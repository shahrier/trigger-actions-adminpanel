/**
 * @group Trigger Actions Admin Panel
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
      throw createAuraException(msg);
    }

    try {
      Type classType = Type.forName(apexClassName);
      if (classType == null) {
        String msg =
          'Apex class "' +
          apexClassName +
          '" does not exist or is not accessible.';
        throw createAuraException(msg);
      }
    } catch (AuraHandledException ahe) {
      throw ahe;
    } catch (Exception e) {
      String msg =
        'Error validating Apex class "' +
        apexClassName +
        '": ' +
        e.getMessage();
      throw createAuraException(msg);
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

    String firstChar = flowName.substring(0, 1);
    if (firstChar.isNumeric()) {
      String msg = 'Flow name must start with a letter or underscore.';
      throw createAuraException(msg);
    }
  }

  @TestVisible
  private static List<FlowDefinitionView> mockFlows;

  @TestVisible
  private static List<sObject_Trigger_Setting__mdt> mockSettings;

  /**
   * @description Validates that the Flow exists in the org
   * @param flowName The API name of the Flow
   */
  public static void validateFlowExists(String flowName) {
    if (String.isBlank(flowName)) {
      return;
    }
    List<FlowDefinitionView> flows = mockFlows != null
      ? mockFlows
      : [
          SELECT ApiName
          FROM FlowDefinitionView
          WHERE ApiName = :flowName
          WITH USER_MODE
          LIMIT 1
        ];
    if (flows.isEmpty()) {
      throw createAuraException(
        'Flow "' + flowName + '" not found in the org.'
      );
    }
  }

  private static AuraHandledException createAuraException(String msg) {
    AuraHandledException ahe = new AuraHandledException(msg);
    ahe.setMessage(msg);
    return ahe;
  }

  /**
   * @description Validates trigger context flags
   * @param contexts Map of context names to boolean flags
   */
  public static void validateTriggerContexts(Map<String, Boolean> contexts) {
    if (contexts == null || contexts.isEmpty()) {
      String msg = 'At least one trigger context must be selected.';
      throw createAuraException(msg);
    }

    Boolean hasValidContext = false;
    for (String contextName : contexts.keySet()) {
      // Normalize context name: if it already ends with __c, use as-is; otherwise append __c
      String normalizedName = contextName.endsWith('__c')
        ? contextName
        : contextName + '__c';
      if (!VALID_TRIGGER_CONTEXTS.contains(normalizedName)) {
        String msg = 'Invalid trigger context: ' + contextName;
        throw createAuraException(msg);
      }
      if (contexts.get(contextName)) {
        hasValidContext = true;
      }
    }

    if (!hasValidContext) {
      String msg = 'At least one trigger context must be enabled.';
      throw createAuraException(msg);
    }
  }

  /**
   * @description Validates dynamic Entry Criteria formulas using Formula.builder()
   * @param entryCriteria Formula string to compile and validate
   * @param objectName The SObject API name to resolve the setting context
   */
  public static void validateFormula(String entryCriteria, String objectName) {
    if (String.isBlank(entryCriteria)) {
      return;
    }

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
        SELECT TriggerRecord_Class_Name__c
        FROM sObject_Trigger_Setting__mdt
        WHERE Object_API_Name__c = :objectName
        WITH USER_MODE
        LIMIT 1
      ];
    }

    if (settings.isEmpty()) {
      throw createAuraException(
        'No SObject Trigger Setting found for SObject "' +
          objectName +
          '". Please create a Trigger Setting first.'
      );
    }

    String className = settings[0].TriggerRecord_Class_Name__c;
    if (String.isBlank(className)) {
      throw createAuraException(
        'The SObject Trigger Setting for "' +
          objectName +
          '" must specify a TriggerRecord Class Name to enable Entry Criteria formula validation/evaluation.'
      );
    }

    System.Type classType = System.Type.forName(className);
    if (classType == null) {
      throw createAuraException(
        'The TriggerRecord Class Name "' +
          className +
          '" specified in the SObject Trigger Setting does not exist or is not global/accessible.'
      );
    }

    try {
      Formula.builder()
        .withReturnType(FormulaEval.FormulaReturnType.Boolean)
        .withGlobalVariables(FormulaEval.FormulaGlobal.values())
        .withType(classType)
        .withFormula(entryCriteria)
        .build();
    } catch (System.FormulaValidationException e) {
      String errorMsg = e.getMessage();
      if (errorMsg.contains('<a')) {
        errorMsg = errorMsg.left(errorMsg.indexOf('<a')).trim();
      }
      throw createAuraException('Invalid Entry Criteria formula: ' + errorMsg);
    } catch (Exception e) {
      throw createAuraException('Error compiling formula: ' + e.getMessage());
    }
  }
}
