/**
 * Portions of this code are derived from the open-source Flow Lens project (https://github.com/google/flow-lens),
 * licensed under the Apache License, Version 2.0. This version has been significantly modified, extended, and optimized
 * for the Trigger Actions Admin Panel.
 */

// SkinColor values
export const SkinColor = {
  NONE: "NONE",
  PINK: "PINK",
  ORANGE: "ORANGE",
  NAVY: "NAVY",
  BLUE: "BLUE"
};

// Icon values
export const Icon = {
  ASSIGNMENT: "📝",
  CODE: "⚡",
  CREATE_RECORD: "➕",
  DECISION: "🔹",
  DELETE: "🗑️",
  LOOKUP: "🔍",
  LOOP: "🔄",
  RIGHT: "➡️",
  SCREEN: "💻",
  STAGE_STEP: "📍",
  UPDATE: "✏️",
  WAIT: "⏳",
  NONE: "",
  ERROR: "🚫"
};

// Mapping from SkinColor to Mermaid class names
const COLOR_TO_STYLE_CLASS = {
  [SkinColor.PINK]: "pink",
  [SkinColor.ORANGE]: "orange",
  [SkinColor.NAVY]: "navy",
  [SkinColor.BLUE]: "blue",
  [SkinColor.NONE]: ""
};

// Mapping from Icon to emoji
const ICON_TO_EMOJI = {
  [Icon.ASSIGNMENT]: "📝",
  [Icon.CODE]: "⚡",
  [Icon.CREATE_RECORD]: "➕",
  [Icon.DECISION]: "🔹",
  [Icon.DELETE]: "🗑️",
  [Icon.LOOKUP]: "🔍",
  [Icon.LOOP]: "🔄",
  [Icon.RIGHT]: "➡️",
  [Icon.SCREEN]: "💻",
  [Icon.STAGE_STEP]: "📍",
  [Icon.UPDATE]: "✏️",
  [Icon.WAIT]: "⏳",
  [Icon.NONE]: "",
  [Icon.ERROR]: "🚫"
};

/**
 * Formats a Flow element value reference or string value.
 */
function toString(element) {
  if (!element) {
    return "";
  }
  if (element.stringValue !== null && element.stringValue !== undefined) {
    return `'${element.stringValue}'`;
  }
  if (
    (element.sobjectValue !== null && element.sobjectValue !== undefined) ||
    (element.apexValue !== null && element.apexValue !== undefined) ||
    (element.elementReference !== null &&
      element.elementReference !== undefined) ||
    (element.formulaExpression !== null &&
      element.formulaExpression !== undefined) ||
    (element.setupReference !== null && element.setupReference !== undefined) ||
    (element.transformValueReference !== null &&
      element.transformValueReference !== undefined) ||
    (element.formulaDataType !== null && element.formulaDataType !== undefined)
  ) {
    return (
      element.sobjectValue ??
      element.apexValue ??
      element.elementReference ??
      element.formulaExpression ??
      element.setupReference ??
      element.transformValueReference ??
      element.formulaDataType ??
      ""
    );
  }
  if (element.dateTimeValue !== null && element.dateTimeValue !== undefined) {
    return new Date(element.dateTimeValue).toLocaleDateString();
  }
  if (element.dateValue !== null && element.dateValue !== undefined) {
    return new Date(element.dateValue).toLocaleDateString();
  }
  if (element.numberValue !== null && element.numberValue !== undefined) {
    return String(element.numberValue);
  }
  if (element.booleanValue !== null && element.booleanValue !== undefined) {
    return String(element.booleanValue);
  }
  return "";
}

function sanitizeId(id) {
  return id ? id.replace(/[^a-zA-Z0-9]/g, "_") : "";
}

