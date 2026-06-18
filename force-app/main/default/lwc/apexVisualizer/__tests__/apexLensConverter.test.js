import { convertApexToMermaid } from "../apexLensConverter";
import * as apexParser from "@apexdevtools/apex-parser";

describe("apexLensConverter", () => {
  beforeAll(() => {
    global.window = global.window || {};
    global.window.apexParser = apexParser;
  });

  it("should handle empty or null source code", () => {
    const result = convertApexToMermaid(null, "beforeInsert");
    expect(result.mermaidCode).toContain("No source code provided");
    expect(result.methods).toEqual([]);
  });

  it("should list all methods and default to the correct trigger event handler or the first method", () => {
    const code = `
      public class MyTriggerHandler {
        public void beforeInsert(List<Account> newAccounts) {
          System.debug('beforeInsert');
        }
        public void afterUpdate(List<Account> newAccounts, Map<Id, Account> oldAccounts) {
          System.debug('afterUpdate');
        }
        public void helperMethod() {
          System.debug('helper');
        }
      }
    `;

    const result = convertApexToMermaid(code, "afterUpdate");
    expect(result.methods).toContain("beforeInsert");
    expect(result.methods).toContain("afterUpdate");
    expect(result.methods).toContain("helperMethod");
    expect(result.selectedMethod).toBe("afterUpdate");
  });

  it("should parse an empty block", () => {
    const code = `
      public class MyTriggerHandler {
        public void beforeInsert(List<Account> newAccounts) {
        }
      }
    `;
    const result = convertApexToMermaid(code, "beforeInsert");
    expect(result.mermaidCode).toContain("METHOD_START --> METHOD_END");
  });

  it("should parse simple statements and assignments", () => {
    const code = `
      public class MyTriggerHandler {
        public void beforeInsert(List<Account> newAccounts) {
          Integer x = 5;
          x = x + 1;
        }
      }
    `;
    const result = convertApexToMermaid(code, "beforeInsert");
    expect(result.mermaidCode).toContain('action_2["Integer x = 5"]');
    expect(result.mermaidCode).toContain('action_1["x = x + 1"]');
  });

  it("should parse If statements with and without Else blocks", () => {
    const code = `
      public class MyTriggerHandler {
        public void beforeInsert(List<Account> newAccounts) {
          if (x > 0) {
            System.debug('positive');
          } else {
            System.debug('non-positive');
          }
        }
      }
    `;
    const result = convertApexToMermaid(code, "beforeInsert");
    expect(result.mermaidCode).toContain('choice_1{"IF"}');
    expect(result.mermaidCode).toContain('choice_1_Logic["(x > 0)"]');
    expect(result.mermaidCode).toContain("choice_1_Logic -.- choice_1");
    expect(result.mermaidCode).toContain("choice_1 -->|True| action_2");
    expect(result.mermaidCode).toContain("choice_1 -->|False| action_3");
  });

  it("should parse While and For loops", () => {
    const code = `
      public class MyTriggerHandler {
        public void beforeInsert(List<Account> newAccounts) {
          while (x < 10) {
            x++;
          }
          for (Account acc : newAccounts) {
            System.debug(acc.Name);
          }
        }
      }
    `;
    const result = convertApexToMermaid(code, "beforeInsert");
    expect(result.mermaidCode).toContain('loop_cond_3{"WHILE"}');
    expect(result.mermaidCode).toContain('loop_cond_3_Logic["(x < 10)"]');
    expect(result.mermaidCode).toContain("loop_cond_3_Logic -.- loop_cond_3");
    expect(result.mermaidCode).toContain('loop_cond_1{"FOR"}');
    expect(result.mermaidCode).toContain(
      'loop_cond_1_Logic["Account acc : newAccounts"]'
    );
    expect(result.mermaidCode).toContain("loop_cond_1_Logic -.- loop_cond_1");
  });

  it("should parse return statements", () => {
    const code = `
      public class MyTriggerHandler {
        public void beforeInsert(List<Account> newAccounts) {
          return;
        }
      }
    `;
    const result = convertApexToMermaid(code, "beforeInsert");
    expect(result.mermaidCode).toContain('return_1["return"]');
  });

  it("should style DML statements with the pink classDef", () => {
    const code = `
      public class MyTriggerHandler {
        public void beforeInsert(List<Account> newAccounts) {
          insert newAccounts;
          update oldAccounts;
        }
      }
    `;
    const result = convertApexToMermaid(code, "beforeInsert");
    expect(result.mermaidCode).toContain(
      'dml_2["DML ⚡\ninsert newAccounts;"]'
    );
    expect(result.mermaidCode).toContain("class dml_2 pink;");
  });

  it("should simplify SOQL queries and apply general truncation to long labels", () => {
    const code = `
      public class MyTriggerHandler {
        public void beforeInsert(List<Account> newAccounts) {
          for (Contact con : [SELECT Id, FirstName, LastName, Email, Title, Department FROM Contact WHERE AccountId IN :accIds ORDER BY LastName ASC]) {
            System.debug(con);
          }
          if (veryLongConditionThatExceedsOneHundredCharactersJustToTestWhetherTheSmartTruncationMechanismWorksFineAndSafelyTruncatesTheTextAtTheLimit) {
            System.debug('true');
          }
        }
      }
    `;
    const result = convertApexToMermaid(code, "beforeInsert");

    // Check that SOQL fields are simplified and formatted on newlines
    expect(result.mermaidCode).toContain("SELECT ...");
    expect(result.mermaidCode).toContain("FROM Contact");
    expect(result.mermaidCode).toContain("WHERE AccountId IN :accIds");
    expect(result.mermaidCode).toContain("ORDER BY LastName ASC");

    // Check that extremely long condition is wrapped onto multiple lines
    expect(result.mermaidCode).toContain(
      "veryLongConditionThatExceedsOneHundredCharactersJ"
    );
    expect(result.mermaidCode).toContain(
      "ustToTestWhetherTheSmartTruncationMechanismWorks"
    );
    expect(result.mermaidCode).toContain(
      "FineAndSafelyTruncatesTheTextAtTheLimit"
    );
  });

  it("should default to the method annotated with @InvocableMethod when targetMethodName is not found", () => {
    const code = `
      public class MyInvocableAction {
        public void helperMethod() {
          System.debug('helper');
        }
        @InvocableMethod(label='Perform Action')
        public static void executeAction() {
          System.debug('invocable');
        }
      }
    `;
    const result = convertApexToMermaid(code, "SomeUnknownParameterMethod");
    expect(result.selectedMethod).toBe("executeAction");
  });
});
