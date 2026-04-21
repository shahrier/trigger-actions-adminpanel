/**
 * @group Trigger Actions Framework - Admin - Tests
 * @description Unit tests for CustomMetadataCallback class
 */
@isTest
private class CustomMetadataCallback_Test {
	@isTest
	static void testHandleResultSuccess() {
		Metadata.DeployResult result = new Metadata.DeployResult();
		result.status = Metadata.DeployStatus.Succeeded;

		Test.startTest();
		CustomMetadataCallback callback = new CustomMetadataCallback();
		callback.handleResult(result, null);
		Test.stopTest();
		// No exception means success — callback only logs
	}

	@isTest
	static void testHandleResultFailure() {
		Metadata.DeployResult result = new Metadata.DeployResult();
		result.status = Metadata.DeployStatus.Failed;
		result.errorMessage = 'Test error message';

		Test.startTest();
		CustomMetadataCallback callback = new CustomMetadataCallback();
		callback.handleResult(result, null);
		Test.stopTest();
		// No exception means success — callback only logs
	}
}