function sanitizeLabel(label) {
  return label ? label.replace(/"/g, "'") : "";
}

// Edge labels use Mermaid's unquoted `-->|...|` syntax, where a literal pipe
// terminates the label and breaks the diagram. Normalize quotes like node
// labels, then encode pipes as the HTML entity Mermaid decodes back to "|".
function sanitizeEdgeLabel(label) {
  return sanitizeLabel(label).replace(/\|/g, "#124;");
}

function translateOperator(op) {
  const operatorMap = {
    // Comparison
    EqualTo: "==",
    NotEqualTo: "!=",
    GreaterThan: ">",
    GreaterThanOrEqualTo: ">=",
    LessThan: "<",
    LessThanOrEqualTo: "<=",
    Contains: "contains",
    StartsWith: "starts with",
    EndsWith: "ends with",

    // Assignment
    Assign: "=",
    Add: "+=",
    Subtract: "-=",
    AddItem: "+=",
    SubtractItem: "-="
  };
  return operatorMap[op] || op;
}

function formatCondition(left, operator, rightValue) {
  let right = toString(rightValue);
  if (operator === "IsNull") {
    return right === "true" ? `${left} is null` : `${left} is not null`;
  }
  if (operator === "IsChanged") {
    return right === "true" ? `${left} is changed` : `${left} is not changed`;
  }

  if (right === "") {
    right = "null";
  }

  const opSymbol = translateOperator(operator);
  return `${left} ${opSymbol} ${right}`;
}

function formatAssignment(left, operator, rightValue) {
  let right = toString(rightValue);
  if (right === "") {
    right = "null";
  }
  const opSymbol = translateOperator(operator);
  return `${left} ${opSymbol} ${right}`;
}

function translateTriggerType(type) {
  if (type === "RecordBeforeSave") return "Before Save";
  if (type === "RecordAfterSave") return "After Save";
  return type;
}

function translateRecordTriggerType(type) {
  if (type === "Create") return "Created";
  if (type === "Update") return "Updated";
  if (type === "CreateAndUpdate") return "Created or Updated";
  if (type === "Delete") return "Deleted";
  return type;
}

function formatInnerNodeLabel(innerNode) {
  const sanitizedLabel = sanitizeLabel(innerNode.label);
  const sanitizedContent = (innerNode.content || []).map((item) =>
    sanitizeLabel(item)
  );

  const nodeType = innerNode.type ? `${innerNode.type}\n` : "";
  const nodeLabel =
    innerNode.label && innerNode.label !== innerNode.type
      ? `${sanitizedLabel}\n`
      : "";
  const nodeContent = sanitizedContent.join("\n");

  return `${nodeType}${nodeLabel}${nodeContent}`;
}

function toUmlString(node) {
  const nodeId = sanitizeId(node.id || node.name);
  const styleClass = COLOR_TO_STYLE_CLASS[node.color];
  const lines = [];

  if (nodeId === "FLOW_END") {
    lines.push(`  FLOW_END(["End"])`);
    return lines.join("\n");
  }

  if (nodeId === "FLOW_START") {
    lines.push(`  FLOW_START(["Flow Start ➡️"])`);

    if (node.innerNodes && node.innerNodes.length > 0) {
      const logicId = "FLOW_START_Logic";
      const logicLines = [];
      node.innerNodes.forEach((inner) => {
        const formatted = formatInnerNodeLabel(inner);
        if (formatted && formatted.trim() !== "") {
          logicLines.push(formatted);
        }
      });
      const logicContent = `Flow Details\n---\n${logicLines.join("\n---\n")}`;
      lines.push(`  ${logicId}["${logicContent}"]`);
      lines.push(`  ${logicId} -.- FLOW_START`);

      if (styleClass) {
        lines.push(`  class ${logicId} ${styleClass}`);
      }
    }
    if (styleClass) {
      lines.push(`  class FLOW_START ${styleClass}`);
    }
    return lines.join("\n");
  }

  if (node.type === "Decision" || node.type === "Loop") {
    const emoji = ICON_TO_EMOJI[node.icon] || "";
    const nodeLabel = `${node.type} ${emoji}\n${sanitizeLabel(node.label || node.id)}`;
    lines.push(`  ${nodeId}{"${nodeLabel}"}`);

    if (node.innerNodes && node.innerNodes.length > 0) {
      const logicId = `${nodeId}_Logic`;
      const logicLines = [];
      node.innerNodes.forEach((inner) => {
        const formatted = formatInnerNodeLabel(inner);
        if (formatted && formatted.trim() !== "") {
          logicLines.push(formatted);
        }
      });
      const logicContent = `Criteria\n---\n${logicLines.join("\n---\n")}`;
      lines.push(`  ${logicId}["${logicContent}"]`);
      lines.push(`  ${logicId} -.- ${nodeId}`);

      if (styleClass) {
        lines.push(`  class ${logicId} ${styleClass}`);
      }
    }
    if (styleClass) {
      lines.push(`  class ${nodeId} ${styleClass}`);
    }
    return lines.join("\n");
  }

  // Standard nodes (Assignments, Lookups, DML, Action Calls, Screens, etc.)
  const emoji = ICON_TO_EMOJI[node.icon] || "";
  const typeText = node.type ? `${node.type} ${emoji}`.trim() : "";
  const labelText = sanitizeLabel(node.label || node.id);
  const nodeHeader =
    typeText && labelText && labelText !== node.type
      ? `${typeText}\n${labelText}`
      : typeText || labelText;

  let nodeContent = nodeHeader;
  if (node.innerNodes && node.innerNodes.length > 0) {
    const content = [nodeHeader];
    node.innerNodes.forEach((inner) => {
      const formatted = formatInnerNodeLabel(inner);
      if (formatted && formatted.trim() !== "") {
        content.push(formatted);
      }
    });
    nodeContent = content.join("\n---\n");
  }

  lines.push(`  ${nodeId}["${nodeContent}"]`);
  if (styleClass) {
    lines.push(`  class ${nodeId} ${styleClass}`);
  }

  return lines.join("\n");
}

function getFlowStart(start, processType) {
  const entryCriteria = [];

  if (processType) {
    entryCriteria.push(`Process Type: ${processType}`);
  }
  if (start.triggerType) {
    entryCriteria.push(`Trigger: ${translateTriggerType(start.triggerType)}`);
  }
  if (start.object) {
    entryCriteria.push(`Object: ${start.object}`);
  }
  if (start.recordTriggerType) {
    entryCriteria.push(
      `Event: ${translateRecordTriggerType(start.recordTriggerType)}`
    );
  }
  if (start.entryType) {
    entryCriteria.push(`Entry Type: ${start.entryType}`);
  }

  const filters = start.filters
    ? Array.isArray(start.filters)
      ? start.filters
      : [start.filters]
    : [];
  if (start.filterLogic && filters.length > 0) {
    entryCriteria.push(`Filter Logic: ${start.filterLogic}`);
    filters.forEach((filter, index) => {
      const condStr = formatCondition(
        filter.field,
        filter.operator,
        filter.value
      );
      entryCriteria.push(`${index + 1}. ${condStr}`);
    });
  }

  if (start.filterFormula) {
    entryCriteria.push(`Filter Formula: ${start.filterFormula}`);
  }
  if (start.schedule) {
    entryCriteria.push(
      `Schedule: ${start.schedule.frequency} starting ${start.schedule.startDate} at ${start.schedule.startTime}`
    );
  }

  const capabilities = start.capabilityTypes
    ? Array.isArray(start.capabilityTypes)
      ? start.capabilityTypes
      : [start.capabilityTypes]
    : [];
  if (capabilities.length > 0) {
    capabilities.forEach((capability, index) => {
      entryCriteria.push(
        `Capability ${index + 1}: ${capability.capabilityName}`
      );
    });
  }

  if (start.form) {
    entryCriteria.push(`Form: ${start.form}`);
  }
  if (start.segment) {
    entryCriteria.push(`Segment: ${start.segment}`);
  }
  if (start.flowRunAsUser) {
    entryCriteria.push(`Run As: ${start.flowRunAsUser}`);
  }

  if (entryCriteria.length === 0) {
    entryCriteria.push("No specific entry criteria defined");
  }

  return toUmlString({
    id: "FLOW_START",
    label: "Flow Start",
    type: "Flow Start",
    color: SkinColor.NONE,
    icon: Icon.NONE,
    innerNodes: [
      {
        id: "FlowStart__EntryCriteria",
        type: "",
        label: "",
        content: entryCriteria
      }
    ]
  });
}

function getFlowAssignment(node) {
  const innerNodes = [];
  const items = node.assignmentItems
    ? Array.isArray(node.assignmentItems)
      ? node.assignmentItems
      : [node.assignmentItems]
    : [];
  if (items.length > 0) {
    const assignments = items.map((item) => {
      return formatAssignment(
        item.assignToReference,
        item.operator,
        item.value
      );
    });
    innerNodes.push({
      id: `${node.name}__Assignments`,
      type: "",
      label: "",
      content: assignments
    });
  }

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Assignment",
    color: SkinColor.ORANGE,
    icon: Icon.ASSIGNMENT,
    innerNodes
  });
}

