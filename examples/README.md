# Trigger Actions Admin Panel — Examples

This folder contains a comprehensive set of examples to help you master the Trigger Actions Framework alongside the Admin Panel. 

## What's Included?

We've provided ready-to-use triggers and actions for three core objects to showcase different framework capabilities:

### 1. Account (Before Triggers)
*   **`SampleAccountAction.cls`**: 
    *   *Before Insert*: Automatically populates a default description.
    *   *Before Update*: Blocks saves if `AnnualRevenue` is negative.

### 2. Contact (After Triggers)
*   **`ContactTaskAction.cls`**:
    *   *After Insert*: Automatically creates a "Welcome Call" Task for the new Contact. Demonstrates cross-object automation.

### 3. Opportunity (Conditional Logic)
*   **`OpportunityStageAction.cls`**:
    *   *Before Insert*: Flags "High Value" opportunities (> $100k) by updating the description field.

---

## 🚀 Deployment

### Salesforce CLI
If you have the source locally, run:
```bash
sf project deploy start -d examples/force-app
```
---

## ⚙️ Testing the Demo
1. Open the **Trigger Actions Admin Panel** app.
2. Observe the sidebar: You now have **Account**, **Contact**, and **Opportunity** ready for management.
3. Click through the objects to see how different contexts (Before Insert, After Insert) are visualized.
4. Create a new Contact or a high-value Opportunity to see the framework execute the logic in real-time.
