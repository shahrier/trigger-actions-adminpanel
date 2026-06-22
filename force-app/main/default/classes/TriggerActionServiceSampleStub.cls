/**
 * @group Trigger Actions Admin Panel
 * @description This sample stub class implements the TriggerAction.BeforeInsert interface.
 *
 * ### Why this class is required:
 * With the integration of PR #2, the `TriggerActionService.getAvailableApexClasses()` method
 * queries the Salesforce system object `ApexTypeImplementor` to discover concrete classes
 * implementing TriggerAction interfaces in the org.
 *
 * When Salesforce DX creates/promotes an unlocked package version, it spins up a completely
 * clean, empty scratch org containing ONLY the package's metadata and runs all tests. Because
 * the package itself does not define any real functional TriggerActions (it only contains
 * administrative and setup logic), the query to `ApexTypeImplementor` would return 0 rows in a clean
 * scratch org during the packaging run.
 *
 * This would cause the entire result mapping loop in `getAvailableApexClasses()` to be bypassed and
 * left uncovered, dragging down the package-wide code coverage below the 75% requirement.
 *
 * By packaging this dummy `TriggerActionServiceSampleStub` class, we guarantee that the
 * `ApexTypeImplementor` query returns at least one concrete result, ensuring full coverage
 * of the class discovery loops during package creation.
 */
public with sharing class TriggerActionServiceSampleStub implements TriggerAction.BeforeInsert {
  public void beforeInsert(List<SObject> newList) {
    // Stub implementation
  }
}
