/**
 * Model conformance check for the AI audit.
 *
 * Run this after changing AgentforceController.modelName or editing any prompt
 * — those are the two things that can silently regress output quality:
 *
 *   sf apex run --target-org Dev --file scripts/apex/modelConformance.apex
 *
 * It fires a payload containing this project's known failure modes at whichever
 * model is currently configured, and reports pass/fail per rule.
 *
 * Two classes of check, deliberately separated:
 *
 *   HARD RULES are mechanically decidable — a code fence is present or it is
 *   not. These fail the run.
 *
 *   REVIEW ITEMS depend on meaning ("did it tell me to edit managed code?",
 *   "is this a field-contention finding or just the words 'same field'?").
 *   Keyword matching gets these wrong: an earlier version of this check flagged
 *   a model for saying "leave the managed package trigger as-is", which is the
 *   correct answer. So these print excerpts for a human to judge instead of
 *   pretending to score them.
 */

// --- Trap payload -----------------------------------------------------------
// T1 two writes to one field on EXCLUSIVE decision branches (not a conflict)
// T2 a lookup READ shaped like a write ($Record.Campaign.Foo)
// T3 field contention declared already-analysed -> must not be re-reported
// T4 a TAF dispatcher trigger -> not competing automation, not migratable
// T5 a managed package trigger -> must not be told to edit/merge/delete it
// T6 genuine DML inside a loop -> SHOULD be found (sensitivity, not specificity)
String payload =
  'SObject API Name: Opportunity\n' +
  'Trigger Action Framework actions: 1\n' +
  'TAF dispatcher trigger present: Yes (TA_Opportunity)\n' +
  'Other Apex triggers: 1 (0 own, 1 managed)\n\n' +
  '=== AUTOMATION INVENTORY ===\n\n' +
  'TRIGGER ACTION FRAMEWORK (Trigger_Action__mdt)\n[Before Update]\n' +
  '- TA_SetStage | Apex=SetStageAction | Order=10 | Bypassed=No\n\n' +
  'TAF DISPATCHER TRIGGER (the framework\'s own entry point — this trigger is HOW ' +
  'the TAF actions above execute. It is correct and expected; it is not a competing ' +
  'automation and must not be migrated or merged)\n' +
  '- TA_Opportunity | Status=Active | Contexts=Before Update\n\n' +
  'OTHER APEX TRIGGERS (this org\'s own code, outside the framework)\nNone\n\n' +
  'MANAGED PACKAGE AUTOMATION — READ-ONLY (installed from a package; cannot be ' +
  'edited, reordered, deleted or migrated by this org)\n' +
  '- oppty | Status=Active | Contexts=Before Update | Package=rstk\n\n' +
  '=== FIELD CONTENTION (already analysed — do not report on this) ===\n' +
  'No field on this object is written by more than one active flow. Do not produce ' +
  'any finding about field contention or field overwrites.\n\n' +
  '=== FLOW DEFINITIONS (each flow rendered as a Mermaid flowchart) ===\n\n' +
  '--- FLOW: "Opportunity - Set Campaign" (Set_Campaign) | RecordAfterSave / CreateAndUpdate | Active ---\n' +
  'flowchart TD\n' +
  '  Start(["Start"]) --> Eval{"Decision\nEval_Campaign"}\n' +
  '  Eval -->| Valid Campaign | SetValid["Assignment\nSet_VALID\n---\n$Record.CampaignId = Get_Membership.CampaignId"]\n' +
  '  Eval -->| Invalid Campaign | SetInvalid["Assignment\nSet_INVALID\n---\n$Record.CampaignId = \'\'"]\n' +
  '  SetValid --> Done(["End"])\n  SetInvalid --> Done\n\n' +
  '--- FLOW: "Opportunity - Created or Updated" (Created_Updated) | RecordAfterSave / CreateAndUpdate | Active ---\n' +
  'flowchart TD\n' +
  '  S2(["Start"]) --> Inbound["Update Records\nInbound_Outbound\n---\nInbound_vs_Outbound__c = $Record.Campaign.Inbound_vs_Outbound__c"]\n' +
  '  Inbound --> Loop["Loop\nFor_Each_Product"]\n' +
  '  Loop --> CreateRec["Create Records\nCreate_Child\n---\ninside For_Each_Product"]\n' +
  '  CreateRec --> Loop\n';

