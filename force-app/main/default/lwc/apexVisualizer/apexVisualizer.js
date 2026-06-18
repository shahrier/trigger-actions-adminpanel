import { LightningElement, api } from "lwc";
import { loadScript } from "lightning/platformResourceLoader";
import APEX_PARSER_RESOURCE from "@salesforce/resourceUrl/apexParser";
import getSessionId from "@salesforce/apex/OrgSessionController.getSessionId";
import getOrgDomainUrl from "@salesforce/apex/OrgSessionController.getOrgDomainUrl";
import { convertApexToMermaid } from "./apexLensConverter";

export default class ApexVisualizer extends LightningElement {
  @api className;
  @api apiVersion = "v66.0";

  error;
  isLoading = true;
  loadingMessage = "Loading parsing libraries...";

  _selectedMethod = "";

  @api
  get selectedMethod() {
    return this._selectedMethod;
  }
  set selectedMethod(value) {
    this._selectedMethod = value || "";
    if (this.classBody) {
      this.generateFlowchart();
    }
  }

  methodsList = [];

  classId;
  classBody;
  symbolTable;
  sessionId;
  orgDomainUrl;
  mermaidCode;
  isParserLoaded = false;
  _isDestroyed = false;

  get methodOptions() {
    return (this.methodsList || []).map((methodName) => {
      return { label: methodName, value: methodName };
    });
  }

  connectedCallback() {
    this._isDestroyed = false;
    this.loadLibraries();
  }

  disconnectedCallback() {
    this._isDestroyed = true;
  }

  async loadLibraries() {
    try {
      this.isLoading = true;
      this.error = null;

      if (!this.isParserLoaded) {
        // Load Certinia's Apex Parser script
        await loadScript(this, APEX_PARSER_RESOURCE);
        this.isParserLoaded = true;
      }

      if (!this.sessionId || !this.orgDomainUrl) {
        this.loadingMessage = "Authenticating session...";
        const [session, domain] = await Promise.all([
          getSessionId(),
          getOrgDomainUrl()
        ]);

        this.sessionId = session;
        this.orgDomainUrl = domain;
      }

      if (!this.sessionId) {
        throw new Error(
          "Failed to retrieve an active API session token. Please ensure your user has appropriate administrative rights."
        );
      }

      await this.fetchApexClass();
    } catch (err) {
      if (this._isDestroyed) return;
      this.error = err.message || err;
      this.isLoading = false;
    }
  }

  async fetchApexClass() {
    this.loadingMessage = "Fetching Apex class code and symbol table...";
    try {
      const query = `SELECT Id, Body, SymbolTable FROM ApexClass WHERE Name = '${this.className}'`;
      const url = `${this.orgDomainUrl}/services/data/${this.apiVersion}/tooling/query?q=${encodeURIComponent(query)}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.sessionId}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Tooling API query failed: ${errText}`);
      }

      const data = await response.json();
      if (!data.records || data.records.length === 0) {
        throw new Error(
          `Apex class "${this.className}" was not found in the org.`
        );
      }

      const record = data.records[0];
      this.classId = record.Id;
      this.classBody = record.Body;
      this.symbolTable = record.SymbolTable;

      this.generateFlowchart();
    } catch (err) {
      if (!this._isDestroyed) {
        this.error = `Tooling API fetch failed: ${err.message || err}`;
        this.isLoading = false;
      }
    }
  }

  generateFlowchart() {
    this.loadingMessage = "Generating flowchart diagram...";
    try {
      const result = convertApexToMermaid(this.classBody, this._selectedMethod);
      this.mermaidCode = result.mermaidCode;
      this._selectedMethod = result.selectedMethod;
      this.methodsList = result.methods;

      this.isLoading = false;
    } catch (err) {
      if (!this._isDestroyed) {
        this.error = `Flowchart generation failed: ${err.message || err}`;
        this.isLoading = false;
      }
    }
  }

  handleMethodChange(event) {
    this._selectedMethod = event.detail.value;
    this.isLoading = true;
    this.generateFlowchart();
  }

  handleRetry() {
    this.error = null;
    this.isLoading = true;
    this.loadLibraries();
  }
}
