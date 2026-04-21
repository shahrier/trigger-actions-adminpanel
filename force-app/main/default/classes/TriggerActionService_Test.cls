/**
 * @group Trigger Actions Framework - Admin - Tests
 * @description Unit tests for TriggerActionService class
 */
@isTest
private class TriggerActionService_Test {
	/**
	 * Test that getAllTriggerActions returns records
	 */
	@isTest
	static void testGetAllTriggerActions() {
		Test.startTest();
		List<Trigger_Action__mdt> actions = TriggerActionService.getAllTriggerActions();
		Test.stopTest();

		System.assert(actions != null, 'Actions list should not be null');
	}

	/**
	 * Test that getTriggerActionById returns null for non-existent ID
	 */
	@isTest
	static void testGetTriggerActionByIdNotFound() {
		Test.startTest();
		Trigger_Action__mdt action = TriggerActionService.getTriggerActionById('000000000000000AAA');
		Test.stopTest();

		System.assertEquals(null, action, 'Should return null for non-existent ID');
	}

	/**
	 * Test that getAvailableSObjects returns list
	 */
	@isTest
	static void testGetAvailableSObjects() {
		Test.startTest();
		List<Map<String, String>> sObjects = TriggerActionService.getAvailableSObjects();
		Test.stopTest();

		System.assert(sObjects != null, 'SObjects list should not be null');
	}

	@isTest
	static void testGetAllOrgSObjects() {
		Test.startTest();
		List<Map<String, String>> sObjects = TriggerActionService.getAllOrgSObjects();
		Test.stopTest();

		System.assert(sObjects != null, 'Org SObjects list should not be null');
		System.assert(sObjects.size() > 0, 'Org SObjects list should not be empty');
	}

	@isTest
	static void testCreateTriggerSettingEmptyName() {
		Test.startTest();
		try {
			TriggerActionService.createTriggerSetting('', null, null);
			System.assert(false, 'Should throw exception for empty object name');
		} catch (AuraHandledException e) {
			// Expected
		}
		Test.stopTest();
	}

	/**
	 * Test that getAvailableApexClasses returns a list
	 */
	@isTest
	static void testGetAvailableApexClasses() {
		Test.startTest();
		List<Map<String, String>> classes = TriggerActionService.getAvailableApexClasses();
		Test.stopTest();

		System.assert(classes != null, 'Classes list should not be null');
	}

	public class DummyAction implements TriggerAction.AfterInsert {
		public void afterInsert(List<SObject> newList) {}
	}

	/**
	 * Test that getImplementedContexts returns correct contexts for a known class
	 */
	@isTest
	static void testGetImplementedContextsValid() {
		Test.startTest();
		String result = TriggerActionService.getImplementedContexts('TriggerActionService_Test.DummyAction');
		Test.stopTest();

		System.assert(result != null, 'Result should not be null');
		Map<String, Object> contexts = (Map<String, Object>) JSON.deserializeUntyped(result);
		System.assertEquals(true, contexts.get('After_Insert__c'), 'DummyAction implements AfterInsert');
		System.assertEquals(false, contexts.get('Before_Insert__c'), 'DummyAction does not implement BeforeInsert');
	}

	/**
	 * Test that getImplementedContexts throws for non-existent class
	 */
	@isTest
	static void testGetImplementedContextsInvalid() {
		Test.startTest();
		try {
			TriggerActionService.getImplementedContexts('NonExistentClass');
			System.assert(false, 'Should throw exception for non-existent class');
		} catch (AuraHandledException e) {
			System.assert(e.getMessage() != null, 'Error message should not be null');
		}
		Test.stopTest();
	}

	/**
	 * Test validation of invalid Apex class name
	 */
	@isTest
	static void testCreateActionWithInvalidApexClass() {
		Test.startTest();
		try {
			TriggerActionService.createTriggerAction(
				'Account',
				'Test_Action',
				'NonExistentClass',
				null,
				1,
				new Map<String, Boolean>{ 'Before_Insert__c' => true },
				null,
				null
			);
			System.assert(false, 'Should throw exception for non-existent Apex class');
		} catch (AuraHandledException e) {
			// AuraHandledException.getMessage() returns 'Script-thrown exception' in test context
			// so we only verify the correct exception type is thrown
		}
		Test.stopTest();
	}

	/**
	 * Test validation of empty contexts
	 */
	@isTest
	static void testCreateActionWithNoContexts() {
		Test.startTest();
		try {
			TriggerActionService.createTriggerAction(
				'Account',
				'Test_Action',
				'System',
				null,
				1,
				new Map<String, Boolean>(),
				null,
				null
			);
			System.assert(false, 'Should throw exception for no contexts');
		} catch (AuraHandledException e) {
			// AuraHandledException.getMessage() returns 'Script-thrown exception' in test context
		}
		Test.stopTest();
	}

	/**
	 * Test validation of all contexts disabled
	 */
	@isTest
	static void testCreateActionWithAllContextsDisabled() {
		Test.startTest();
		try {
			TriggerActionService.createTriggerAction(
				'Account',
				'Test_Action',
				'System',
				null,
				1,
				new Map<String, Boolean>{
					'Before_Insert__c' => false,
					'After_Insert__c' => false,
					'Before_Update__c' => false,
					'After_Update__c' => false,
					'Before_Delete__c' => false,
					'After_Delete__c' => false,
					'After_Undelete__c' => false
				},
				null,
				null
			);
			System.assert(false, 'Should throw exception when all contexts are disabled');
		} catch (AuraHandledException e) {
			// AuraHandledException.getMessage() returns 'Script-thrown exception' in test context
		}
		Test.stopTest();
	}
}
