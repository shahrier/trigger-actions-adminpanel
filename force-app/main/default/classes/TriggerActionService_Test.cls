/**
 * @group Trigger Actions Admin Panel - Tests
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

  @isTest
  static void testGetAllTriggerActionsMock() {
    TriggerActionService.mockActions = new List<Trigger_Action__mdt>{
      (Trigger_Action__mdt) JSON.deserialize(
        '{"DeveloperName":"Test"}',
        Trigger_Action__mdt.class
      )
    };
    Test.startTest();
    List<Trigger_Action__mdt> actions = TriggerActionService.getAllTriggerActions();
    Test.stopTest();
    System.assertEquals(1, actions.size(), 'Should return mocked action');
  }

  /**
   * Test that getTriggerActionById returns null for non-existent ID
   */
  @isTest
  static void testGetTriggerActionByIdNotFound() {
    Test.startTest();
    Trigger_Action__mdt action = TriggerActionService.getTriggerActionById(
      '000000000000000AAA'
    );
    Test.stopTest();

    System.assertEquals(null, action, 'Should return null for non-existent ID');
  }

  @isTest
  static void testGetTriggerActionByIdMock() {
    Trigger_Action__mdt mockAction = (Trigger_Action__mdt) JSON.deserialize(
      '{"Id":"04tgL000000EhI1QAK","DeveloperName":"MockAction"}',
      Trigger_Action__mdt.class
    );
    TriggerActionService.mockActions = new List<Trigger_Action__mdt>{
      mockAction
    };

    Test.startTest();
    Trigger_Action__mdt actionByDevName = TriggerActionService.getTriggerActionById(
      'MockAction'
    );
    Trigger_Action__mdt actionById = TriggerActionService.getTriggerActionById(
      '04tgL000000EhI1QAK'
    );
    Trigger_Action__mdt notFound = TriggerActionService.getTriggerActionById(
      'NotFound'
    );
    Test.stopTest();

    System.assertEquals(
      'MockAction',
      actionByDevName.DeveloperName,
      'Should find mocked action by dev name'
    );
    System.assertEquals(
      'MockAction',
      actionById.DeveloperName,
      'Should find mocked action by ID'
    );
    System.assertEquals(
      null,
      notFound,
      'Should return null when mocked action not found'
    );
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
  static void testGetAvailableSObjectsWithMocks() {
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>{
      new sObject_Trigger_Setting__mdt(Object_API_Name__c = 'Account')
    };
    TriggerActionService.mockTriggers = new List<ApexTrigger>{
      (ApexTrigger) JSON.deserialize(
        '{"TableEnumOrId":"Account","Status":"Active"}',
        ApexTrigger.class
      )
    };
    TriggerActionService.mockFlows = new List<FlowDefinitionView>{
      (FlowDefinitionView) JSON.deserialize(
        '{"TriggerObjectOrEventId":"Account","IsActive":true}',
        FlowDefinitionView.class
      )
    };

    Test.startTest();
    List<Map<String, String>> sObjects = TriggerActionService.getAvailableSObjects();
    Test.stopTest();

    System.assertEquals(
      1,
      sObjects.size(),
      'SObjects list should have one item'
    );
    System.assertEquals(
      'Account',
      sObjects[0].get('name'),
      'Name should be Account'
    );
    System.assertEquals(
      'Account',
      sObjects[0].get('label'),
      'Label should be Account'
    );
    System.assertEquals(
      '2',
      sObjects[0].get('nativeCount'),
      'Native count should be 2 (1 trigger + 1 flow)'
    );
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
    public void afterInsert(List<SObject> newList) {
    }
  }

  /**
   * Test that getImplementedContexts returns correct contexts for a known class
   */
  @isTest
  static void testGetImplementedContextsValid() {
    Test.startTest();
    String result = TriggerActionService.getImplementedContexts(
      'TriggerActionService_Test.DummyAction'
    );
    Test.stopTest();

    System.assert(result != null, 'Result should not be null');
    Map<String, Object> contexts = (Map<String, Object>) JSON.deserializeUntyped(
      result
    );
    System.assertEquals(
      true,
      contexts.get('After_Insert__c'),
      'DummyAction implements AfterInsert'
    );
    System.assertEquals(
      false,
      contexts.get('Before_Insert__c'),
      'DummyAction does not implement BeforeInsert'
    );
  }

  @isTest
  static void testGetImplementedContextsNoConstructor() {
    Test.startTest();
    try {
      TriggerActionService.getImplementedContexts('TriggerActionService');
    } catch (AuraHandledException e) {
      // Expected
    }
    Test.stopTest();
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
        null,
        false
      );
      System.assert(
        false,
        'Should throw exception for non-existent Apex class'
      );
    } catch (AuraHandledException e) {
      // Expected
    }
    Test.stopTest();
  }

  @isTest
  static void testCreateTriggerActionValid() {
    sObject_Trigger_Setting__mdt mockSetting = (sObject_Trigger_Setting__mdt) JSON.deserialize(
      '{"DeveloperName":"Account","Object_API_Name__c":"Account"}',
      sObject_Trigger_Setting__mdt.class
    );
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>{
      mockSetting
    };
    TriggerActionValidator.mockFlows = new List<FlowDefinitionView>{
      (FlowDefinitionView) JSON.deserialize(
        '{"ApiName":"MyFlow"}',
        FlowDefinitionView.class
      )
    };

    Test.startTest();
    String jobId = TriggerActionService.createTriggerAction(
      'Account',
      'NewAction',
      'TriggerActionService',
      'MyFlow',
      1,
      new Map<String, Boolean>{
        'Before_Insert__c' => true,
        'Before_Update' => true
      },
      'Criteria',
      'Desc',
      false
    );
    Test.stopTest();
    System.assertEquals('MockJobId', jobId, 'Should return mock job ID');
  }

  @isTest
  static void testCreateTriggerActionNoSetting() {
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>();

    Test.startTest();
    try {
      TriggerActionService.createTriggerAction(
        'Account',
        'NewAction',
        'TriggerActionService',
        null,
        1,
        new Map<String, Boolean>{ 'Before_Insert__c' => true },
        'Criteria',
        'Desc',
        false
      );
      System.assert(false, 'Should throw exception when no setting exists');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('No Trigger Setting found'),
        'Should indicate missing setting'
      );
    }
    Test.stopTest();
  }

  /**
   * Test retrieval of Apex class body
   */
  @isTest
  static void testGetApexClassBodyValid() {
    Test.startTest();
    String body = TriggerActionService.getApexClassBody('TriggerActionService');
    Test.stopTest();

    System.assert(String.isNotBlank(body), 'Class body should not be empty');
    System.assert(
      body.contains('class TriggerActionService'),
      'Body should contain class declaration'
    );
  }

  @isTest
  static void testGetApexClassBodyNotFound() {
    Test.startTest();
    try {
      TriggerActionService.getApexClassBody('NonExistentClass');
      System.assert(false, 'Should throw exception for missing class');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('not found'),
        'Message should indicate class not found'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testGetFlowIdByNameNotFound() {
    Test.startTest();
    try {
      TriggerActionService.getFlowIdByName('NonExistentFlow');
      System.assert(false, 'Should throw exception for missing flow');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('not found'),
        'Message should indicate flow not found'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testUpdateTriggerActionValid() {
    TriggerActionService.mockActions = new List<Trigger_Action__mdt>{
      (Trigger_Action__mdt) JSON.deserialize(
        '{"Id":"000000000000000AAA","DeveloperName":"Test_Action","Object_API_Name__c":"Account"}',
        Trigger_Action__mdt.class
      )
    };
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>{
      (sObject_Trigger_Setting__mdt) JSON.deserialize(
        '{"DeveloperName":"Account","Object_API_Name__c":"Account"}',
        sObject_Trigger_Setting__mdt.class
      )
    };

    Test.startTest();
    String jobId = TriggerActionService.updateTriggerAction(
      'Test_Action',
      'TriggerActionService',
      null,
      2,
      new Map<String, Boolean>{ 'Before_Insert__c' => true },
      'New Criteria',
      'New Description',
      true,
      false
    );
    Test.stopTest();
    System.assertEquals('MockJobId', jobId, 'Should return MockJobId in tests');
  }

  @isTest
  static void testUpdateTriggerActionMock() {
    Trigger_Action__mdt mockAction = (Trigger_Action__mdt) JSON.deserialize(
      '{"DeveloperName":"MockAction","Object_API_Name__c":"Account"}',
      Trigger_Action__mdt.class
    );
    TriggerActionService.mockActions = new List<Trigger_Action__mdt>{
      mockAction
    };
    sObject_Trigger_Setting__mdt mockSetting = (sObject_Trigger_Setting__mdt) JSON.deserialize(
      '{"DeveloperName":"Account","Object_API_Name__c":"Account"}',
      sObject_Trigger_Setting__mdt.class
    );
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>{
      mockSetting
    };

    Test.startTest();
    String jobId = TriggerActionService.updateTriggerAction(
      'MockAction',
      'TriggerActionService',
      null,
      1,
      new Map<String, Boolean>{ 'Before_Insert__c' => true },
      null,
      'Desc',
      false,
      false
    );
    Test.stopTest();
    System.assert(jobId != null, 'Should return a job ID');
  }

  @isTest
  static void testGetNativeAutomationsWithMocks() {
    TriggerActionService.mockTriggers = new List<ApexTrigger>{
      (ApexTrigger) JSON.deserialize(
        '{"Name":"TestTrigger","TableEnumOrId":"Account","Status":"Active","Body":"trigger TestTrigger on Account (before insert) {}"}',
        ApexTrigger.class
      )
    };
    TriggerActionService.mockFlows = new List<FlowDefinitionView>{
      (FlowDefinitionView) JSON.deserialize(
        '{"Label":"TestFlow","ApiName":"TestFlow","TriggerType":"RecordBeforeSave","IsActive":true}',
        FlowDefinitionView.class
      )
    };

    Test.startTest();
    TriggerActionService.AutomationAuditWrapper audit = TriggerActionService.getNativeAutomations(
      'Account'
    );
    Test.stopTest();

    System.assert(audit != null, 'Audit wrapper should not be null');
    System.assertEquals(
      1,
      audit.triggers.size(),
      'Should have 1 mocked trigger'
    );
    System.assertEquals(1, audit.flows.size(), 'Should have 1 mocked flow');
  }

  @isTest
  static void testGetDiscoveredObjectsWithMocks() {
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>();
    TriggerActionService.mockTriggers = new List<ApexTrigger>{
      (ApexTrigger) JSON.deserialize(
        '{"TableEnumOrId":"Account","Status":"Active"}',
        ApexTrigger.class
      )
    };
    TriggerActionService.mockFlows = new List<FlowDefinitionView>{
      (FlowDefinitionView) JSON.deserialize(
        '{"TriggerObjectOrEventId":"Account","IsActive":true}',
        FlowDefinitionView.class
      ),
      (FlowDefinitionView) JSON.deserialize(
        '{"TriggerObjectOrEventId":"01I8c0000010abc","TriggerObjectOrEvent":{"QualifiedApiName":"Contact"},"IsActive":true}',
        FlowDefinitionView.class
      )
    };

    TriggerActionService.mockEntityIdToApiName = new Map<String, String>{
      '01I8c0000010abc' => 'Contact'
    };

    Test.startTest();
    List<TriggerActionService.DiscoveredObjectWrapper> discovered = TriggerActionService.getDiscoveredObjects();
    Test.stopTest();

    System.assert(discovered != null, 'Discovered list should not be null');
    System.assertEquals(
      2,
      discovered.size(),
      'Should have discovered 2 objects (Account and Contact)'
    );
    System.assertEquals(
      'Account',
      discovered[0].objectName,
      'Object name should be Account'
    );
    System.assertEquals(
      'Account',
      discovered[0].objectLabel,
      'Object label should be Account'
    );
    System.assertEquals(
      'Contact',
      discovered[1].objectName,
      'Object name should be Contact'
    );
    System.assertEquals(
      'Contact',
      discovered[1].objectLabel,
      'Object label should be Contact'
    );

    // Test compareTo sorting logic
    TriggerActionService.DiscoveredObjectWrapper wrapper1 = new TriggerActionService.DiscoveredObjectWrapper(
      'Account',
      'Account'
    );
    TriggerActionService.DiscoveredObjectWrapper wrapper2 = new TriggerActionService.DiscoveredObjectWrapper(
      'Contact',
      'Contact'
    );
    System.assertEquals(
      -1,
      wrapper1.compareTo(wrapper2),
      'Account should sort before Contact'
    );

    TriggerActionService.DiscoveredObjectWrapper wrapper3 = new TriggerActionService.DiscoveredObjectWrapper(
      'Account2',
      'Account'
    );
    System.assertEquals(
      -1,
      wrapper1.compareTo(wrapper3),
      'Same label should compare object name'
    );

    TriggerActionService.DiscoveredObjectWrapper wrapper4 = new TriggerActionService.DiscoveredObjectWrapper(
      'Account',
      'Account'
    );
    System.assertEquals(
      0,
      wrapper1.compareTo(wrapper4),
      'Equal wrapper should return 0'
    );
  }

  @isTest
  static void testCreateTriggerSettingValid() {
    Test.startTest();
    String jobId = TriggerActionService.createTriggerSetting(
      'TestObject',
      null,
      null
    );
    Test.stopTest();
    System.assertEquals('MockJobId', jobId, 'Should return MockJobId');
  }

  @isTest
  static void testCreateTriggerSettingNamespace() {
    Test.startTest();
    // Test manual namespace passing
    String jobId1 = TriggerActionService.createTriggerSetting(
      'TestObject2',
      null,
      null,
      'my_ns'
    );
    // Test automatic namespace extraction (multiple __ in object name)
    String jobId2 = TriggerActionService.createTriggerSetting(
      'my_ns__MyObject__c',
      null,
      null,
      null
    );
    Test.stopTest();
    System.assertEquals('MockJobId', jobId1);
    System.assertEquals('MockJobId', jobId2);
  }

  @isTest
  static void testCreateTriggerActionDuplicateName() {
    TriggerActionService.mockActions = new List<Trigger_Action__mdt>{
      (Trigger_Action__mdt) JSON.deserialize(
        '{"DeveloperName":"Existing_Action"}',
        Trigger_Action__mdt.class
      )
    };
    Test.startTest();
    try {
      TriggerActionService.createTriggerAction(
        'Account',
        'Existing_Action',
        'TriggerActionService',
        null,
        1,
        new Map<String, Boolean>{ 'Before_Insert__c' => true },
        null,
        null,
        false
      );
      System.assert(false, 'Should throw for duplicate name');
    } catch (AuraHandledException e) {
      // Expected
    }
    Test.stopTest();
  }

  @isTest
  static void testUpdateTriggerActionNoMocks() {
    TriggerActionService.mockActions = new List<Trigger_Action__mdt>{
      (Trigger_Action__mdt) JSON.deserialize(
        '{"DeveloperName":"Test_Action","Object_API_Name__c":"Account"}',
        Trigger_Action__mdt.class
      )
    };
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>();
    Test.startTest();
    try {
      TriggerActionService.updateTriggerAction(
        'Test_Action',
        'TriggerActionService',
        null,
        2,
        new Map<String, Boolean>{ 'Before_Insert__c' => true },
        'New Criteria',
        'New Description',
        true,
        false
      );
      System.assert(false, 'Should throw setting not found exception');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('No Trigger Setting found'),
        'Should indicate missing setting'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testUpdateTriggerActionFallbackSetting() {
    TriggerActionService.mockActions = new List<Trigger_Action__mdt>{
      (Trigger_Action__mdt) JSON.deserialize(
        '{"DeveloperName":"Test_Action","Before_Insert__c":"00D000000000000"}',
        Trigger_Action__mdt.class
      )
    };
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>();
    Test.startTest();
    try {
      TriggerActionService.updateTriggerAction(
        'Test_Action',
        'TriggerActionService',
        null,
        2,
        new Map<String, Boolean>{ 'Before_Insert__c' => true },
        'New Criteria',
        'New Description',
        true,
        false
      );
      System.assert(false, 'Should throw setting not found exception');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('No Trigger Setting found'),
        'Should indicate missing setting'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testCreateTriggerSettingRealObject() {
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>();
    Test.startTest();
    String jobId = TriggerActionService.createTriggerSetting(
      'Account',
      null,
      null
    );
    Test.stopTest();
    System.assertEquals('MockJobId', jobId);
  }

  @isTest
  static void testCreateTriggerSettingLongName() {
    Test.startTest();
    String jobId = TriggerActionService.createTriggerSetting(
      'a_very_long_object_name_that_exceeds_forty_characters__c',
      null,
      null
    );
    Test.stopTest();
    System.assertEquals('MockJobId', jobId);
  }

  @isTest
  static void testCreateTriggerSettingPermissions() {
    Test.startTest();
    String jobId = TriggerActionService.createTriggerSetting(
      'TestObject',
      'BypassPerm',
      'RequiredPerm'
    );
    Test.stopTest();
    System.assertEquals('MockJobId', jobId);
  }

  @isTest
  static void testUpdateTriggerActionWithFlow() {
    TriggerActionService.mockActions = new List<Trigger_Action__mdt>{
      (Trigger_Action__mdt) JSON.deserialize(
        '{"DeveloperName":"MockAction","Object_API_Name__c":"Account"}',
        Trigger_Action__mdt.class
      )
    };
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>{
      (sObject_Trigger_Setting__mdt) JSON.deserialize(
        '{"DeveloperName":"Account","Object_API_Name__c":"Account"}',
        sObject_Trigger_Setting__mdt.class
      )
    };
    TriggerActionValidator.mockFlows = new List<FlowDefinitionView>{
      (FlowDefinitionView) JSON.deserialize(
        '{"ApiName":"MyFlow","IsActive":true}',
        FlowDefinitionView.class
      )
    };

    Test.startTest();
    String jobId = TriggerActionService.updateTriggerAction(
      'MockAction',
      'TriggerActionService',
      'MyFlow',
      1,
      new Map<String, Boolean>{ 'Before_Insert__c' => true },
      null,
      'Desc',
      false,
      false
    );
    Test.stopTest();
    System.assertEquals('MockJobId', jobId);
  }

  @isTest
  static void testCreateTriggerSettingDuplicate() {
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>{
      (sObject_Trigger_Setting__mdt) JSON.deserialize(
        '{"DeveloperName":"Account","Object_API_Name__c":"Account"}',
        sObject_Trigger_Setting__mdt.class
      )
    };
    Test.startTest();
    try {
      TriggerActionService.createTriggerSetting('Account', null, null);
      System.assert(false, 'Should throw for duplicate setting');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('already exists'),
        'Should indicate duplicate'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testGetNativeAutomationsLive() {
    Test.startTest();
    TriggerActionService.AutomationAuditWrapper audit = TriggerActionService.getNativeAutomations(
      'Account'
    );
    Test.stopTest();
    System.assert(audit != null, 'Audit wrapper should not be null');
    System.assert(audit.triggers != null, 'Triggers list should not be null');
    System.assert(audit.flows != null, 'Flows list should not be null');
  }

  @isTest
  static void testUpdateTriggerActionOrdersValid() {
    TriggerActionService.mockActions = new List<Trigger_Action__mdt>{
      (Trigger_Action__mdt) JSON.deserialize(
        '{"DeveloperName":"Test_Action1","Object_API_Name__c":"Account"}',
        Trigger_Action__mdt.class
      ),
      (Trigger_Action__mdt) JSON.deserialize(
        '{"DeveloperName":"Test_Action2","Object_API_Name__c":"Account"}',
        Trigger_Action__mdt.class
      )
    };
    TriggerActionService.mockSettings = new List<sObject_Trigger_Setting__mdt>{
      (sObject_Trigger_Setting__mdt) JSON.deserialize(
        '{"DeveloperName":"Account","Object_API_Name__c":"Account"}',
        sObject_Trigger_Setting__mdt.class
      )
    };

    Test.startTest();
    String jobId = TriggerActionService.updateTriggerActionOrders(
      new Map<String, Decimal>{ 'Test_Action1' => 10, 'Test_Action2' => 20 }
    );
    Test.stopTest();
    System.assertEquals('MockJobId', jobId, 'Should return MockJobId');
  }

  @isTest
  static void testUpdateTriggerActionOrdersEmpty() {
    Test.startTest();
    try {
      TriggerActionService.updateTriggerActionOrders(
        new Map<String, Decimal>()
      );
      System.assert(false, 'Should throw an exception for empty map');
    } catch (AuraHandledException e) {
      System.assertEquals('No orders to update.', e.getMessage());
    }
    Test.stopTest();
  }
}
