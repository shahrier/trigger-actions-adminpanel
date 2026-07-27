@IsTest
private class AgentforceController_Test {
  @IsTest
  static void testGetCoworkerStatus() {
    Test.startTest();
    AgentforceController.CoworkerStatus status = AgentforceController.getCoworkerStatus();
    Test.stopTest();

    System.assertNotEquals(null, status, 'Status should not be null');
    System.assertNotEquals(
      null,
      status.statusMessage,
      'Status message should not be null'
    );
  }

  @IsTest
  static void testExplainArtifactApex() {
    Test.startTest();
    AgentforceController.AnalysisResult result = AgentforceController.explainArtifact(
      'APEX',
      'TestClass',
      'public class TestClass implements TriggerAction.BeforeInsert {}'
    );
    Test.stopTest();

    System.assertEquals(
      'APEX',
      result.artifactType,
      'Artifact type should match'
    );
    System.assertEquals(
      'TestClass',
      result.artifactName,
      'Artifact name should match'
    );
    System.assertNotEquals(
      null,
      result.explanation,
      'Explanation should not be null'
    );
  }

  @IsTest
  static void testExplainArtifactFlow() {
    Test.startTest();
    AgentforceController.AnalysisResult result = AgentforceController.explainArtifact(
      'FLOW',
      'Test_Flow',
      '{"processType": "RecordBeforeSave"}'
    );
    Test.stopTest();

    System.assertEquals(
      'FLOW',
      result.artifactType,
      'Artifact type should match'
    );
    System.assertEquals(
      'Test_Flow',
      result.artifactName,
      'Artifact name should match'
    );
    System.assertNotEquals(
      null,
      result.explanation,
      'Explanation should not be null'
    );
  }

  @IsTest
  static void testExplainArtifactObject() {
    String payload =
      'SObject API Name: Account\n' +
      'Trigger Action Framework actions: 2\n\n' +
      '=== AUTOMATION INVENTORY ===\n\n' +
      'TRIGGER ACTION FRAMEWORK (Trigger_Action__mdt)\n' +
      '[Before Insert]\n- ActionOne | Apex=ClassOne | Order=1 | Bypassed=No\n\n' +
      '=== PRECOMPUTED SIGNALS ===\n' +
      '- Before Insert is driven by multiple mechanisms: 1 TAF action(s) and 1 Apex trigger(s).';

    Test.startTest();
    AgentforceController.AnalysisResult result = AgentforceController.explainArtifact(
      'OBJECT',
      'Account',
      payload
    );
    Test.stopTest();

    System.assertEquals(
      'OBJECT',
      result.artifactType,
      'Artifact type should match'
    );
    System.assertEquals(
      'Account',
      result.artifactName,
      'Artifact name should match'
    );
    System.assertNotEquals(
      null,
      result.explanation,
      'Explanation should not be null'
    );
    // The object fallback surfaces the inventory in full rather than a
    // 500-character sample that would truncate away the signals.
    if (!result.isAvailable) {
      System.assert(
        result.explanation.contains('PRECOMPUTED SIGNALS'),
        'Offline object audit should include the full inventory and signals'
      );
    }
  }
}
