# Trigger Actions Framework Admin Panel

A lightweight, metadata-driven UI for managing the [Trigger Actions Framework](https://github.com/mitchspano/trigger-actions-framework). This tool allows administrators to configure trigger settings and actions directly in Salesforce without writing code or manual metadata deployments.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📺 Demo
*(Placeholder: How to use the Trigger Actions Admin Panel)*

> [!TIP]
> Use this tool to quickly visualize your trigger architecture, toggle bypasses, and adjust execution orders in real-time.

---

## 🚀 Installation

> [!IMPORTANT]
> **Prerequisite:** You must have the core [Trigger Actions Framework](https://github.com/mitchspano/trigger-actions-framework) installed in your org first.

### Option 1: Unlocked Package (Recommended)
*   [Install in Production / Developer Org](https://login.salesforce.com/packaging/installPackage.apexp?p0=04tgL000000EM8jQAG)
*   [Install in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04tgL000000EM8jQAG)

### Option 2: Deploy from Source
<a href="https://githubsfdeploy.herokuapp.com?owner=shahrier&repo=trigger-actions-adminpanel&ref=main">
  <img alt="Deploy to Salesforce" src="https://raw.githubusercontent.com/afawcett/githubsfdeploy/master/deploy.png">
</a>

---

## ⚙️ Post-Installation Setup

Assign the **Trigger Actions Framework Admin** permission set to any user who needs to manage trigger configurations.

1. Go to **Setup → Users → Permission Sets**.
2. Select **Trigger Actions Framework Admin**.
3. Click **Manage Assignments** and assign to your user(s).

---

## ✨ Features

### 1. Trigger Settings Management
Manage the global configuration for each SObject:
- **Enable/Disable**: Toggle trigger execution for the entire object.
- **Bypass Permissions**: Define specific permissions required to bypass actions.
- **Object Wrappers**: Configure custom Apex wrappers for your trigger records.

### 2. Trigger Actions Management
Configure individual automations within each trigger context:
- **Auto-Detection**: Select an Apex class, and the tool automatically detects which trigger interfaces (Before Insert, After Update, etc.) it implements.
- **Context Enforcement**: Ensures each record maps to exactly one execution context, preventing framework validation errors.
- **Execution Order**: Manually adjust the order of operations.
- **Formula-Based Entry Criteria**: Define conditional execution logic using standard Salesforce formula syntax.

### 3. Visual Transparency
- View your entire trigger hierarchy in a single, grouped view.
- Instantly identify which actions are bypassed or active.

---

## 📖 Framework Documentation
This tool is a management layer for the **Trigger Actions Framework**. For detailed documentation on how to write Action classes, complex bypass logic, or advanced framework features, please refer to the [official repository](https://github.com/mitchspano/trigger-actions-framework).

---

## 📝 Important Notes
- **Metadata Deployments**: Saving changes in the Admin Panel triggers a background metadata deployment. Changes typically take 5-10 seconds to reflect in the UI.
- **Deletion**: For security and stability, this panel does not support deleting records. Please use Salesforce Setup (Custom Metadata Types) or VS Code to remove configuration records.

---

## 🤝 Contributing
Contributions are welcome! Please feel free to open issues or submit pull requests to improve the Admin Panel.

---

**Version:** 1.0