function getFlowDecision(node) {
  const innerNodes = [];
  const rules = node.rules
    ? Array.isArray(node.rules)
      ? node.rules
      : [node.rules]
    : [];
  rules.forEach((rule, index) => {
    const conditionsList = rule.conditions
      ? Array.isArray(rule.conditions)
        ? rule.conditions
        : [rule.conditions]
      : [];
    const conditions = conditionsList.map((cond, idx) => {
      const condStr = formatCondition(
        cond.leftValueReference,
        cond.operator,
        cond.rightValue
      );
      return conditionsList.length > 1 ? `${idx + 1}. ${condStr}` : condStr;
    });

    let typeLabel = index === 0 ? "IF" : "ELSE IF";
    if (conditionsList.length > 1 && rule.conditionLogic) {
      const logicUpper = rule.conditionLogic.toUpperCase();
      if (logicUpper === "AND") {
        typeLabel += " (All)";
      } else if (logicUpper === "OR") {
        typeLabel += " (Any)";
      } else {
        typeLabel += ` (${logicUpper})`;
      }
    }

    innerNodes.push({
      id: rule.name,
      type: typeLabel,
      label: "",
      content: conditions
    });
  });

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Decision",
    color: SkinColor.ORANGE,
    icon: Icon.DECISION,
    innerNodes
  });
}