Integer runs = 5;
System.debug('=== MODEL CONFORMANCE ===');
System.debug('model: ' + AgentforceController.modelName + ' | runs: ' + runs);

Integer fFence = 0, fTable = 0, fOffer = 0, fSections = 0, fSeverity = 0;
Integer foundLoopDml = 0;
List<String> reviewItems = new List<String>();
List<String> failureEvidence = new List<String>();

for (Integer i = 1; i <= runs; i++) {
  AgentforceController.AnalysisResult r = AgentforceController.explainArtifact(
    'OBJECT_DEEP',
    'Opportunity',
    payload
  );
  String x = r.explanation == null ? '' : r.explanation;
  String lower = x.toLowerCase();
  String tail = x.length() > 400 ? x.substring(x.length() - 400).toLowerCase() : lower;

  // --- HARD RULES ---
  Boolean fence = x.contains('```');
  Boolean table = x.contains('|---') || x.contains('| Severity');
  Boolean offer =
    tail.contains('if you want') ||
    tail.contains('let me know') ||
    tail.contains('would you like') ||
    tail.contains('i can produce') ||
    tail.contains('i can draft') ||
    tail.contains('shall i') ||
    tail.contains('happy to');
  // Must match FIELD contention only. "row contention" from DML-in-a-loop is a
  // correct finding, and an earlier version of this check failed runs for it.
  Boolean contention =
    lower.contains('field contention') ||
    lower.contains('overwrites the other') ||
    (lower.contains('same field') && lower.contains('overwrit')) ||
    lower.contains('written by 2 separate flows');
  Boolean sections = lower.contains('verdict') && lower.contains('findings');
  Boolean severity =
    x.contains('[HIGH]') || x.contains('[MEDIUM]') || x.contains('[LOW]');

  if (fence) fFence++;
  if (table) fTable++;
  if (offer) fOffer++;
  if (!sections) fSections++;
  if (!severity) fSeverity++;
  if (contention) {
    // Show a window around the matched phrase, not the head of the line —
    // otherwise the evidence truncates before the thing that actually matched.
    for (String phrase : new List<String>{
      'field contention',
      'overwrites the other',
      'same field',
      'written by 2 separate flows'
    }) {
      Integer at = lower.indexOf(phrase);
      if (at >= 0) {
        Integer startAt = Math.max(0, at - 60);
        Integer endAt = Math.min(x.length(), at + 120);
        reviewItems.add(
          'run' + i + ' [' + phrase + ']: ...' + x.substring(startAt, endAt).replaceAll('\n', ' ')
        );
      }
    }
  }
  if (offer) {
    failureEvidence.add('run' + i + ' close: ...' + tail.substring(Math.max(0, tail.length() - 120)));
  }

  // --- SENSITIVITY: the real bug in the payload should be found ---
  if (lower.contains('loop') && (lower.contains('bulkif') || lower.contains('create_child'))) {
    foundLoopDml++;
  }

  // --- REVIEW ITEMS: printed, not scored ---
  for (String line : x.split('\n')) {
    String l = line.toLowerCase();
    if (l.contains('oppty') || l.contains('ta_opportunity') || l.contains('managed')) {
      reviewItems.add('run' + i + ': ' + line.trim().abbreviate(150));
    }
  }
}

System.debug('--- HARD RULES (failures out of ' + runs + ') ---');
System.debug('code fence wrapping    : ' + fFence);
System.debug('markdown table         : ' + fTable);
System.debug('conversational close   : ' + fOffer);
System.debug('missing sections       : ' + fSections);
System.debug('missing severity tags  : ' + fSeverity);
Integer totalFailures = fFence + fTable + fOffer + fSections + fSeverity;
System.debug(totalFailures == 0 ? 'HARD RULES: PASS' : 'HARD RULES: FAIL (' + totalFailures + ')');
for (String ev : failureEvidence) {
  System.debug('  ' + ev);
}

System.debug('--- SENSITIVITY ---');
System.debug('found the DML-in-loop bug: ' + foundLoopDml + '/' + runs);

System.debug('--- REVIEW BY HAND (managed package, TAF dispatcher, contention) ---');
System.debug('Managed/dispatcher lines should acknowledge the constraint, never instruct a change.');
System.debug('Contention hits are usually legitimate ("no field contention is reported", or two');
System.debug('mechanisms in one context) — only a finding that names contending flows is a bug.');
for (String item : reviewItems) {
  System.debug('  ' + item);
}
