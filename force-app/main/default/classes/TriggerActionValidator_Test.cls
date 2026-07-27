/**
 * @group Trigger Actions Admin Panel - Tests
 * @description Unit tests for TriggerActionValidator class
 */
@isTest
private class TriggerActionValidator_Test {
  /**
   * Test validation of valid Apex class name
   */
  @isTest
  static void testValidateApexClassNameValid() {
    Test.startTest();
    Boolean didThrow = false;
    try {
      TriggerActionValidator.validateApexClassName('TriggerActionValidator');
    } catch (Exception e) {
      didThrow = true;
    }
    Test.stopTest();
    System.assert(!didThrow, 'Should not throw exception for valid class');
  }

  /**
   * Test validation of invalid Apex class name
   */
  @isTest
  static void testValidateApexClassNameInvalid() {
    Test.startTest();
    Boolean threwExpectedException = false;
    try {
      TriggerActionValidator.validateApexClassName('NonExistentClass');
      System.assert(false, 'Should throw exception for non-existent class');
    } catch (AuraHandledException e) {
      threwExpectedException = true;
    }
    Test.stopTest();
    System.assert(
      threwExpectedException,
      'Expected AuraHandledException for non-existent class'
    );
  }

  /**
   * Test validation of blank Apex class name
   */
  @isTest
  static void testValidateApexClassNameBlank() {
    Test.startTest();
    Boolean threwExpectedException = false;
    try {
      TriggerActionValidator.validateApexClassName('');
      System.assert(false, 'Should throw exception for blank class name');
    } catch (AuraHandledException e) {
      threwExpectedException = true;
    }
    Test.stopTest();
    System.assert(
      threwExpectedException,
      'Expected AuraHandledException for blank class name'
    );
  }

  /**
   * Test validation of trigger contexts - empty
   */
  @isTest
  static void testValidateTriggerContextsEmpty() {
    Test.startTest();
    Boolean threwExpectedException = false;
    try {
      TriggerActionValidator.validateTriggerContexts(
        new Map<String, Boolean>()
      );
      System.assert(false, 'Should throw exception for empty contexts');
    } catch (AuraHandledException e) {
      threwExpectedException = true;
    }
    Test.stopTest();
    System.assert(
      threwExpectedException,
      'Expected AuraHandledException for empty contexts'
    );
  }

  /**
   * Test validation of trigger contexts - all disabled
   */
  @isTest
  static void testValidateTriggerContextsAllDisabled() {
    Test.startTest();
    Boolean threwExpectedException = false;
    try {
      Map<String, Boolean> contexts = new Map<String, Boolean>{
        'Before_Insert__c' => false,
        'After_Insert__c' => false
      };
      TriggerActionValidator.validateTriggerContexts(contexts);
      System.assert(false, 'Should throw exception when all contexts disabled');
    } catch (AuraHandledException e) {
      threwExpectedException = true;
    }
    Test.stopTest();
    System.assert(
      threwExpectedException,
      'Expected AuraHandledException when all contexts disabled'
    );
  }

  /**
   * Test validation of trigger contexts - one enabled
   */
  @isTest
  static void testValidateTriggerContextsOneEnabled() {
    Test.startTest();
    try {
      Map<String, Boolean> contexts = new Map<String, Boolean>{
        'Before_Insert__c' => true,
        'After_Insert' => false
      };
      TriggerActionValidator.validateTriggerContexts(contexts);
      // If no exception, test passes
    } catch (Exception e) {
      System.assert(
        false,
        'Should not throw exception when at least one context enabled'
      );
    }
    Test.stopTest();
  }

  /**
   * Test validation of Flow name - blank is allowed (optional field)
   */
  @isTest
  static void testValidateFlowNameBlank() {
    Test.startTest();
    Boolean didThrow = false;
    try {
      TriggerActionValidator.validateFlowName('');
    } catch (Exception e) {
      didThrow = true;
    }
    Test.stopTest();
    System.assert(!didThrow, 'Blank flow name should not throw');
  }