function getFlowOrchestratedStage(node) {
  const innerNodes = [];
  const steps = node.stageSteps
    ? Array.isArray(node.stageSteps)
      ? node.stageSteps
      : [node.stageSteps]
    : [];
  let counter = 1;
  steps.forEach((step) => {
    innerNodes.push({
      id: `${node.name}.${step.actionName}`,
      type: "Step",
      label: `${counter++}. ${step.label}`,
      content: []
    });
  });

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Orchestrated Stage",
    color: SkinColor.NAVY,
    icon: Icon.RIGHT,
    innerNodes
  });
}

function getFlowRecordLookup(node) {
  const innerNodeContent = [];

  const queried = node.queriedFields
    ? Array.isArray(node.queriedFields)
      ? node.queriedFields
      : [node.queriedFields]
    : [];
  if (queried.length > 0) {
    innerNodeContent.push(`SELECT ${queried.join(", ")}`);
  }

  const filters = node.filters
    ? Array.isArray(node.filters)
      ? node.filters
      : [node.filters]
    : [];
  if (filters.length > 0) {
    const filterConditions = filters.map((filter, index) => {
      const condStr = formatCondition(
        filter.field,
        filter.operator,
        filter.value
      );
      return filters.length > 1 ? `${index + 1}. ${condStr}` : condStr;
    });
    let whereHeader = "WHERE";
    if (filters.length > 1 && node.filterLogic) {
      const logicUpper = node.filterLogic.toUpperCase();
      if (logicUpper === "AND") {
        whereHeader += " (All)";
      } else if (logicUpper === "OR") {
        whereHeader += " (Any)";
      } else {
        whereHeader += ` (${logicUpper})`;
      }
    }
    innerNodeContent.push(
      whereHeader,
      ...filterConditions.map((c) => `  ${c}`)
    );
  }

  let limitStr = "All Records";
  if (node.getFirstRecordOnly) {
    limitStr = "1";
  } else if (node.limit) {
    limitStr = String(node.limit);
  }
  innerNodeContent.push(`LIMIT ${limitStr}`);

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: `Get ${node.object || "Record"}`,
    color: SkinColor.PINK,
    icon: Icon.LOOKUP,
    innerNodes: [
      {
        id: `${node.name}__LookupDetails`,
        type: "",
        label: "",
        content: innerNodeContent
      }
    ]
  });
}

function getFlowRecordUpdate(node) {
  const innerNodeContent = [];

  const assignments = node.inputAssignments
    ? Array.isArray(node.inputAssignments)
      ? node.inputAssignments
      : [node.inputAssignments]
    : [];
  if (assignments.length > 0) {
    innerNodeContent.push("SET");
    assignments.forEach((assign) => {
      let valStr = toString(assign.value);
      if (valStr === "") {
        valStr = "null";
      }
      innerNodeContent.push(`  ${assign.field} = ${valStr}`);
    });
  }

  const filters = node.filters
    ? Array.isArray(node.filters)
      ? node.filters
      : [node.filters]
    : [];
  if (filters.length > 0) {
    const filterConditions = filters.map((filter, index) => {
      const condStr = formatCondition(
        filter.field,
        filter.operator,
        filter.value
      );
      return filters.length > 1 ? `${index + 1}. ${condStr}` : condStr;
    });
    let whereHeader = "WHERE";
    if (filters.length > 1 && node.filterLogic) {
      const logicUpper = node.filterLogic.toUpperCase();
      if (logicUpper === "AND") {
        whereHeader += " (All)";
      } else if (logicUpper === "OR") {
        whereHeader += " (Any)";
      } else {
        whereHeader += ` (${logicUpper})`;
      }
    }
    innerNodeContent.push(
      whereHeader,
      ...filterConditions.map((c) => `  ${c}`)
    );
  }

  const objLabel = node.object ? ` ${node.object}` : " Record";
  const typeLabel = node.inputReference
    ? `Update Reference: 
    ${node.inputReference}`
    : `Update${objLabel}`;

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: typeLabel,
    color: SkinColor.PINK,
    icon: Icon.UPDATE,
    innerNodes:
      innerNodeContent.length > 0
        ? [
            {
              id: `${node.name}__UpdateDetails`,
              type: "",
              label: "",
              content: innerNodeContent
            }
          ]
        : []
  });
}

