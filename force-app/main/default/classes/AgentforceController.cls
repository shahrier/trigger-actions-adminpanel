public with sharing class AgentforceController {
  /**
   * The Models API model used for generation. Every value below was verified
   * callable in an Agentforce-enabled org; swap this one line to change model.
   *
   * Measured on an ~80k-character audit payload, which is the realistic size:
   * GPT-5 12.1s, GPT-4o 13.3s. GPT-5's reasoning overhead only shows on tiny
   * prompts. In a small A/B against payloads containing this project's known
   * failure modes, GPT-4o ignored the "do not report field contention"
   * instruction in one run of three; GPT-5 in none, and it correctly left the
   * managed-package trigger alone.
   *
   *   sfdc_ai__DefaultGPT5
   *   sfdc_ai__DefaultGPT4Omni       previous default
   *   sfdc_ai__DefaultGPT41
   *   sfdc_ai__DefaultGPT5Mini       current default
   *   sfdc_ai__DefaultBedrockAnthropicClaude4Sonnet
   *   sfdc_ai__DefaultGPT4OmniMini   weakest; misread a one-word prompt
   *
   * Changing this invalidates cached responses, so bump PROMPT_VERSION in
   * c/auditCache alongside it.
   */
  public static String modelName = 'sfdc_ai__DefaultGPT5Mini';

  // Lets tests exercise the no-Agentforce path deterministically. Without it
  // the offline branches are unreachable in an org that has Agentforce, which
  // is exactly the path most installs will take.
  @TestVisible
  private static AiStatus mockStatus;

  public class AiStatus {
    @AuraEnabled
    public Boolean isAvailable { get; set; }
    @AuraEnabled
    public String statusMessage { get; set; }

    public AiStatus() {
      this.isAvailable = false;
      this.statusMessage = 'Agentforce is not enabled in this org environment.';
    }
  }

  public class AnalysisResult {
    @AuraEnabled
    public Boolean isAvailable { get; set; }
    @AuraEnabled
    public String artifactType { get; set; }
    @AuraEnabled
    public String artifactName { get; set; }
    @AuraEnabled
    public String explanation { get; set; }
    @AuraEnabled
    public String statusMessage { get; set; }

    public AnalysisResult() {
      this.isAvailable = false;
      this.artifactType = '';
      this.artifactName = '';
      this.explanation = '';
      this.statusMessage = '';
    }
  }

  /**
   * @description Reports whether this org can call the Agentforce Models API.
   *
   * Probes the capability actually used rather than looking for a bot: any
   * Einstein Bot named "...Agent..." used to satisfy the old check, which was
   * wrong in both directions. Constructing the action performs no callout and
   * costs no tokens; it throws when the org has no access.
   * @return AiStatus Whether generation is available, and why not if it is not.
   */
  @AuraEnabled(cacheable=true)
  public static AiStatus getAiStatus() {
    if (mockStatus != null) {
      return mockStatus;
    }
    AiStatus status = new AiStatus();
    try {
      Invocable.Action.createCustomAction(
        'salesforceAPIPlatform',
        'ModelsAPI.createGenerations'
      );
      status.isAvailable = true;
      status.statusMessage = 'Agentforce is available in this org.';
    } catch (Exception e) {
      status.isAvailable = false;
      status.statusMessage =
        'Agentforce is not enabled in this org, so no AI analysis is available: ' +
        e.getMessage();
    }
    return status;
  }

  /**
   * @description Generates an AI-powered explanation for an Apex Class or Flow artifact using Agentforce.
   */
  @AuraEnabled
  public static AnalysisResult explainArtifact(
    String artifactType,
    String artifactName,
    String artifactPayload
  ) {
    AnalysisResult result = new AnalysisResult();
    result.artifactType = artifactType;
    result.artifactName = artifactName;

    AiStatus status = getAiStatus();
    result.statusMessage = status.statusMessage;

    if (!status.isAvailable) {
      result.isAvailable = false;
      result.explanation = generateOfflineExplanation(
        artifactType,
        artifactName,
        artifactPayload
      );
      return result;
    }

    try {
      String prompt = buildPrompt(artifactType, artifactName, artifactPayload);
      String aiResponse = invokeModelsApi(prompt);

      if (String.isNotBlank(aiResponse)) {
        // Only now is the analysis genuinely AI-generated. Reporting the
        // pre-check instead let the UI credit Agentforce for offline content.
        result.isAvailable = true;
        result.explanation = aiResponse;
      } else {
        result.isAvailable = false;
        result.statusMessage = 'Agentforce returned no generation for this request.';
        result.explanation = generateOfflineExplanation(
          artifactType,
          artifactName,
          artifactPayload
        );
      }
    } catch (Exception e) {
      result.isAvailable = false;
      result.statusMessage = 'Agentforce call failed: ' + e.getMessage();
      result.explanation = generateOfflineExplanation(
        artifactType,
        artifactName,
        artifactPayload
      );
    }

    return result;
  }

  /**
   * @description Output constraints shared by every prompt.
   *
   * Assistant-trained models close with offers of further help ("If you want,
   * I can..."), which is noise in a rendered report: there is no conversation
   * and nobody to answer. Framing the output as a document works better than
   * prohibition alone, so it does both.
   * @return String Rules to append to any prompt.
   */
  private static String outputRules() {
    return '\n\nOUTPUT RULES:\n' +
      '- You are producing a static report that will be rendered in a read-only panel. There is no conversation and no one to reply to.\n' +
      '- Output markdown directly. Do not wrap your response in a code fence, and do not use markdown tables.\n' +
      '- Do not address the reader, ask questions, offer to do further work, or add a sign-off. Never end with an offer such as "if you want, I can...".\n' +
      '- Stop after the final section. Output nothing after it.';
  }

  private static String buildPrompt(
    String artifactType,
    String artifactName,
    String artifactPayload
  ) {
    if ('APEX'.equalsIgnoreCase(artifactType)) {
      return 'You are an expert Salesforce Architect. Analyze the following Apex class \'' +
        artifactName +
        '\'. Here is the Apex source code / structural payload:\n\n' +
        artifactPayload +
        '\n\nProvide a comprehensive analysis explaining its core purpose, execution logic, interface implementations (specifically within the Trigger Action framework), and any performance risks or governor limit considerations.' +
        outputRules();
    } else if (
      'OBJECT'.equalsIgnoreCase(artifactType) ||
      'OBJECT_DEEP'.equalsIgnoreCase(artifactType)
    ) {
      Boolean isDeep = 'OBJECT_DEEP'.equalsIgnoreCase(artifactType);
      return 'You are an expert Salesforce Architect auditing the automation footprint of the \'' +
        artifactName +
        '\' SObject. Below is the complete inventory of automation configured on it, followed by deterministic signals computed from that inventory' +
        (isDeep
          ? ', and then the actual definition of each artifact: the Apex source this org can read, and every flow rendered as a Mermaid flowchart'
          : '') +
        ':\n\n' +
        artifactPayload +
        '\n\nProduce a RISK-RANKED AUDIT REPORT in markdown with exactly these sections:\n\n' +
        '### Verdict\n' +
        'One rating — Healthy, Needs Attention, or High Risk — followed by at most two sentences justifying it.\n\n' +
        '### Findings\n' +
        'One block per finding, highest severity first, in exactly this shape:\n\n' +
        '#### [HIGH] Short finding title\n' +
        '- **Evidence:** the specific artifact names from the inventory that show this\n' +
        '- **Impact:** what breaks or degrades because of it\n' +
        '- **Fix:** the concrete change to make\n\n' +
        'Use [HIGH], [MEDIUM] or [LOW] as the severity tag. Order every HIGH block before every MEDIUM block, and those before every LOW block.\n\n' +
        '### Consolidation Opportunities\n' +
        'Where automation should be merged, migrated into the Trigger Action framework, or retired outright.\n\n' +
        (isDeep
          ? '\nBECAUSE YOU CAN SEE THE DEFINITIONS, PRIORITISE FINDINGS THAT ONLY THE DEFINITIONS REVEAL:\n' +
            '- DO NOT REPORT FIELD CONTENTION AT ALL. Which fields are written by more than one flow has already been computed from the metadata and is being shown to the user separately, as the "FIELD CONTENTION" section states. Produce no finding about two artifacts writing the same field, field overwrites, or field-level races. You cannot determine field writes reliably from the diagrams — a field on the right-hand side of an assignment, in a filter, or reached through a lookup is a READ, not a write — so do not try.\n' +
            '- SOQL, DML or a subflow invocation placed inside a loop element, in either Apex or a flow.\n' +
            '- An artifact that updates the very object it is triggered on, and whether that can re-enter.\n' +
            '- Hardcoded record ids, usernames or emails.\n' +
            '- Entry conditions that genuinely overlap, so two artifacts fire on the same records.\n' +
            '- Logic that contradicts another artifact (one sets a value, another immediately resets it).\n' +
            'Quote the specific element or method name as evidence for each.\n' +
            '\nTWO RULES THAT PREVENT FALSE POSITIVES — APPLY THEM BEFORE REPORTING ANY CONFLICT:\n' +
            '1. MUTUALLY EXCLUSIVE BRANCHES ARE NOT A CONFLICT. In a Mermaid diagram, edges leaving one Decision node (`Decision -->| Some Outcome | Element`) are alternative branches: at most one runs for a given record. Two elements on different branches of the same decision can NEVER both execute on the same record, so they cannot overwrite each other, race, or contend. Before reporting two elements as conflicting, trace their paths and confirm both can run for the SAME record. If they cannot, do not report it.\n' +
            '2. A REFERENCE IS NOT A WRITE. An element writes a field only when the field is the target of an assignment (`$Record.Field = ...`) or a field being set in a record update. A field appearing on the right-hand side, in a criteria/filter, or reached through a lookup (`$Record.SomeLookup.Field`) is being READ. Never report a read as a write or as contention.\n'
          : '') +
        '\nSTRICT RULES:\n' +
        (isDeep
          ? '- Ground every statement in the inventory, signals and definitions above. Where a definition was not readable, say so rather than speculating.\n'
          : '- Ground every statement in the inventory and signals above. You cannot see the internal logic of any Apex class or Flow, so never assert what one does internally.\n') +
        '- THE TAF DISPATCHER TRIGGER IS NOT A COMPETING AUTOMATION. A trigger listed under "TAF DISPATCHER TRIGGER" is the Trigger Action Framework\'s own entry point: it is the mechanism that executes the Trigger_Action__mdt actions listed above it. Its presence is correct and required. Never report it as duplicate logic, as contention with the TAF actions it dispatches, or as something to migrate into the framework — it already IS the framework. Only Apex triggers listed under "OTHER APEX TRIGGERS" are migration candidates.\n' +
        '- MANAGED PACKAGE ARTIFACTS ARE READ-ONLY. Anything marked with a Package= namespace, or listed under the managed-package section, is installed code this org cannot edit, reorder, merge, migrate or delete. Never recommend changing, consolidating or removing one. You may note that it contributes to contention, and you may recommend things the org actually controls: ordering its own actions around it, entry criteria, bypasses, or raising the issue with the package vendor.\n' +
        '- Count managed and unmanaged artifacts separately when describing contention, and say which are which.\n' +
        '- Do not invent findings. If the object is genuinely clean, say so under Verdict and write "No findings." under Findings.\n' +
        '- Omit a section entirely when there is nothing substantive to put in it.\n' +
        '- Do not explain what triggers, flows, or the order of execution are. Assume an expert reader. Be blunt and specific.' +
        outputRules();
    } else {
      return 'You are an expert Salesforce Architect. Analyze the following Record-Triggered Flow \'' +
        artifactName +
        '\'. The following is the Flow structural diagram (in Mermaid syntax) and its metadata/resources:\n\n' +
        artifactPayload +
        '\n\nProvide a comprehensive analysis including: 1. Core Purpose & Trigger Conditions 2. Decision Logic & Execution Paths 3. Subflows/Apex Actions 4. Governance & Performance Risks 5. Recommendations.' +
        outputRules();
    }
  }

  private static String invokeModelsApi(String prompt) {
    try {
      Invocable.Action action = Invocable.Action.createCustomAction(
        'salesforceAPIPlatform',
        'ModelsAPI.createGenerations'
      );
      action.setInvocationParameter('modelName', modelName);
      action.setInvocationParameter(
        'body',
        new Map<String, Object>{ 'prompt' => prompt }
      );

      List<Invocable.Action.Result> results = action.invoke();
      if (!results.isEmpty() && results[0].isSuccess()) {
        Map<String, Object> outputMap = results[0].getOutputParameters();
        String jsonStr = JSON.serialize(outputMap);

        Map<String, Object> root = (Map<String, Object>) JSON.deserializeUntyped(
          jsonStr
        );
        if (root != null && root.containsKey('200')) {
          Map<String, Object> res200 = (Map<String, Object>) root.get('200');
          if (res200 != null && res200.containsKey('generation')) {
            Map<String, Object> generation = (Map<String, Object>) res200.get(
              'generation'
            );
            if (generation != null && generation.containsKey('generatedText')) {
              return (String) generation.get('generatedText');
            }
          }
        }
      }
    } catch (Exception e) {
      System.debug(
        LoggingLevel.WARN,
        'Agentforce Models API invocation skipped: ' + e.getMessage()
      );
    }
    return null;
  }

  private static String generateOfflineExplanation(
    String artifactType,
    String artifactName,
    String artifactPayload
  ) {
    if (
      'OBJECT'.equalsIgnoreCase(artifactType) ||
      'OBJECT_DEEP'.equalsIgnoreCase(artifactType)
    ) {
      // Show the inventory and computed signals, which are readable and useful
      // on their own. Everything from the source sections onward is raw flow
      // diagrams and Apex — tens of thousands of characters written for a model
      // to read, not a person.
      String summary = String.isNotBlank(artifactPayload)
        ? artifactPayload
        : 'No automation metadata available for this object.';
      Integer sourceStart = summary.indexOf('=== APEX SOURCE ===');
      if (sourceStart > 0) {
        summary = summary.substring(0, sourceStart).trim();
      }

      return '### Object Automation Audit: `' +
        artifactName +
        '`\n\n' +
        '> [!NOTE]\n' +
        '> Agentforce is not available in this org, so no AI-generated findings are available. The structural analysis below is computed directly from your metadata and is unaffected — including any verified findings shown above.\n\n' +
        '```\n' +
        summary +
        '\n' +
        '```\n\n' +
        'To add AI-generated findings and recommendations on top of this, enable **Agentforce** in Salesforce Setup.';
    }

    String title = 'APEX'.equalsIgnoreCase(artifactType)
      ? 'Apex Class Analysis'
      : 'Flow Analysis';
    String codeSnippet = String.isNotBlank(artifactPayload) &&
      artifactPayload.length() > 500
      ? artifactPayload.substring(0, 500) + '...'
      : artifactPayload;

    return '### ' +
      title +
      ': `' +
      artifactName +
      '`\n\n' +
      '> [!NOTE]\n' +
      '> Agentforce is not available in this org. Structural analysis summary is rendered below.\n\n' +
      '#### Overview & Structure\n' +
      '- **Artifact:** `' +
      artifactName +
      '` (' +
      artifactType +
      ')\n' +
      '- **Status:** Identified in org metadata.\n\n' +
      '#### Source Code / Metadata Sample\n' +
      '```' +
      ('APEX'.equalsIgnoreCase(artifactType) ? 'apex' : 'json') +
      '\n' +
      (String.isNotBlank(codeSnippet)
        ? codeSnippet
        : '// Source metadata empty') +
      '\n' +
      '```\n\n' +
      '#### Guidance\n' +
      'To enable generative analysis, enable **Agentforce** in Salesforce Setup.';
  }
}