  /**
   * Test validation of Flow name - valid name
   */
  @isTest
  static void testValidateFlowNameValid() {
    Test.startTest();
    Boolean didThrow = false;
    try {
      TriggerActionValidator.validateFlowName('My_Flow_Name');
    } catch (Exception e) {
      didThrow = true;
    }
    Test.stopTest();
    System.assert(!didThrow, 'Valid flow name should not throw');
  }

  /**
   * Test validation of Flow name - starts with number
   */
  @isTest
  static void testValidateFlowNameInvalid() {
    Test.startTest();
    Boolean threwExpectedException = false;
    try {
      TriggerActionValidator.validateFlowName('123_Invalid_Flow');
      System.assert(false, 'Should throw for flow name starting with number');
    } catch (AuraHandledException e) {
      threwExpectedException = true;
    }
    Test.stopTest();
    System.assert(
      threwExpectedException,
      'Expected AuraHandledException for invalid flow name'
    );
  }

  /**
   * Test validation of Flow existence - success path with mocking
   */
  @isTest
  static void testValidateFlowExistsValid() {
    TriggerActionValidator.mockFlows = new List<FlowDefinitionView>{
      (FlowDefinitionView) JSON.deserialize(
        '{"ApiName":"MyFlow"}',
        FlowDefinitionView.class
      )
    };
    Test.startTest();
    TriggerActionValidator.validateFlowExists('MyFlow');
    Test.stopTest();
    // Passes if no exception thrown
  }

  /**
   * Test validation of Flow existence - non-existent flow
   */
  @isTest
  static void testValidateFlowExistsInvalid() {
    TriggerActionValidator.mockFlows = new List<FlowDefinitionView>();
    Test.startTest();
    Boolean threwExpectedException = false;
    try {
      TriggerActionValidator.validateFlowExists('NonExistentFlow');
      System.assert(false, 'Should throw for non-existent flow');
    } catch (AuraHandledException e) {
      threwExpectedException = true;
    }
    Test.stopTest();
    System.assert(
      threwExpectedException,
      'Expected AuraHandledException for non-existent flow'
    );
  }

  /**
   * Test validation of invalid context name
   */
  @isTest
  static void testValidateTriggerContextsInvalidName() {
    Test.startTest();
    Boolean threwExpectedException = false;
    try {
      Map<String, Boolean> contexts = new Map<String, Boolean>{
        'Invalid_Context' => true
      };
      TriggerActionValidator.validateTriggerContexts(contexts);
      System.assert(false, 'Should throw for invalid context name');
    } catch (AuraHandledException e) {
      threwExpectedException = true;
    }
    Test.stopTest();
    System.assert(
      threwExpectedException,
      'Expected AuraHandledException for invalid context name'
    );
  }

  /**
   * Test validation of a valid Entry Criteria formula
   */
  @isTest
  static void testValidateFormulaSuccess() {
    // Mock the Trigger Settings
    sObject_Trigger_Setting__mdt setting = new sObject_Trigger_Setting__mdt(
      Object_API_Name__c = 'Account',
      TriggerRecord_Class_Name__c = 'TriggerRecord'
    );
    TriggerActionValidator.mockSettings = new List<sObject_Trigger_Setting__mdt>{
      setting
    };

    Test.startTest();
    Boolean didThrow = false;
    try {
      // Validate formula with a blank formula (should return immediately)
      TriggerActionValidator.validateFormula('', 'Account');
      // Validate formula with a valid expression
      TriggerActionValidator.validateFormula('1 == 1', 'Account');
    } catch (Exception e) {
      didThrow = true;
      System.debug(
        'Unexpected exception: ' +
          e.getMessage() +
          '\n' +
          e.getStackTraceString()
      );
    }
    Test.stopTest();
    System.assert(!didThrow, 'Should not throw exception for valid formula');
  }