function getFlowRecordCreate(node) {
  const innerNodeContent = [];
  const assignments = node.inputAssignments
    ? Array.isArray(node.inputAssignments)
      ? node.inputAssignments
      : [node.inputAssignments]
    : [];
  if (assignments.length > 0) {
    innerNodeContent.push("SET");
    assignments.forEach((assign) => {
      innerNodeContent.push(`  ${assign.field} = ${toString(assign.value)}`);
    });
  }

  const objLabel = node.object ? ` ${node.object}` : " Record";
  const typeLabel = node.inputReference
    ? `Create Reference: 
    ${node.inputReference}`
    : `Create${objLabel}`;

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: typeLabel,
    color: SkinColor.PINK,
    icon: Icon.CREATE_RECORD,
    innerNodes:
      innerNodeContent.length > 0
        ? [
            {
              id: `${node.name}__CreateDetails`,
              type: "",
              label: "",
              content: innerNodeContent
            }
          ]
        : []
  });
}

function getFlowRecordDelete(node) {
  const innerNodeContent = [];
  const filters = node.filters
    ? Array.isArray(node.filters)
      ? node.filters
      : [node.filters]
    : [];
  if (filters.length > 0) {
    const filterConditions = filters.map((filter, index) => {
      const condStr = formatCondition(
        filter.field,
        filter.operator,
        filter.value
      );
      return filters.length > 1 ? `${index + 1}. ${condStr}` : condStr;
    });
    let whereHeader = "WHERE";
    if (filters.length > 1 && node.filterLogic) {
      const logicUpper = node.filterLogic.toUpperCase();
      if (logicUpper === "AND") {
        whereHeader += " (All)";
      } else if (logicUpper === "OR") {
        whereHeader += " (Any)";
      } else {
        whereHeader += ` (${logicUpper})`;
      }
    }
    innerNodeContent.push(
      whereHeader,
      ...filterConditions.map((c) => `  ${c}`)
    );
  }

  const objLabel = node.object ? ` ${node.object}` : " Record";
  const typeLabel = node.inputReference
    ? `Delete Reference: ${node.inputReference}`
    : `Delete${objLabel}`;

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: typeLabel,
    color: SkinColor.PINK,
    icon: Icon.DELETE,
    innerNodes:
      innerNodeContent.length > 0
        ? [
            {
              id: `${node.name}__DeleteDetails`,
              type: "",
              label: "",
              content: innerNodeContent
            }
          ]
        : []
  });
}

function getFlowActionCall(node) {
  const innerNodeContent = [];
  if (node.actionType) {
    innerNodeContent.push(`Type: ${node.actionType}`);
  }
  if (node.actionName) {
    innerNodeContent.push(`Action: ${node.actionName}`);
  }

  // Input parameters
  const inputParams = node.inputParameters
    ? Array.isArray(node.inputParameters)
      ? node.inputParameters
      : [node.inputParameters]
    : [];
  if (inputParams.length > 0) {
    innerNodeContent.push("INPUTS:");
    inputParams.forEach((param) => {
      const val = toString(param.value);
      innerNodeContent.push(`• ${param.name} = ${val}`);
    });
  }

  // Output parameters
  const outputParams = node.outputParameters
    ? Array.isArray(node.outputParameters)
      ? node.outputParameters
      : [node.outputParameters]
    : [];
  if (outputParams.length > 0) {
    innerNodeContent.push("OUTPUTS:");
    outputParams.forEach((param) => {
      innerNodeContent.push(`• ${param.assignToReference} = ${param.name}`);
    });
  }

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Action Call",
    color: SkinColor.NAVY,
    icon: Icon.CODE,
    innerNodes:
      innerNodeContent.length > 0
        ? [
            {
              id: `${node.name}__ActionDetails`,
              type: "",
              label: "",
              content: innerNodeContent
            }
          ]
        : []
  });
}

