/**
 * @group Trigger Actions Framework - Admin - Tests
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
		System.assert(threwExpectedException, 'Expected AuraHandledException for non-existent class');
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
		System.assert(threwExpectedException, 'Expected AuraHandledException for blank class name');
	}

	/**
	 * Test validation of trigger contexts - empty
	 */
	@isTest
	static void testValidateTriggerContextsEmpty() {
		Test.startTest();
		Boolean threwExpectedException = false;
		try {
			TriggerActionValidator.validateTriggerContexts(new Map<String, Boolean>());
			System.assert(false, 'Should throw exception for empty contexts');
		} catch (AuraHandledException e) {
			threwExpectedException = true;
		}
		Test.stopTest();
		System.assert(threwExpectedException, 'Expected AuraHandledException for empty contexts');
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
		System.assert(threwExpectedException, 'Expected AuraHandledException when all contexts disabled');
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
				'After_Insert__c' => false
			};
			TriggerActionValidator.validateTriggerContexts(contexts);
			// If no exception, test passes
		} catch (Exception e) {
			System.assert(false, 'Should not throw exception when at least one context enabled');
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
		System.assert(threwExpectedException, 'Expected AuraHandledException for invalid flow name');
	}
}
