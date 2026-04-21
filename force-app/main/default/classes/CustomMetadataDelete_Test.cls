/**
 * @group Trigger Actions Framework - Admin - Tests
 * @description Unit tests for CustomMetadataDelete class
 */
@isTest
private class CustomMetadataDelete_Test {

	private class SuccessMock implements HttpCalloutMock {
		public HttpResponse respond(HttpRequest req) {
			HttpResponse res = new HttpResponse();
			res.setStatusCode(200);
			res.setBody(
				'<?xml version="1.0" encoding="UTF-8"?>' +
				'<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
				'<soapenv:Body><deleteMetadataResponse>' +
				'<result><success>true</success></result>' +
				'</deleteMetadataResponse></soapenv:Body></soapenv:Envelope>'
			);
			return res;
		}
	}

	private class FailureMock implements HttpCalloutMock {
		public HttpResponse respond(HttpRequest req) {
			HttpResponse res = new HttpResponse();
			res.setStatusCode(200);
			res.setBody(
				'<?xml version="1.0" encoding="UTF-8"?>' +
				'<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
				'<soapenv:Body><deleteMetadataResponse>' +
				'<result><success>false</success><message>Entity not found</message></result>' +
				'</deleteMetadataResponse></soapenv:Body></soapenv:Envelope>'
			);
			return res;
		}
	}

	private class HttpErrorMock implements HttpCalloutMock {
		public HttpResponse respond(HttpRequest req) {
			HttpResponse res = new HttpResponse();
			res.setStatusCode(500);
			res.setBody('Internal Server Error');
			return res;
		}
	}

	@isTest
	static void testDeleteRecordSuccess() {
		Test.setMock(HttpCalloutMock.class, new SuccessMock());
		Test.startTest();
		String result = CustomMetadataDelete.deleteRecord('Trigger_Action', 'Test_Action');
		Test.stopTest();
		System.assert(result.contains('Successfully deleted'), 'Should return success message');
	}

	@isTest
	static void testDeleteRecordEntityNotFound() {
		Test.setMock(HttpCalloutMock.class, new FailureMock());
		Test.startTest();
		Boolean threwExpectedException = false;
		try {
			CustomMetadataDelete.deleteRecord('Trigger_Action', 'Nonexistent');
		} catch (AuraHandledException e) {
			threwExpectedException = true;
		}
		Test.stopTest();
		System.assert(threwExpectedException, 'Should throw AuraHandledException for failed deletion');
	}

	@isTest
	static void testDeleteRecordHttpError() {
		Test.setMock(HttpCalloutMock.class, new HttpErrorMock());
		Test.startTest();
		Boolean threwExpectedException = false;
		try {
			CustomMetadataDelete.deleteRecord('Trigger_Action', 'Test_Action');
		} catch (AuraHandledException e) {
			threwExpectedException = true;
		}
		Test.stopTest();
		System.assert(threwExpectedException, 'Should throw AuraHandledException for HTTP error');
	}

	@isTest
	static void testDeleteTriggerActionBlankDevName() {
		Test.startTest();
		Boolean threwExpectedException = false;
		try {
			TriggerActionService.deleteTriggerAction('');
		} catch (AuraHandledException e) {
			threwExpectedException = true;
		}
		Test.stopTest();
		System.assert(threwExpectedException, 'Should throw for blank dev name');
	}

	@isTest
	static void testDeleteTriggerActionViaService() {
		Test.setMock(HttpCalloutMock.class, new SuccessMock());
		Test.startTest();
		String result = TriggerActionService.deleteTriggerAction('Test_Action');
		Test.stopTest();
		System.assert(result.contains('Successfully deleted'), 'Service should delegate to CustomMetadataDelete');
	}
}