function getFlowSubflow(node) {
  const innerNodeContent = [];
  if (node.flowName) {
    innerNodeContent.push(`Flow: ${node.flowName}`);
  }

  // Input assignments
  const inputAssigns = node.inputAssignments
    ? Array.isArray(node.inputAssignments)
      ? node.inputAssignments
      : [node.inputAssignments]
    : [];
  if (inputAssigns.length > 0) {
    innerNodeContent.push("INPUTS:");
    inputAssigns.forEach((assign) => {
      const val = toString(assign.value);
      innerNodeContent.push(`• ${assign.inputParameterName} = ${val}`);
    });
  }

  // Output assignments
  const outputAssigns = node.outputAssignments
    ? Array.isArray(node.outputAssignments)
      ? node.outputAssignments
      : [node.outputAssignments]
    : [];
  if (outputAssigns.length > 0) {
    innerNodeContent.push("OUTPUTS:");
    outputAssigns.forEach((assign) => {
      innerNodeContent.push(
        `• ${assign.assignToReference} = ${assign.outputParameterName}`
      );
    });
  }

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Subflow",
    color: SkinColor.NAVY,
    icon: Icon.RIGHT,
    innerNodes:
      innerNodeContent.length > 0
        ? [
            {
              id: `${node.name}__SubflowDetails`,
              type: "",
              label: "",
              content: innerNodeContent
            }
          ]
        : []
  });
}

function getFlowCustomError(node) {
  const innerNodeContent = [];
  const messages = node.customErrorMessages
    ? Array.isArray(node.customErrorMessages)
      ? node.customErrorMessages
      : [node.customErrorMessages]
    : [];
  messages.forEach((msg, index) => {
    const fieldInfo = msg.fieldSelection
      ? ` (Field: ${msg.fieldSelection})`
      : "";
    innerNodeContent.push(`${index + 1}. ${msg.errorMessage}${fieldInfo}`);
  });

  return toUmlString({
    id: node.name,
    label: node.label || node.name,
    type: "Custom Error",
    color: SkinColor.NAVY,
    icon: Icon.ERROR,
    innerNodes: [
      {
        id: `${node.name}__ErrorDetails`,
        type: node.description || "Custom Error Details",
        label: "Error Messages:",
        content: innerNodeContent
      }
    ]
  });
}

function createTransition(
  from,
  connection,
  isFault,
  transitionLabel,
  nameToNode
) {
  const targetRef = connection.targetReference;
  let connectedNode = nameToNode.get(targetRef);
  if (!connectedNode && targetRef) {
    // The connector points to an element we didn't collect — an unsupported or
    // newly-introduced Flow element type. Surface it as a placeholder node
    // instead of silently rerouting the edge to End (which would falsely make
    // the flow look like it terminates here). Registered into nameToNode so the
    // emit loop renders it.
    connectedNode = { name: targetRef, label: targetRef, _type: "unsupported" };
    nameToNode.set(targetRef, connectedNode);
  }
  const toName = connectedNode ? connectedNode.name : "FLOW_END";
  return {
    from: from.name,
    to: toName,
    fault: isFault,
    label: transitionLabel
  };
}

