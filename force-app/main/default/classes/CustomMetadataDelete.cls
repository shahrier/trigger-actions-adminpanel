/**
 * @group Trigger Actions Framework - Admin
 * @description Utility for deleting custom metadata records via the Metadata SOAP API.
 * Uses an HTTP callout to the org's own Metadata API endpoint since
 * Metadata.Operations does not support deletion.
 */
public with sharing class CustomMetadataDelete {
	private static final String API_VERSION = '66.0';

	/**
	 * @description Deletes a custom metadata record using the Metadata SOAP API deleteMetadata call.
	 * @param metadataTypeDevName The developer name of the custom metadata type (without __mdt suffix)
	 * @param recordDevName The developer name of the record to delete
	 * @return String The result message
	 */
	public static String deleteRecord(String metadataTypeDevName, String recordDevName) {
		String sessionId = UserInfo.getSessionId();
		if (String.isBlank(sessionId)) {
			String msg = 'Unable to obtain session ID. Ensure the user has API access.';
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}

		String baseUrl = URL.getOrgDomainUrl().toExternalForm();
		String endpoint = baseUrl + '/services/Soap/m/' + API_VERSION;
		String fullName = metadataTypeDevName + '.' + recordDevName;

		String soapBody =
			'<?xml version="1.0" encoding="UTF-8"?>' +
			'<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
			'xmlns:met="http://soap.sforce.com/2006/04/metadata">' +
			'<soapenv:Header>' +
			'<met:SessionHeader>' +
			'<met:sessionId>' + sessionId + '</met:sessionId>' +
			'</met:SessionHeader>' +
			'</soapenv:Header>' +
			'<soapenv:Body>' +
			'<met:deleteMetadata>' +
			'<met:type>CustomMetadata</met:type>' +
			'<met:fullNames>' + String.escapeSingleQuotes(fullName) + '</met:fullNames>' +
			'</met:deleteMetadata>' +
			'</soapenv:Body>' +
			'</soapenv:Envelope>';

		HttpRequest req = new HttpRequest();
		req.setEndpoint(endpoint);
		req.setMethod('POST');
		req.setHeader('Content-Type', 'text/xml;charset=UTF-8');
		req.setHeader('SOAPAction', 'deleteMetadata');
		req.setBody(soapBody);
		req.setTimeout(30000);

		Http http = new Http();
		HttpResponse res = http.send(req);

		if (res.getStatusCode() != 200) {
			String msg = 'Metadata API call failed (HTTP ' + res.getStatusCode() + '): ' + res.getBody();
			AuraHandledException ahe = new AuraHandledException(msg);
			ahe.setMessage(msg);
			throw ahe;
		}

		String responseBody = res.getBody();
		if (responseBody.contains('<success>true</success>')) {
			return 'Successfully deleted ' + fullName;
		} else {
			String errorMsg = parseError(responseBody);
			AuraHandledException ahe = new AuraHandledException(errorMsg);
			ahe.setMessage(errorMsg);
			throw ahe;
		}
	}

	private static String parseError(String responseBody) {
		// Extract error message from SOAP response
		String errorMsg = 'Deletion failed';
		if (responseBody.contains('<message>')) {
			Integer start = responseBody.indexOf('<message>') + '<message>'.length();
			Integer endIdx = responseBody.indexOf('</message>', start);
			if (start > 0 && endIdx > start) {
				errorMsg = responseBody.substring(start, endIdx);
			}
		}
		return errorMsg;
	}
}
