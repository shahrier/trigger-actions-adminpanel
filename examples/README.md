# Trigger Actions Admin Panel — Examples

This folder contains a hit-the-ground-running example to help you learn how the Trigger Actions Framework operates alongside the Admin Panel. 

It installs a ready-to-use **Account Trigger** accompanied by a sample Apex Action (`SampleAccountAction`) and all necessary metadata to make it visible in the Admin Panel immediately!

## Deploy via Salesforce CLI

If you have already installed the core packages and just want to push these specific examples to your scratch org or sandbox, run:
```bash
sf project deploy start -d examples/force-app
```

## What's Included?

1. **`AccountTrigger.trigger`**: A properly constructed 1-line trigger standardizing all events to the `MetadataTriggerHandler`.
2. **`SampleAccountAction.cls`**: An Apex class implementing `BeforeInsert` and `BeforeUpdate`.
    * *Before Insert*: Automatically populates a default description.
    * *Before Update*: Blocks the record from saving if the `AnnualRevenue` is set to a negative number.
3. **Trigger Settings & Actions Metadata**: We automatically register the Account object and the sample action to the framework so you can instantly see it rendered in the Trigger Actions Admin Panel UI.

## Testing it Out
1. Install the examples.
2. Open the **Trigger Actions Framework** app in your org.
3. Click "Account" on the left sidebar. You will see your new `SampleAccountAction` nicely configured!
4. Try creating an Account or updating an Account with negative revenue to see the framework dynamically execute your settings.