function getTransitionsForNode(node, nameToNode) {
  const transitions = [];
  const type = node._type;

  if (type === "start") {
    if (node.connector) {
      transitions.push(
        createTransition(node, node.connector, false, undefined, nameToNode)
      );
    } else {
      transitions.push({
        from: node.name,
        to: "FLOW_END",
        fault: false
      });
    }
    const paths = node.scheduledPaths
      ? Array.isArray(node.scheduledPaths)
        ? node.scheduledPaths
        : [node.scheduledPaths]
      : [];
    paths.forEach((path) => {
      if (path.connector) {
        transitions.push(
          createTransition(
            node,
            path.connector,
            false,
            path.pathType || path.label,
            nameToNode
          )
        );
      }
    });
  } else if (
    type === "recordCreate" ||
    type === "recordDelete" ||
    type === "recordLookup" ||
    type === "recordUpdate" ||
    type === "apexPluginCall" ||
    type === "actionCall" ||
    type === "wait"
  ) {
    if (node.connector) {
      transitions.push(
        createTransition(node, node.connector, false, undefined, nameToNode)
      );
    }
    if (node.defaultConnector) {
      transitions.push(
        createTransition(
          node,
          node.defaultConnector,
          false,
          node.defaultConnectorLabel,
          nameToNode
        )
      );
    }
    if (node.faultConnector) {
      transitions.push(
        createTransition(node, node.faultConnector, true, "Fault", nameToNode)
      );
    }
    if (!node.connector && !node.defaultConnector) {
      transitions.push({
        from: node.name,
        to: "FLOW_END",
        fault: false
      });
    }
  } else if (type === "step") {
    const connectors = node.connectors
      ? Array.isArray(node.connectors)
        ? node.connectors
        : [node.connectors]
      : [];
    connectors.forEach((conn) => {
      transitions.push(
        createTransition(node, conn, false, undefined, nameToNode)
      );
    });
    if (connectors.length === 0) {
      transitions.push({
        from: node.name,
        to: "FLOW_END",
        fault: false
      });
    }
  } else if (type === "decision") {
    if (node.defaultConnector) {
      transitions.push(
        createTransition(
          node,
          node.defaultConnector,
          false,
          node.defaultConnectorLabel || "Default",
          nameToNode
        )
      );
    } else {
      transitions.push({
        from: node.name,
        to: "FLOW_END",
        fault: false,
        label: "Default"
      });
    }
    const rules = node.rules
      ? Array.isArray(node.rules)
        ? node.rules
        : [node.rules]
      : [];
    rules.forEach((rule) => {
      if (rule.connector) {
        transitions.push(
          createTransition(node, rule.connector, false, rule.label, nameToNode)
        );
      } else {
        transitions.push({
          from: node.name,
          to: "FLOW_END",
          fault: false,
          label: rule.label
        });
      }
    });
  } else if (type === "loop") {
    if (node.nextValueConnector) {
      transitions.push(
        createTransition(
          node,
          node.nextValueConnector,
          false,
          "for each",
          nameToNode
        )
      );
    }
    if (node.noMoreValuesConnector) {
      transitions.push(
        createTransition(
          node,
          node.noMoreValuesConnector,
          false,
          "after all",
          nameToNode
        )
      );
    } else {
      transitions.push({
        from: node.name,
        to: "FLOW_END",
        fault: false,
        label: "after all"
      });
    }
  } else if (
    type === "assignment" ||
    type === "collectionProcessor" ||
    type === "screen" ||
    type === "subflow" ||
    type === "transform" ||
    type === "recordRollback" ||
    type === "customError" ||
    type === "orchestratedStage"
  ) {
    if (node.connector) {
      const connectors = Array.isArray(node.connector)
        ? node.connector
        : [node.connector];
      connectors.forEach((conn) => {
        transitions.push(
          createTransition(node, conn, false, undefined, nameToNode)
        );
      });
    } else {
      transitions.push({
        from: node.name,
        to: "FLOW_END",
        fault: false
      });
    }
  }

  return transitions;
}

function populateTransitions(flow, nameToNode) {
  const result = [];
  const start = flow.start;
  if (!start) return result;

  const queue = [start];
  const visitedNodes = new Set();

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || visitedNodes.has(node.name)) {
      continue;
    }
    visitedNodes.add(node.name);

    const transitions = getTransitionsForNode(node, nameToNode);
    for (const trans of transitions) {
      const toNode = nameToNode.get(trans.to);
      if (toNode) {
        queue.push(toNode);
      }
    }
    result.push(...transitions);
  }
  return result;
}

