# Trigger Actions Admin Panel — Examples

This folder contains a robust and comprehensive set of examples to help you master the **Trigger Actions Framework** alongside the **Admin Panel**. 

## ✨ What's Included?

We've provided ready-to-use actions for core objects, showcasing the framework's power and the `TA_` naming convention (`TA_[Object]_[Action]`).

### 🏦 Account
*   **`TA_Account_PreventDelete`**: Blocks deletion of Accounts with related Opportunities.
*   **`TA_Account_SetDefaults`**: Automatically populates standard fields on insert.
*   **`TA_Account_ValidateName`**: Enforces naming standards for new Accounts.

### 💼 Case
*   **`TA_Case_Lifecycle`**: Manages status transitions and timestamps.
*   **`TA_Case_SetPriority`**: Automatically prioritizes cases based on origin or type.

### 👤 Contact
*   **`TA_Contact_StampAddress`**: Synchronizes address information from the parent Account.
*   **`TA_Contact_ValidateEmail`**: Ensures all Contacts have a valid email format.

### 🎯 Lead
*   **`TA_Lead_CreateFollowUp`**: Generates a Task for the owner when a Lead is created.
*   **`TA_Lead_EnrichData`**: Populates industry or source data via external logic.

### 💰 Opportunity
*   **`TA_Opportunity_NotifyOwner`**: Sends custom notifications on major stage changes.
*   **`TA_Opportunity_PreventDelete`**: Prevents deletion of closed-won opportunities.
*   **`TA_Opportunity_SetDefaults`**: Sets default close dates and stages.
*   **`TA_Opportunity_UpdateAccount`**: Rolls up key metrics to the parent Account.
*   **`TA_Opportunity_ValidateAmount`**: Blocks saves if the amount is missing for high-value stages.

---

## 🚀 Deployment

### 1. Deploy New Actions
To deploy these examples to your org:
```bash
sf project deploy start -d examples/force-app
```

### 2. Cleanup Legacy Examples
If you previously had the old sample classes installed, run the destructive deployment:
```bash
sf project deploy start --manifest manifest/package.xml --destructive-changes-post manifest/destructiveChanges.xml
```

---

## ⚙️ Testing the Demo
1. Open the **Trigger Actions Admin Panel** app.
2. Observe the sidebar: You'll see the objects ready for management.
3. Use the Admin Panel to toggle these actions on or off across different trigger contexts (Before Insert, After Update, etc.).
4. Perform data operations (e.g., delete an Account with an Opp) to see the framework execute the logic in real-time.