  /**
   * Test validation when no Trigger Setting is found
   */
  @isTest
  static void testValidateFormulaNoSetting() {
    TriggerActionValidator.mockSettings = new List<sObject_Trigger_Setting__mdt>();

    Test.startTest();
    Boolean threwExpectedException = false;
    try {
      TriggerActionValidator.validateFormula(
        'newSobject.Id != null',
        'Account'
      );
      System.assert(false, 'Should throw exception when no setting found');
    } catch (AuraHandledException e) {
      threwExpectedException = true;
      System.assert(
        e.getMessage().contains('No SObject Trigger Setting found'),
        'Expected error message, got: ' + e.getMessage()
      );
    }
    Test.stopTest();
    System.assert(threwExpectedException, 'Expected AuraHandledException');
  }

  /**
   * Test validation when Trigger Setting has missing/blank class name
   */
  @isTest
  static void testValidateFormulaMissingClassName() {
    sObject_Trigger_Setting__mdt setting = new sObject_Trigger_Setting__mdt(
      Object_API_Name__c = 'Account',
      TriggerRecord_Class_Name__c = ''
    );
    TriggerActionValidator.mockSettings = new List<sObject_Trigger_Setting__mdt>{
      setting
    };

    Test.startTest();
    Boolean threwExpectedException = false;
    try {
      TriggerActionValidator.validateFormula(
        'newSobject.Id != null',
        'Account'
      );
      System.assert(false, 'Should throw exception for missing class name');
    } catch (AuraHandledException e) {
      threwExpectedException = true;
      System.assert(
        e.getMessage().contains('must specify a TriggerRecord Class Name'),
        'Expected error message, got: ' + e.getMessage()
      );
    }
    Test.stopTest();
    System.assert(threwExpectedException, 'Expected AuraHandledException');
  }

  /**
   * Test validation when Trigger Setting's class name does not exist
   */
  @isTest
  static void testValidateFormulaInvalidClass() {
    sObject_Trigger_Setting__mdt setting = new sObject_Trigger_Setting__mdt(
      Object_API_Name__c = 'Account',
      TriggerRecord_Class_Name__c = 'NonExistentTriggerRecordClass'
    );
    TriggerActionValidator.mockSettings = new List<sObject_Trigger_Setting__mdt>{
      setting
    };

    Test.startTest();
    Boolean threwExpectedException = false;
    try {
      TriggerActionValidator.validateFormula(
        'newSobject.Id != null',
        'Account'
      );
      System.assert(false, 'Should throw exception for non-existent class');
    } catch (AuraHandledException e) {
      threwExpectedException = true;
      System.assert(
        e.getMessage().contains('does not exist or is not global/accessible'),
        'Expected error message, got: ' + e.getMessage()
      );
    }
    Test.stopTest();
    System.assert(threwExpectedException, 'Expected AuraHandledException');
  }

  /**
   * Test validation with invalid formula syntax
   */
  @isTest
  static void testValidateFormulaInvalidSyntax() {
    sObject_Trigger_Setting__mdt setting = new sObject_Trigger_Setting__mdt(
      Object_API_Name__c = 'Account',
      TriggerRecord_Class_Name__c = 'TriggerRecord'
    );
    TriggerActionValidator.mockSettings = new List<sObject_Trigger_Setting__mdt>{
      setting
    };

    Test.startTest();
    Boolean threwExpectedException = false;
    try {
      // Intentionally invalid formula (invalid operator / syntax)
      TriggerActionValidator.validateFormula('1 ==', 'Account');
      System.assert(false, 'Should throw exception for invalid formula syntax');
    } catch (AuraHandledException e) {
      threwExpectedException = true;
      System.assert(
        e.getMessage().contains('Invalid Entry Criteria formula'),
        'Expected error message, got: ' + e.getMessage()
      );
    }
    Test.stopTest();
    System.assert(threwExpectedException, 'Expected AuraHandledException');
  }
}