export function convertFlowToMermaid(flow, flowLabel, includeTitle = true) {
  const nameToNode = new Map();
  nameToNode.set("FLOW_END", { name: "FLOW_END", label: "End", _type: "end" });

  if (flow.start) {
    flow.start.name = "FLOW_START";
    flow.start._type = "start";
    nameToNode.set("FLOW_START", flow.start);
  }

  const arrayTypes = [
    { array: flow.apexPluginCalls, type: "apexPluginCall" },
    { array: flow.assignments, type: "assignment" },
    { array: flow.collectionProcessors, type: "collectionProcessor" },
    { array: flow.customErrors, type: "customError" },
    { array: flow.decisions, type: "decision" },
    { array: flow.loops, type: "loop" },
    { array: flow.orchestratedStages, type: "orchestratedStage" },
    { array: flow.recordCreates, type: "recordCreate" },
    { array: flow.recordDeletes, type: "recordDelete" },
    { array: flow.recordLookups, type: "recordLookup" },
    { array: flow.recordRollbacks, type: "recordRollback" },
    { array: flow.recordUpdates, type: "recordUpdate" },
    { array: flow.screens, type: "screen" },
    { array: flow.steps, type: "step" },
    { array: flow.subflows, type: "subflow" },
    { array: flow.transforms, type: "transform" },
    { array: flow.waits, type: "wait" },
    { array: flow.actionCalls, type: "actionCall" }
  ];

  arrayTypes.forEach((entry) => {
    if (entry.array) {
      const arr = Array.isArray(entry.array) ? entry.array : [entry.array];
      arr.forEach((node) => {
        node._type = entry.type;
        nameToNode.set(node.name, node);
      });
    }
  });

  const transitions = populateTransitions(flow, nameToNode);

  // Build the Mermaid syntax output
  const lines = [];
  if (includeTitle) {
    lines.push("---");
    lines.push(
      `title: "${sanitizeLabel(flowLabel || flow.label || "Flow Diagram")}"`
    );
    lines.push("---");
  }
  lines.push(
    "flowchart TD",
    "",
    "  classDef pink fill:#F43F5E, color:#ffffff",
    "  classDef orange fill:#F97316, color:#ffffff",
    "  classDef navy fill:#475569, color:#ffffff",
    "  classDef blue fill:#0284C7, color:#ffffff",
    ""
  );

  // Emit node state definitions
  nameToNode.forEach((node) => {
    if (node.name === "FLOW_END") {
      const hasEndTransitions = transitions.some((t) => t.to === "FLOW_END");
      if (hasEndTransitions) {
        lines.push(toUmlString(node));
      }
      return;
    }

    if (node._type === "start") {
      lines.push(getFlowStart(node, flow.processType));
      return;
    }

    switch (node._type) {
      case "apexPluginCall":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Apex Plugin Call",
            color: SkinColor.NONE,
            icon: Icon.CODE
          })
        );
        break;
      case "assignment":
        lines.push(getFlowAssignment(node));
        break;
      case "collectionProcessor":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Collection Processor",
            color: SkinColor.NONE,
            icon: Icon.LOOP
          })
        );
        break;
      case "decision":
        lines.push(getFlowDecision(node));
        break;
      case "loop":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Loop",
            color: SkinColor.ORANGE,
            icon: Icon.LOOP
          })
        );
        break;
      case "orchestratedStage":
        lines.push(getFlowOrchestratedStage(node));
        break;
      case "recordCreate":
        lines.push(getFlowRecordCreate(node));
        break;
      case "recordDelete":
        lines.push(getFlowRecordDelete(node));
        break;
      case "recordLookup":
        lines.push(getFlowRecordLookup(node));
        break;
      case "recordRollback":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Record Rollback",
            color: SkinColor.PINK,
            icon: Icon.NONE
          })
        );
        break;
      case "recordUpdate":
        lines.push(getFlowRecordUpdate(node));
        break;
      case "screen":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Screen",
            color: SkinColor.BLUE,
            icon: Icon.SCREEN
          })
        );
        break;
      case "step":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Step",
            color: SkinColor.NONE,
            icon: Icon.STAGE_STEP
          })
        );
        break;
      case "subflow":
        lines.push(getFlowSubflow(node));
        break;
      case "transform":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Transform",
            color: SkinColor.NONE,
            icon: Icon.CODE
          })
        );
        break;
      case "wait":
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "Wait",
            color: SkinColor.NONE,
            icon: Icon.WAIT
          })
        );
        break;
      case "actionCall":
        lines.push(getFlowActionCall(node));
        break;
      case "customError":
        lines.push(getFlowCustomError(node));
        break;
      case "unsupported":
      default:
        // Render unknown/unhandled element types as a visible placeholder so the
        // diagram stays honest rather than dropping the element silently.
        lines.push(
          toUmlString({
            id: node.name,
            label: node.label || node.name,
            type: "⚠️ Unsupported Element",
            color: SkinColor.NONE,
            icon: Icon.ERROR
          })
        );
        break;
    }
  });

  lines.push("");

  // Emit transitions
  transitions.forEach((trans) => {
    const fromId = sanitizeId(trans.from);
    const toId = sanitizeId(trans.to);
    const faultIndicator = trans.fault ? "❌" : "";
    const label = trans.label
      ? `|${faultIndicator} ${sanitizeEdgeLabel(trans.label)} ${faultIndicator}|`
      : "";
    lines.push(`  ${fromId} -->${label} ${toId}`);
  });

  return lines.join("\n");
}
