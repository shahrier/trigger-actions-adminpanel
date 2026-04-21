/**
 * @group Trigger Actions Framework - Admin
 * @description Callback handler for Metadata API deployments of custom metadata records.
 * Logs deployment results for debugging purposes.
 */
public with sharing class CustomMetadataCallback implements Metadata.DeployCallback {
	public void handleResult(
		Metadata.DeployResult result,
		Metadata.DeployCallbackContext context
	) {
		if (result.status == Metadata.DeployStatus.Succeeded) {
			System.debug(
				LoggingLevel.INFO,
				'Custom metadata deployment succeeded. Job ID: ' + result.id
			);
		} else {
			String errorMessage = 'Custom metadata deployment failed. Job ID: ' + result.id;
			if (result.errorMessage != null) {
				errorMessage += ' Error: ' + result.errorMessage;
			}
			System.debug(LoggingLevel.ERROR, errorMessage);
		}
	}
}
