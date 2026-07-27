import { LightningElement, api, track } from "lwc";
import getCoworkerStatus from "@salesforce/apex/AgentforceController.getCoworkerStatus";
import explainArtifact from "@salesforce/apex/AgentforceController.explainArtifact";

export default class AgentforceAssistant extends LightningElement {
  _isOpen = false;
  @api
  get isOpen() {
    return this._isOpen;
  }
  set isOpen(value) {
    const wasOpen = this._isOpen;
    this._isOpen = value;
    if (value && !wasOpen) {
      this.scheduleAnalysis();
    }
  }

  _artifactName = "";
  @api
  get artifactName() {
    return this._artifactName;
  }
  set artifactName(value) {
    const previous = this._artifactName;
    this._artifactName = value || "";
    if (this._artifactName !== previous) {
      this.scheduleAnalysis();
    }
  }

  _artifactPayload = "";
  @api
  get artifactPayload() {
    return this._artifactPayload;
  }
  set artifactPayload(value) {
    const previous = this._artifactPayload;
    this._artifactPayload = value || "";
    if (this._artifactPayload !== previous) {
      this.scheduleAnalysis();
    }
  }

  @api artifactType = "APEX";

  // Findings computed deterministically from metadata rather than generated.
  // They are rendered separately so they are never at the mercy of the model
  // choosing to repeat them, and are labelled so users know they are exact.
  @api verifiedFindings = "";

  @track status = null;
  @track explanationText = "";
  @track isLoading = false;

  _analysisScheduled = false;
  _requestId = 0;

  // The artifact type doubles as the prompt selector, so map the internal
  // values onto something readable before showing them in the header.
  get artifactTypeLabel() {
    switch ((this.artifactType || "").toUpperCase()) {
      case "OBJECT_DEEP":
        return "DEEP OBJECT AUDIT";
      case "OBJECT":
        return "OBJECT AUDIT";
      default:
        return `${this.artifactType} ARTIFACT`;
    }
  }

  get statusBadgeClass() {
    return this.status && this.status.isAvailable
      ? "badge-active"
      : "badge-inactive";
  }

  get statusBadgeLabel() {
    return this.status && this.status.isAvailable
      ? "Agentforce Active"
      : "Environment Info";
  }

  /**
   * Models frequently wrap an entire markdown answer in a ```markdown fence.
   * Left in place it would render as one big code block, so unwrap it — but
   * only when the fence really does enclose the whole response.
   */
  stripOuterFence(text) {
    const trimmed = (text || "").trim();
    const match = trimmed.match(/^```(markdown|md)?[ \t]*\n([\s\S]*?)\n?```$/i);
    if (!match) return text;
    // An unlabeled fence is only unwrapped when the content is clearly prose.
    if (!match[1] && !/^#{1,6}[ \t]/m.test(match[2])) return text;
    return match[2];
  }

  parseMarkdown(text) {
    if (!text) return "";
    let formatted = this.stripOuterFence(text);

    // Fenced Code blocks ```lang ... ```
    formatted = formatted.replace(
      /```[a-z]*\n([\s\S]*?)\n```/gim,
      (match, code) => {
        const escaped = code
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<pre class="code-block"><code>${escaped}</code></pre>`;
      }
    );

    // Headings (##### down to #)
    formatted = formatted.replace(
      /^#####[ \t]+(.*$)/gim,
      '<h5 class="markdown-h5">$1</h5>'
    );
    formatted = formatted.replace(
      /^####[ \t]+(.*$)/gim,
      '<h4 class="markdown-h4">$1</h4>'
    );
    formatted = formatted.replace(
      /^###[ \t]+(.*$)/gim,
      '<h3 class="markdown-h3">$1</h3>'
    );
    formatted = formatted.replace(
      /^##[ \t]+(.*$)/gim,
      '<h2 class="markdown-h2">$1</h2>'
    );
    formatted = formatted.replace(
      /^#[ \t]+(.*$)/gim,
      '<h1 class="markdown-h1">$1</h1>'
    );

    // Bold & Inline Code
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");

    // GitHub alert quotes
    formatted = formatted.replace(
      /> \[!NOTE\]\n> (.*)/gi,
      '<div class="slds-notify slds-notify_alert slds-alert_warning" role="alert"><span class="slds-assistive-text">info</span><h2>$1</h2></div>'
    );

    // List items (bullets and numbered lists)
    formatted = formatted.replace(/^[ \t]*[-*][ \t]+(.*$)/gim, "<li>$1</li>");
    formatted = formatted.replace(/^[ \t]*\d+\.[ \t]+(.*$)/gim, "<li>$1</li>");

    // Line breaks
    formatted = formatted.replace(/\n\n/g, "<br/><br/>");
    formatted = formatted.replace(/\n/g, "<br/>");

    return formatted;
  }

  get hasVerifiedFindings() {
    return !!this.verifiedFindings;
  }

  get formattedVerifiedFindings() {
    return this.parseMarkdown(this.verifiedFindings);
  }

  get formattedExplanation() {
    return this.parseMarkdown(this.explanationText);
  }

  connectedCallback() {
    if (this.isOpen) {
      this.scheduleAnalysis();
    }
  }

  /**
   * The parent sets isOpen, artifactName and artifactPayload in the same
   * rehydration tick, so coalesce those into a single analysis that runs once
   * every property has landed.
   */
  scheduleAnalysis() {
    if (this._analysisScheduled) return;
    this._analysisScheduled = true;
    Promise.resolve().then(() => {
      this._analysisScheduled = false;
      if (this._isOpen && this._artifactName) {
        this.checkStatusAndAnalyze();
      }
    });
  }

  async checkStatusAndAnalyze() {
    if (!this.artifactName) return;
    this.isLoading = true;
    this.explanationText = "";

    // Discard a response that arrives after the artifact has moved on.
    const requestId = ++this._requestId;

    try {
      const status = await getCoworkerStatus();
      const result = await explainArtifact({
        artifactType: this.artifactType,
        artifactName: this.artifactName,
        artifactPayload: this.artifactPayload || ""
      });

      if (requestId !== this._requestId) return;
      this.status = status;
      this.explanationText = result.explanation;
    } catch (err) {
      if (requestId !== this._requestId) return;
      this.explanationText = `Failed to generate explanation: ${err.body?.message || err.message || err}`;
    } finally {
      if (requestId === this._requestId) {
        this.isLoading = false;
      }
    }
  }

  handleClose() {
    this.dispatchEvent(new CustomEvent("close"));
  }
}
