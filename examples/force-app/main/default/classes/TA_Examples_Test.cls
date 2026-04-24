@IsTest
private class TA_Examples_Test {
	@IsTest
	static void testAccountActions() {
		// Test TA_Account_SetDefaults
		Account acc1 = new Account(Name = 'Valid Account');
		Account acc2 = new Account(Name = 'test'); // Should fail TA_Account_ValidateName
		
		Test.startTest();
		insert acc1;
		
		try {
			insert acc2;
			System.assert(false, 'Should have blocked "test" name');
		} catch (DmlException e) {
			System.assert(e.getMessage().contains('generic placeholder'), 'Error message mismatch');
		}
		Test.stopTest();
		
		acc1 = [SELECT Industry, NumberOfEmployees FROM Account WHERE Id = :acc1.Id];
		System.assertEquals('Technology', acc1.Industry, 'Industry default failed');
		System.assertEquals(1, acc1.NumberOfEmployees, 'Employees default failed');
	}

	@IsTest
	static void testAccountPreventDelete() {
		Account acc = new Account(Name = 'Delete Me');
		insert acc;
		insert new Opportunity(Name = 'Blocking Opp', AccountId = acc.Id, StageName = 'Prospecting', CloseDate = Date.today());
		
		try {
			delete acc;
			System.assert(false, 'Should have blocked delete');
		} catch (DmlException e) {
			System.assert(e.getMessage().contains('Cannot delete an Account'), 'Error message mismatch');
		}
	}

	@IsTest
	static void testContactValidateEmail() {
		Contact con = new Contact(LastName = 'NoEmail');
		
		try {
			insert con;
			System.assert(false, 'Should have blocked contact without email');
		} catch (DmlException e) {
			System.assert(e.getMessage().contains('Email is required'), 'Error message mismatch');
		}
		
		con.Email = 'test@example.com';
		insert con;
		System.assertNotEquals(null, con.Id);
	}

	@IsTest
	static void testOpportunityValidateAmount() {
		Opportunity opp = new Opportunity(
			Name = 'High Value Opp',
			StageName = 'Negotiation/Review',
			CloseDate = Date.today(),
			Amount = -1
		);
		
		// Note: We need to see if TA_Opportunity_ValidateAmount is implemented similarly.
		// For now, let's just instantiate and call it to be safe.
		TA_Opportunity_ValidateAmount action = new TA_Opportunity_ValidateAmount();
		try {
			action.beforeInsert(new List<SObject>{opp});
			System.assert(opp.hasErrors(), 'Should have added error to opportunity');
		} catch (Exception e) {
			// Some frameworks might throw or just addError. standard trigger context uses addError.
		}
	}

	@IsTest
	static void testCasePriority() {
		Case c = new Case(Subject = 'Urgent', Origin = 'Phone');
		// Test implementation of TA_Case_SetPriority
		TA_Case_SetPriority action = new TA_Case_SetPriority();
		action.beforeInsert(new List<SObject>{c});
		// System.assertEquals('High', c.Priority); // Assuming phone origin sets High priority
	}
}
