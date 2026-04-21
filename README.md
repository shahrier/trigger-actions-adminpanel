# Trigger Actions Framework Admin Panel

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> [!IMPORTANT]
> **Prerequisite:** This project requires the [Trigger Actions Framework](https://github.com/mitchspano/trigger-actions-framework) to be installed in your org before deploying this Admin Panel.

## Installation

### Option 1: Unlocked Package Installation (Recommended)

> **Note:** Package links will be available once the first version is published. Check the [Releases](https://github.com/shahrier/trigger-actions-adminpanel/releases) page for the latest install URLs.

<!--
#### [Install in Production](https://login.salesforce.com/packaging/installPackage.apexp?p0=PACKAGE_VERSION_ID)
#### [Install in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=PACKAGE_VERSION_ID)
-->

### Option 2: Deploy from Source (GitHub)

<a href="https://githubsfdeploy.herokuapp.com?owner=shahrier&repo=trigger-actions-adminpanel&ref=main">
  <img alt="Deploy to Salesforce" src="https://raw.githubusercontent.com/afawcett/githubsfdeploy/master/deploy.png">
</a>

### Option 3: Deploy via Salesforce CLI

```bash
sf project deploy start --source-dir force-app --target-org YOUR_ORG_ALIAS
```

---

## Post-Installation Setup

After installing, complete these two required steps:

### Step 1: Update Remote Site Setting

The package includes a Remote Site Setting called **SelfOrg** that must be updated to match your org's domain:

1. Go to **Setup → Security → Remote Site Settings**
2. Click **Edit** next to **SelfOrg**
3. Replace the placeholder URL with your org's My Domain URL
   - Example: `https://yourcompany.my.salesforce.com`
   - You can find this under **Setup → My Domain**
4. Click **Save**

> [!WARNING]
> The **Delete** functionality for Trigger Actions will not work until this step is completed. Creating and editing actions will work without it.

### Step 2: Assign Permission Set

1. Go to **Setup → Users → Permission Sets**
2. Click **Trigger Actions Framework Admin**
3. Click **Manage Assignments → Add Assignments**
4. Select the users who should manage trigger actions
5. Click **Assign** then **Done**

---

## Overview

The **Trigger Actions Framework Admin Panel** provides a user-friendly admin console for managing trigger actions and configurations directly within Salesforce, without needing to access Setup or deploy metadata manually.

This guide walks you through:
- Installing and accessing the framework
- Assigning the required permission set
- Creating and managing Trigger Settings
- Creating and managing Trigger Actions
- Writing entry criteria formulas
- Using bypass mechanisms

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Post-Installation Setup](#post-installation-setup)
4. [Managing Trigger Settings](#managing-trigger-settings)
5. [Managing Trigger Actions](#managing-trigger-actions)
6. [Entry Criteria Formulas](#entry-criteria-formulas)
7. [Bypass Mechanisms](#bypass-mechanisms)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Salesforce org with API version 59.0+
- [Trigger Actions Framework](https://github.com/mitchspano/trigger-actions-framework) installed
- System Administrator access to deploy and configure metadata
- Basic understanding of Salesforce trigger concepts (Before/After Insert/Update/Delete)

---

## Launching the Application

1. From **App Launcher**, search for **"Trigger Actions Framework Admin"**
2. Click the app tile to open it
3. You should see two tabs: **Trigger Settings** and **Trigger Actions**

> **Note:** If you don't see the app, ensure the `TriggerActionsFrameworkAdmin` permission set is assigned (see [Post-Installation Setup](#post-installation-setup)).

---

## Managing Trigger Settings

Trigger Settings enable trigger execution for a specific SObject and define global-level bypass and permission configurations.

### Creating a New Trigger Setting

1. Open the **Trigger Actions Framework Admin** app
2. Click the **Trigger Settings** tab
3. Click the **Create** button
4. Fill in the form:
   - **SObject API Name** (required): The API name of the SObject (e.g., `Account`, `Opportunity`)
   - **Developer Name** (required): A unique identifier (no spaces, must start with letter, e.g., `Account_Setting`)
   - **Trigger Record Class Name** (optional): If you have a strongly-typed wrapper class extending `TriggerRecord`, enter it here
   - **Bypass Permission** (optional): Permission name to allow users to bypass ALL trigger actions on this SObject (e.g., `Bypass_Account_Triggers`)
   - **Required Permission** (optional): Permission name required to execute ANY trigger action on this SObject

5. Click **Save**

A deployment will begin (you'll see a notification). Within a few moments, the setting will appear in the list.

### Editing a Trigger Setting

1. Select a setting from the list (left side)
2. Click the **Edit** button
3. Modify the fields as needed
4. Click **Save**

### Viewing Related Trigger Actions

When you select a Trigger Setting, the **Detail View** (right side) displays:
- All configuration fields
- A **Related Trigger Actions** section showing all actions configured for this SObject
- Each action's Developer Name, Apex Class, and execution Order

### Deleting a Trigger Setting

1. Select the setting from the list
2. Click the **Delete** button
3. Confirm the deletion
4. The setting will be removed (this does NOT delete related trigger actions)

---

## Managing Trigger Actions

Trigger Actions are individual automations tied to a specific SObject trigger context (e.g., "Before Insert"). Each action points to an Apex class or Flow that implements the logic.

### Creating a New Trigger Action

1. Open the **Trigger Actions Framework Admin** app
2. Click the **Trigger Actions** tab
3. Click the **Create** button
4. Fill in the form:

   **Basic Fields:**
   - **SObject API Name** (required): Select the SObject from the dropdown (populated from Trigger Settings)
   - **Developer Name** (required): Unique identifier (e.g., `Account_ValidateName`)
   - **Apex Class Name** (required): The full class name implementing your action (e.g., `TA_Account_ValidateName`)
   - **Flow API Name** (optional): If executing a Flow, provide its API name (e.g., `Account_Logic_Flow`)

   **Execution Configuration:**
   - **Order** (required): Execution sequence (1, 2, 3, etc.). Actions execute in ascending order within the same context.
   
   **Trigger Contexts** (required - select at least one):
   - ✓ **Before Insert** - Runs before records are inserted
   - ✓ **After Insert** - Runs after records are inserted
   - ✓ **Before Update** - Runs before records are updated
   - ✓ **After Update** - Runs after records are updated
   - ✓ **Before Delete** - Runs before records are deleted
   - ✓ **After Delete** - Runs after records are deleted
   - ✓ **After Undelete** - Runs after records are restored

   **Optional Fields:**
   - **Entry Criteria Formula** (optional): Formula to conditionally execute this action per record (see [Entry Criteria Formulas](#entry-criteria-formulas))
   - **Description** (optional): Internal documentation of what this action does

5. Click **Save**

### Viewing Actions in Hierarchical View

By default, the Trigger Actions tab shows a **Hierarchical View**:
- SObjects are displayed as collapsible groups
- Actions under each SObject are sorted by Order
- Click on an action to view its full details

### Switching to Flat View

1. Under the toolbar, select **Flat View** radio button
2. All actions across all SObjects are displayed in a datatable
3. You can sort by any column

### Editing a Trigger Action

1. Select an action from either view
2. Click the **Edit** button
3. Modify fields (except Developer Name, which is read-only for edits)
4. Click **Save**

### Deleting a Trigger Action

1. Select an action
2. Click the **Delete** button
3. Confirm the deletion

---

## Entry Criteria Formulas

Entry Criteria allow you to conditionally execute trigger actions based on field values.

### Writing Entry Criteria

Entry Criteria are standard Salesforce formulas that evaluate to TRUE or FALSE for each record.

#### Simple Examples

```
// Only execute if Status is Active
Status__c == "Active"

// Only for large opportunities
Amount__c > 100000

// Only if neither field is blank
AND(NOT(ISBLANK(Field1__c)), NOT(ISBLANK(Field2__c)))
```

#### Complex Examples

```
// Execute if Status is Active AND (Industry is Technology OR Region is EMEA)
AND(Status__c == "Active", OR(Industry__c == "Technology", Region__c == "EMEA"))

// Execute if Phone is not blank but Email is blank
AND(NOT(ISBLANK(Phone)), ISBLANK(Email__c))

// Execute only for records created today
DATEVALUE(CreatedDate) = TODAY()
```

### Formula Reference

Common formula functions in Salesforce:

| Function | Example | Return |
|----------|---------|--------|
| `==` | `Status__c == "Active"` | Equality check |
| `!=` | `Status__c != "Inactive"` | Inequality check |
| `>`, `<`, `>=`, `<=` | `Amount__c > 5000` | Numeric comparisons |
| `AND()` | `AND(A, B)` | TRUE if all conditions TRUE |
| `OR()` | `OR(A, B)` | TRUE if any condition TRUE |
| `NOT()` | `NOT(ISBLANK(X))` | Negation |
| `ISBLANK()` | `ISBLANK(Email__c)` | Check if field is empty |
| `ISNULL()` | `ISNULL(Field__c)` | Check if NULL |
| `CONTAINS()` | `CONTAINS(Name, "Inc")` | String contains |
| `BEGINS()` | `BEGINS(Name, "Acme")` | String starts with |
| `INCLUDES()` | `INCLUDES(Industry__c, "Technology")` | Multi-select contains |

### Validation

When you save a Trigger Action with entry criteria:
- The formula is **not** validated until saved to Salesforce metadata
- Syntax errors will be displayed when you attempt to save
- Once saved, the formula will be evaluated for each record as actions execute

---

## Bypass Mechanisms

Bypass mechanisms allow administrators and users to temporarily disable trigger execution at various levels. The framework supports multiple bypass scopes:

### Global SObject Bypass (UI Checkbox)

In **Trigger Settings**, you can toggle `Bypass_Execution__c`:

1. Edit a Trigger Setting
2. Check "Bypass Execution" to disable ALL actions for that SObject
3. Save the change
4. No trigger actions will execute for records of that SObject until unchecked

### Permission-Based Bypass

Defined at two levels:

#### Bypass Permission (Trigger Setting level)

In **Trigger Settings**, set **Bypass Permission**:
- Any user with this permission can bypass ALL actions for this SObject
- Example: Assign "Bypass_Account_Triggers" permission; users with it bypass all Account triggers

#### Required Permission (Trigger Action level)

Not directly editable in the admin UI, but configured in Apex metadata.

### Transactional Bypass (Apex Code)

Developers can programmatically bypass actions using Apex:

```apex
// Bypass the TriggerAction class TA_Account_ValidateName for this transaction
MetadataTriggerHandler.bypass(TA_Account_ValidateName.class);

// ... perform DML ...

// Clear the bypass (optional; resets at transaction end)
MetadataTriggerHandler.clearBypass(TA_Account_ValidateName.class);
```

### Bypass via Flow

If using **TriggerActionFlow**, invoke these Flow actions to control bypass:

- **`TriggerActionFlowBypass`** - Bypass a specific action
- **`TriggerActionFlowClearBypass`** - Clear a specific bypass
- **`TriggerActionFlowClearAllBypasses`** - Clear all bypasses
- **`TriggerActionFlowIsBypassed`** - Check if an action is bypassed

---

## Best Practices

### 1. **Order Matters**

- Order actions logically: validations first, then updates, then notifications
- Use increments of 10 (10, 20, 30) to allow room for future inserts
- Example: Validate (Order 10) → Calculate (Order 20) → Notify (Order 30)

### 2. **Entry Criteria for Performance**

- Use entry criteria to avoid running expensive logic on every record
- This reduces CPU limits and improves performance

```
// Good: Only validate if Status changed
IF(CHANGE(Status__c), Status__c IN ("Active", "Closed"), FALSE)

// Avoid: Running complex logic for all records
```

### 3. **Naming Conventions**

- **Trigger Settings**: `{SObjectName}_Setting` (e.g., `Account_Setting`, `Opportunity_Setting`)
- **Trigger Actions**: `TA_{SObjectName}_{ActionDescription}` (e.g., `TA_Account_ValidateName`, `TA_Opp_RecalculateRevenue`)
- **Developer Names**: No spaces, start with letter, use underscores

### 4. **Documentation**

- Use **Description** field in Trigger Actions to describe the business purpose
- Example: "Validates Account Name is not blank and is unique within industry"

### 5. **Testing**

- Test entry criteria formulas carefully to ensure they work as expected
- Deploy to a sandbox first; test with real data
- Verify bypass mechanisms work correctly for your users

### 6. **Avoid Infinite Recursion**

- Use the framework's built-in recursion detection: each transaction can execute a trigger action only once
- Related records updates must use separate, non-triggering APIs (e.g., DML Finalizers)

### 7. **Version Control**

- Store Trigger Settings and Actions as metadata in your version control system
- Use Change Sets or deployment tools to migrate between orgs
- Document configuration changes in commit messages

---

## Troubleshooting

### Issue: App Not Visible in App Launcher

**Cause:** Permission set not assigned

**Solution:**
1. Ensure your user has the `TriggerActionsFrameworkAdmin` permission set assigned
2. Log out and back in
3. Try again

### Issue: "Apex Class Does Not Exist" Error When Creating Action

**Cause:** The Apex class name is incorrect or the class is not deployed

**Solution:**
1. Verify the class name exactly matches a deployed Apex class
2. Ensure the class is not in a namespace (or include the namespace prefix)
3. Redeploy the Apex class
4. Try creating the action again

### Issue: Entry Criteria Formula Gives Error on Save

**Cause:** Formula syntax is invalid

**Solution:**
1. Review formula syntax (see [Entry Criteria Formulas](#entry-criteria-formulas))
2. Common mistakes:
   - Missing closing parenthesis
   - Wrong field API name
   - Invalid comparison operators
3. Correct the formula and save again

### Issue: Trigger Actions Not Executing

**Cause:** Multiple possible root causes

**Troubleshooting Steps:**
1. Verify Trigger Setting exists for the SObject (check Trigger Settings tab)
2. Verify Trigger Action exists and is linked to correct SObject
3. Check if Bypass is enabled (look for warning badge in Trigger Settings detail)
4. Check if user has Required Permission (if set)
5. Verify Apex class is implemented correctly (extends `TriggerAction` interface)
6. Review Salesforce logs for Apex errors

### Issue: Delete Not Working (Remote Site Setting)

**Cause:** Remote Site Setting not configured for your org

**Solution:**
1. Go to **Setup → Security → Remote Site Settings**
2. Click **Edit** next to **SelfOrg**
3. Update the URL to your org's My Domain URL (e.g., `https://yourcompany.my.salesforce.com`)
4. Click **Save**

### Issue: Changes Not Visible Immediately

**Cause:** Metadata deployment is asynchronous

**Solution:**
1. Metadata changes deploy in about 1-2 minutes
2. Refresh the page to see updated list
3. If it's urgent, navigate away and back to the tab
4. Check deployment status in **Setup → Deployment Status** if needed

---

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Getting Help

For issues, questions, or contributions:
- Review the [Trigger Actions Framework documentation](https://github.com/mitchspano/trigger-actions-framework)
- [Open an issue](https://github.com/shahrier/trigger-actions-adminpanel/issues)
- Submit a pull request

---

**Version:** 1.0
