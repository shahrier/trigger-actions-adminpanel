import { convertFlowToMermaid } from "c/flowLensConverter";

describe("flowLensConverter", () => {
  // ─── Minimal Flow ───────────────────────────────────────────────
  describe("convertFlowToMermaid - minimal flow", () => {
    it("should generate valid Mermaid syntax for an empty flow", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        label: "Empty Flow",
        start: {
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow, "Empty Flow");

      expect(result).toContain("flowchart TD");
      expect(result).toContain('title: "Empty Flow"');
      expect(result).toContain("FLOW_START");
      expect(result).toContain("Process Type: AutoLaunchedFlow");
    });

    it("should use the provided flowLabel for the title", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        label: "Internal Label",
        start: {}
      };

      const result = convertFlowToMermaid(flow, "Custom Title");
      expect(result).toContain('title: "Custom Title"');
    });

    it("should fall back to flow.label when flowLabel is not provided", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        label: "Fallback Label",
        start: {}
      };

      const result = convertFlowToMermaid(flow, "");
      expect(result).toContain('title: "Fallback Label"');
    });

    it("should omit the title block when includeTitle is false", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        label: "Fallback Label",
        start: {}
      };

      const result = convertFlowToMermaid(flow, "Custom Title", false);
      expect(result).not.toContain("title:");
      expect(result.startsWith("---")).toBe(false);
      expect(result).toContain("flowchart TD");
    });
  });

  // ─── Class Definitions ──────────────────────────────────────────
  describe("classDef output", () => {
    it("should always emit the four color class definitions", () => {
      const flow = { start: {}, processType: "AutoLaunchedFlow" };
      const result = convertFlowToMermaid(flow);

      expect(result).toContain("classDef pink fill:#F43F5E, color:#ffffff");
      expect(result).toContain("classDef orange fill:#F97316, color:#ffffff");
      expect(result).toContain("classDef navy fill:#475569, color:#ffffff");
      expect(result).toContain("classDef blue fill:#0284C7, color:#ffffff");
    });
  });

  // ─── Flow Start with entry criteria ─────────────────────────────
  describe("Flow Start node", () => {
    it("should include trigger type and object details", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          triggerType: "RecordAfterSave",
          object: "Account",
          recordTriggerType: "CreateAndUpdate",
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Trigger: After Save");
      expect(result).toContain("Object: Account");
      expect(result).toContain("Event: Created or Updated");
    });

    it("should include filter criteria when present", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          triggerType: "RecordAfterSave",
          object: "Account",
          filterLogic: "1 AND 2",
          filters: [
            {
              field: "Name",
              operator: "EqualTo",
              value: { stringValue: "Test" }
            },
            {
              field: "Active__c",
              operator: "EqualTo",
              value: { booleanValue: true }
            }
          ],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Filter Logic: 1 AND 2");
      expect(result).toContain("1. Name == 'Test'");
      expect(result).toContain("2. Active__c == true");
    });

    it("should handle a single filter (not array)", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          filterLogic: "1",
          filters: {
            field: "Status",
            operator: "EqualTo",
            value: { stringValue: "Active" }
          },
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);
      expect(result).toContain("1. Status == 'Active'");
    });

    it("should include schedule details when present", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          schedule: {
            frequency: "Daily",
            startDate: "2026-01-01",
            startTime: "08:00:00.000Z"
          },
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);
      expect(result).toContain(
        "Schedule: Daily starting 2026-01-01 at 08:00:00.000Z"
      );
    });
  });

  // ─── Assignment Node ────────────────────────────────────────────
  describe("Assignment node", () => {
    it("should render assignment items with operator shorthand", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "Set_Name" }
        },
        assignments: {
          name: "Set_Name",
          label: "Set Name",
          assignmentItems: {
            assignToReference: "record.Name",
            operator: "Assign",
            value: { stringValue: "Hello" }
          },
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Assignment 📝");
      expect(result).toContain("Set Name");
      expect(result).toContain("record.Name = 'Hello'");
      expect(result).toContain("class Set_Name orange");
    });

    it("should handle multiple assignment items", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "MultiAssign" }
        },
        assignments: {
          name: "MultiAssign",
          label: "Multi Assign",
          assignmentItems: [
            {
              assignToReference: "var1",
              operator: "Assign",
              value: { stringValue: "A" }
            },
            {
              assignToReference: "var2",
              operator: "Add",
              value: { numberValue: 5 }
            }
          ],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);
      expect(result).toContain("var1 = 'A'");
      expect(result).toContain("var2 += 5");
    });
  });

  // ─── Decision Node ──────────────────────────────────────────────
  describe("Decision node", () => {
    it("should render decision rules with conditions", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "MyDecision" }
        },
        decisions: {
          name: "MyDecision",
          label: "Check Status",
          defaultConnector: null,
          defaultConnectorLabel: "Default",
          rules: {
            name: "IsActive",
            label: "Is Active",
            conditionLogic: "and",
            conditions: {
              leftValueReference: "record.IsActive",
              operator: "EqualTo",
              rightValue: { booleanValue: true }
            },
            connector: null
          }
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Decision 🔹");
      expect(result).toContain("Check Status");
      expect(result).toContain("IF");
      expect(result).toContain("record.IsActive == true");
    });

    it("should encode pipes and quotes in outcome labels so the edge syntax is not broken", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "MyDecision" }
        },
        decisions: {
          name: "MyDecision",
          label: "Check Status",
          defaultConnector: { targetReference: "Wrap" },
          defaultConnectorLabel: "Default",
          rules: {
            name: "VIP",
            // Admin-authored outcome label containing Mermaid-breaking chars.
            label: 'Amount > 1000 | "VIP"',
            conditionLogic: "and",
            conditions: {
              leftValueReference: "record.IsActive",
              operator: "EqualTo",
              rightValue: { booleanValue: true }
            },
            connector: { targetReference: "Wrap" }
          }
        },
        assignments: {
          name: "Wrap",
          label: "Wrap",
          assignmentItems: [],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      // Pipe encoded, quotes normalized — all in the rendered edge label.
      expect(result).toContain("Amount > 1000 #124; 'VIP'");
      // No raw pipe from the label leaking into the edge syntax.
      expect(result).not.toContain('1000 | "VIP"');
      expect(result).not.toContain('"VIP"');
    });

    it("should render decision rules with AND logic and single quoted string literals", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "MyDecision" }
        },
        decisions: {
          name: "MyDecision",
          label: "Check Status",
          defaultConnector: null,
          defaultConnectorLabel: "Default",
          rules: {
            name: "IsActive",
            label: "Is Active",
            conditionLogic: "and",
            conditions: [
              {
                leftValueReference: "record.IsActive",
                operator: "EqualTo",
                rightValue: { booleanValue: true }
              },
              {
                leftValueReference: "record.Type",
                operator: "EqualTo",
                rightValue: { stringValue: "Vendor" }
              }
            ],
            connector: null
          }
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("IF (All)");
      expect(result).toContain("1. record.IsActive == true");
      expect(result).toContain("2. record.Type == 'Vendor'");
      expect(result).not.toContain("Logic: AND");
    });

    it("should render decision rules with OR logic and empty right-hand values as null", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "MyDecision" }
        },
        decisions: {
          name: "MyDecision",
          label: "Check Status",
          defaultConnector: null,
          defaultConnectorLabel: "Default",
          rules: {
            name: "IsActive",
            label: "Is Active",
            conditionLogic: "or",
            conditions: [
              {
                leftValueReference: "record.Customer",
                operator: "EqualTo",
                rightValue: null
              },
              {
                leftValueReference: "record.Vendor",
                operator: "NotEqualTo",
                rightValue: {}
              }
            ],
            connector: null
          }
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("IF (Any)");
      expect(result).toContain("1. record.Customer == null");
      expect(result).toContain("2. record.Vendor != null");
      expect(result).not.toContain("Logic: OR");
    });

    it("should render decision rules with custom logic", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "MyDecision" }
        },
        decisions: {
          name: "MyDecision",
          label: "Check Status",
          defaultConnector: null,
          defaultConnectorLabel: "Default",
          rules: {
            name: "IsActive",
            label: "Is Active",
            conditionLogic: "1 AND (2 OR 3)",
            conditions: [
              {
                leftValueReference: "a",
                operator: "EqualTo",
                rightValue: { numberValue: 1 }
              },
              {
                leftValueReference: "b",
                operator: "EqualTo",
                rightValue: { numberValue: 2 }
              },
              {
                leftValueReference: "c",
                operator: "EqualTo",
                rightValue: { numberValue: 3 }
              }
            ],
            connector: null
          }
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("IF (1 AND (2 OR 3))");
      expect(result).toContain("1. a == 1");
      expect(result).toContain("2. b == 2");
      expect(result).toContain("3. c == 3");
      expect(result).not.toContain("Logic: 1 AND (2 OR 3)");
    });
  });

  // ─── Loop Node ──────────────────────────────────────────────────
  describe("Loop node", () => {
    it("should render loop with for-each and after-all transitions", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "MyLoop" }
        },
        loops: {
          name: "MyLoop",
          label: "Loop Records",
          nextValueConnector: { targetReference: "DoWork" },
          noMoreValuesConnector: null
        },
        assignments: {
          name: "DoWork",
          label: "Do Work",
          assignmentItems: [],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Loop 🔄");
      expect(result).toContain("Loop Records");
      expect(result).toContain("FLOW_START --> MyLoop");
      expect(result).toContain("MyLoop -->| for each | DoWork");
    });
  });

  // ─── Record Lookup Node ─────────────────────────────────────────
  describe("Record Lookup node", () => {
    it("should render sObject, queried fields, and filter details", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "GetAccount" }
        },
        recordLookups: {
          name: "GetAccount",
          label: "Get Account",
          object: "Account",
          queriedFields: ["Name", "Industry"],
          filterLogic: "1",
          filters: {
            field: "Id",
            operator: "EqualTo",
            value: { elementReference: "recordId" }
          },
          getFirstRecordOnly: true,
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Get Account 🔍");
      expect(result).toContain("SELECT Name, Industry");
      expect(result).toContain("WHERE");
      expect(result).toContain("Id == recordId");
      expect(result).toContain("LIMIT 1");
      expect(result).toContain("class GetAccount pink");
    });

    it("should render lookup filters with logic embedded in WHERE header", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "GetAccount" }
        },
        recordLookups: {
          name: "GetAccount",
          label: "Get Account",
          object: "Account",
          queriedFields: ["Name"],
          filterLogic: "and",
          filters: [
            {
              field: "Industry",
              operator: "EqualTo",
              value: { stringValue: "Apparel" }
            },
            {
              field: "Rating",
              operator: "EqualTo",
              value: { stringValue: "Hot" }
            }
          ],
          getFirstRecordOnly: true,
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("WHERE (All)");
      expect(result).toContain("1. Industry == 'Apparel'");
      expect(result).toContain("2. Rating == 'Hot'");
      expect(result).not.toContain("Logic: AND");
    });
  });

  // ─── Record Update Node ─────────────────────────────────────────
  describe("Record Update node", () => {
    it("should render field updates and filter criteria", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "UpdateAcct" }
        },
        recordUpdates: {
          name: "UpdateAcct",
          label: "Update Account",
          object: "Account",
          inputAssignments: {
            field: "Description",
            value: { stringValue: "Updated" }
          },
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Update Account ✏️");
      expect(result).toContain("SET");
      expect(result).toContain("Description = 'Updated'");
      expect(result).toContain("class UpdateAcct pink");
    });

    it("should render without trailing separator when assignments and filters are empty", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "UpdateOpportunity" }
        },
        recordUpdates: {
          name: "UpdateOpportunity",
          label: "Update Opportunity",
          inputReference: "$Record",
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      // Verify header is outputted correctly
      expect(result).toContain("Update Reference:");
      expect(result).toContain("$Record ✏️");
      expect(result).toContain("Update Opportunity");
      // Verify no trailing separator is outputted
      expect(result).not.toContain('Update Opportunity\n---"]');
    });

    it("should render Record Create without trailing separator when assignments are empty", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "CreateOpportunity" }
        },
        recordCreates: {
          name: "CreateOpportunity",
          label: "Create Opportunity",
          inputReference: "$Record",
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Create Reference:");
      expect(result).toContain("$Record ➕");
      expect(result).toContain("Create Opportunity");
      expect(result).not.toContain('Create Opportunity\n---"]');
    });

    it("should render Record Delete without trailing separator when filters are empty", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "DeleteOpportunity" }
        },
        recordDeletes: {
          name: "DeleteOpportunity",
          label: "Delete Opportunity",
          inputReference: "$Record",
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain(
        'DeleteOpportunity["Delete Reference: $Record 🗑️\nDelete Opportunity"]'
      );
      expect(result).not.toContain(
        'DeleteOpportunity["Delete Reference: $Record 🗑️\nDelete Opportunity\n---"]'
      );
    });
  });

  // ─── Action Call Node ───────────────────────────────────────────
  describe("Action Call node", () => {
    it("should render action calls with navy color", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "CallApex" }
        },
        actionCalls: {
          name: "CallApex",
          label: "Invoke Apex",
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Action Call ⚡");
      expect(result).toContain("Invoke Apex");
      expect(result).toContain("class CallApex navy");
    });

    it("should render input and output parameters", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "CallApex" }
        },
        actionCalls: {
          name: "CallApex",
          label: "Invoke Apex",
          actionType: "apex",
          actionName: "DnBCustomerCreditValidation",
          inputParameters: [
            {
              name: "requestedAmount",
              value: { elementReference: "varRequestedAmount" }
            }
          ],
          outputParameters: [
            {
              assignToReference: "varCreditLimitFinal",
              name: "creditLimit"
            }
          ],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("INPUTS:");
      expect(result).toContain("• requestedAmount = varRequestedAmount");
      expect(result).toContain("OUTPUTS:");
      expect(result).toContain("• varCreditLimitFinal = creditLimit");
    });
  });

  // ─── Screen Node ────────────────────────────────────────────────
  describe("Screen node", () => {
    it("should render screen nodes with blue color", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "InputScreen" }
        },
        screens: {
          name: "InputScreen",
          label: "User Input",
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Screen 💻");
      expect(result).toContain("User Input");
      expect(result).toContain("class InputScreen blue");
    });
  });

  // ─── Transitions ────────────────────────────────────────────────
  describe("Transitions", () => {
    it("should generate a basic start → node → END chain", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "Step1" }
        },
        assignments: {
          name: "Step1",
          label: "Step One",
          assignmentItems: [],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("FLOW_START --> Step1");
    });

    it("should render fault transitions with error indicators", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "CreateRec" }
        },
        recordCreates: {
          name: "CreateRec",
          label: "Create Record",
          connector: null,
          faultConnector: { targetReference: "HandleError" }
        },
        assignments: {
          name: "HandleError",
          label: "Handle Error",
          assignmentItems: [],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("FLOW_START --> CreateRec");
      expect(result).toContain("CreateRec -->|❌ Fault ❌| HandleError");
    });

    it("should render decision branch labels", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "BranchDecision" }
        },
        decisions: {
          name: "BranchDecision",
          label: "Which Path",
          defaultConnector: null,
          defaultConnectorLabel: "Otherwise",
          rules: [
            {
              name: "PathA",
              label: "Path A",
              conditionLogic: "and",
              conditions: {
                leftValueReference: "x",
                operator: "EqualTo",
                rightValue: { numberValue: 1 }
              },
              connector: { targetReference: "DoA" }
            }
          ]
        },
        assignments: {
          name: "DoA",
          label: "Do A",
          assignmentItems: [],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("BranchDecision -->| Path A | DoA");
    });
  });

  // ─── Sanitization ───────────────────────────────────────────────
  describe("Sanitization", () => {
    it("should sanitize double quotes in labels", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "QuoteNode" }
        },
        assignments: {
          name: "QuoteNode",
          label: 'Has "Quotes" Inside',
          assignmentItems: [],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      // Double quotes should be replaced with single quotes
      expect(result).not.toContain('"Has "Quotes"');
      expect(result).toContain("Has 'Quotes' Inside");
    });

    it("should sanitize special characters in node IDs", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "Node.With-Special_Chars" }
        },
        assignments: {
          name: "Node.With-Special_Chars",
          label: "Special Node",
          assignmentItems: [],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      // Dots and hyphens in IDs should be replaced with underscores
      expect(result).toContain("Node_With_Special_Chars");
      expect(result).not.toMatch(/state.*Node\.With/);
    });
  });

  // ─── Deduplication ──────────────────────────────────────────────
  describe("Label deduplication", () => {
    it("should not duplicate type and label when they are identical", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      // The FLOW_START node has type="Flow Start" and label="Flow Start"
      // It should NOT render "Flow Start\nFlow Start"
      expect(result).toContain('FLOW_START(["Flow Start ➡️"])');
    });
  });

  // ─── Complex Flow (integration) ─────────────────────────────────
  describe("Complex flow integration", () => {
    it("should handle a multi-step flow with decisions, loops, and DML", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        label: "Complex Flow",
        start: {
          triggerType: "RecordAfterSave",
          object: "Contact",
          recordTriggerType: "Create",
          connector: { targetReference: "CheckStatus" }
        },
        decisions: {
          name: "CheckStatus",
          label: "Check Status",
          defaultConnector: null,
          defaultConnectorLabel: "Default Path",
          rules: {
            name: "IsNew",
            label: "Is New Contact",
            conditionLogic: "and",
            conditions: {
              leftValueReference: "record.Status__c",
              operator: "EqualTo",
              rightValue: { stringValue: "New" }
            },
            connector: { targetReference: "LoopContacts" }
          }
        },
        loops: {
          name: "LoopContacts",
          label: "Loop Contacts",
          nextValueConnector: { targetReference: "UpdateRec" },
          noMoreValuesConnector: null
        },
        recordUpdates: {
          name: "UpdateRec",
          label: "Update Record",
          object: "Contact",
          inputAssignments: {
            field: "Status__c",
            value: { stringValue: "Processed" }
          },
          connector: { targetReference: "LoopContacts" }
        }
      };

      const result = convertFlowToMermaid(flow);

      // Verify structure
      expect(result).toContain("flowchart TD");
      expect(result).toContain("FLOW_START --> CheckStatus");
      expect(result).toContain(
        "CheckStatus -->| Is New Contact | LoopContacts"
      );
      expect(result).toContain("LoopContacts -->| for each | UpdateRec");
      expect(result).toContain("UpdateRec --> LoopContacts");

      // Verify node types
      expect(result).toContain("Decision 🔹");
      expect(result).toContain("Loop 🔄");
      expect(result).toContain("Update Contact ✏️");

      // Verify transitions labels
      expect(result).toContain("Is New Contact");
      expect(result).toContain("for each");
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────
  describe("Edge cases", () => {
    it("should handle a flow with no start node gracefully", () => {
      const flow = {
        processType: "AutoLaunchedFlow"
      };

      // Should not throw
      expect(() => convertFlowToMermaid(flow)).not.toThrow();
      const result = convertFlowToMermaid(flow);
      expect(result).toContain("flowchart TD");
    });

    it("should handle value types: numberValue, booleanValue, dateValue", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "TestAssign" }
        },
        assignments: {
          name: "TestAssign",
          label: "Test Values",
          assignmentItems: [
            {
              assignToReference: "numVar",
              operator: "Assign",
              value: { numberValue: 42 }
            },
            {
              assignToReference: "boolVar",
              operator: "Assign",
              value: { booleanValue: false }
            }
          ],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("numVar = 42");
      expect(result).toContain("boolVar = false");
    });

    it("should handle a subflow node", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "CallSubflow" }
        },
        subflows: {
          name: "CallSubflow",
          label: "Invoke Child Flow",
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Subflow ➡️");
      expect(result).toContain("Invoke Child Flow");
      expect(result).toContain("class CallSubflow navy");
    });

    it("should handle subflow inputs and outputs", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "CallSubflow" }
        },
        subflows: {
          name: "CallSubflow",
          label: "Invoke Child Flow",
          flowName: "Subflow_Name",
          inputAssignments: [
            {
              inputParameterName: "inParam",
              value: { stringValue: "hello" }
            }
          ],
          outputAssignments: [
            {
              assignToReference: "outVar",
              outputParameterName: "outParam"
            }
          ],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Subflow ➡️");
      expect(result).toContain("Invoke Child Flow");
      expect(result).toContain("INPUTS:");
      expect(result).toContain("• inParam = 'hello'");
      expect(result).toContain("OUTPUTS:");
      expect(result).toContain("• outVar = outParam");
    });

    it("should handle a wait node", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "WaitNode" }
        },
        waits: {
          name: "WaitNode",
          label: "Wait for Approval",
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);

      expect(result).toContain("Wait ⏳");
      expect(result).toContain("Wait for Approval");
    });

    it("should handle values with null properties from Tooling API by falling through correctly", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "TestAssign" }
        },
        assignments: {
          name: "TestAssign",
          label: "Test Values",
          assignmentItems: [
            {
              assignToReference: "refVar",
              operator: "Assign",
              value: {
                stringValue: null,
                booleanValue: null,
                numberValue: null,
                elementReference: "record.AccountId"
              }
            }
          ],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);
      expect(result).toContain("refVar = record.AccountId");
      expect(result).not.toContain("refVar = 'null'");
    });

    it("should render null (unquoted) when all value properties are null", () => {
      const flow = {
        processType: "AutoLaunchedFlow",
        start: {
          connector: { targetReference: "TestAssign" }
        },
        assignments: {
          name: "TestAssign",
          label: "Test Values",
          assignmentItems: [
            {
              assignToReference: "nullVar",
              operator: "Assign",
              value: {
                stringValue: null,
                booleanValue: null,
                numberValue: null,
                elementReference: null
              }
            }
          ],
          connector: null
        }
      };

      const result = convertFlowToMermaid(flow);
      expect(result).toContain("nullVar = null");
      expect(result).not.toContain("nullVar = 'null'");
    });
  });

  // ─── Unsupported / unknown elements ─────────────────────────────
  describe("unsupported elements", () => {
    it("renders a placeholder for a connector target that has no matching element instead of rerouting to End", () => {
      // Start connects to "MysteryElement", which is not one of the element
      // arrays the converter collects (simulates a new/unsupported Flow type).
      const flow = {
        processType: "AutoLaunchedFlow",
        label: "Has Unknown",
        start: {
          connector: { targetReference: "MysteryElement" }
        }
      };

      const result = convertFlowToMermaid(flow);

      // The unknown element is surfaced, not dropped.
      expect(result).toContain("Unsupported Element");
      expect(result).toContain("MysteryElement");
      // The edge points at the placeholder, not straight to End.
      expect(result).toContain("FLOW_START -->");
      expect(result).not.toMatch(/FLOW_START -->\s*FLOW_END/);
    });
  });
});
