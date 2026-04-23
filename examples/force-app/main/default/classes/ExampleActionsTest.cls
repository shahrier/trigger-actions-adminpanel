@IsTest
private class ExampleActionsTest {
	@IsTest
	static void testAccountAction() {
		Account acc = new Account(Name = 'Test Account');
		insert acc;
		
		acc = [SELECT Description FROM Account WHERE Id = :acc.Id];
		System.assert(acc.Description.contains('Trigger Actions Framework'), 'Description should be populated');
		
		acc.AnnualRevenue = -100;
		try {
			update acc;
			System.assert(false, 'Should have thrown an error for negative revenue');
		} catch (Exception e) {
			System.assert(e.getMessage().contains('Annual Revenue'), 'Error message should mention annual revenue');
		}
	}

	@IsTest
	static void testContactAction() {
		Contact con = new Contact(FirstName = 'Test', LastName = 'Contact');
		insert con;
		
		List<Task> tasks = [SELECT Subject FROM Task WHERE WhoId = :con.Id];
		System.assertEquals(1, tasks.size(), 'A task should have been created');
		System.assert(tasks[0].Subject.contains('Welcome Call'), 'Task subject should be correct');
	}

	@IsTest
	static void testOpportunityAction() {
		Opportunity opp = new Opportunity(
			Name = 'High Value Opp',
			StageName = 'Prospecting',
			CloseDate = Date.today().addDays(30),
			Amount = 200000
		);
		insert opp;
		
		opp = [SELECT Description FROM Opportunity WHERE Id = :opp.Id];
		System.assert(opp.Description.contains('High Value'), 'Description should have High Value flag');
	}
}
