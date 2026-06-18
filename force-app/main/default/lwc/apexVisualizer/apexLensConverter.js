/**
 * Portions of this code are inspired by and derived from the Certinia Apex Parser / Apex Dev Tools
 * parser patterns (https://github.com/apex-dev-tools/apex-parser), licensed under the
 * 3-clause BSD License. The parser grammar uses an Antlr4 grammar originally from Tooling-force.com.
 * This version has been significantly modified, refactored, and extended for Mermaid flowchart generation.
 */

/**
 * Helper to get the exact source text substring of a rule context.
 */
function getSourceText(ctx, sourceCode) {
  if (!ctx || !ctx.start || !ctx.stop) {
    return "";
  }
  const startIdx = ctx.start.start;
  const stopIdx = ctx.stop.stop;
  return sourceCode.substring(startIdx, stopIdx + 1).trim();
}

/**
 * Pads the lines of a node label with spaces so that text does not touch
 * the borders of flowchart boxes/diamonds.
 */
function formatNodeLabel(sanitizedText) {
  if (!sanitizedText) return "";
  return sanitizedText
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

/**
 * Simplifies and sanitizes labels for Mermaid flowchart compatibility.
 * Inserts smart line breaks so long code fits nicely on the canvas.
 */
function sanitizeLabel(text) {
  if (!text) return "";

  // 1. Simplify and format SOQL queries: detect [select ... from SObjectType ...]
  // We keep SObject and filter conditions, but put them on structured newlines.
  let simplified = text.replace(
    /\[\s*select\s+.*?\s+from\s+(\w+)(.*?)\s*\]/gi,
    (match, sObjectType, rest) => {
      let cleanRest = rest.trim();
      // Collapse internal whitespace
      cleanRest = cleanRest.replace(/\s+/g, " ");

      let clauses = cleanRest
        .replace(/\bwhere\b/gi, "\n  WHERE")
        .replace(/\border\s+by\b/gi, "\n  ORDER BY")
        .replace(/\blimit\b/gi, "\n  LIMIT");

      return `[\n  SELECT ...\n  FROM ${sObjectType}${clauses ? "\n  " + clauses.trim() : ""}\n]`;
    }
  );

  // 2. Sanitize characters for Mermaid double-quoted strings
  let sanitized = simplified.replace(/"/g, "'");

  // 3. Insert smart line breaks for fluent method chains (e.g. .addTag().setRecord())
  sanitized = sanitized.replace(/\)\s*\.\s*(\w+)\(/g, ")\n  .$1(");

  // 4. Wrap long lines (max 50 chars) at logical boundaries (operators, commas, spaces)
  const maxLineLen = 50;
  let lines = sanitized.split(/\r?\n/);
  let formattedLines = [];

  for (let line of lines) {
    let trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (trimmedLine.length <= maxLineLen) {
      formattedLines.push(trimmedLine);
      continue;
    }

    let currentLine = trimmedLine;
    let prevLength = currentLine.length;

    while (currentLine.length > maxLineLen) {
      let breakIdx = -1;

      // Find last binary operator like ' && ', ' || ', ' + ' before maxLineLen
      const opRegex = /\s+(&&|\|\||\+)\s+/g;
      let match;
      let lastOpIdx = -1;
      while ((match = opRegex.exec(currentLine)) !== null) {
        if (match.index + match[0].length <= maxLineLen) {
          lastOpIdx = match.index + match[0].length;
        } else {
          break;
        }
      }

      if (lastOpIdx !== -1) {
        breakIdx = lastOpIdx;
      } else {
        // Look for last comma ',' before maxLineLen
        let lastCommaIdx = currentLine.lastIndexOf(",", maxLineLen);
        if (lastCommaIdx !== -1 && lastCommaIdx > 10) {
          breakIdx = lastCommaIdx + 1; // Break right after the comma
        } else {
          // Look for last space ' ' before maxLineLen
          let lastSpaceIdx = currentLine.lastIndexOf(" ", maxLineLen);
          if (lastSpaceIdx !== -1 && lastSpaceIdx > 10) {
            breakIdx = lastSpaceIdx + 1;
          }
        }
      }

      if (breakIdx !== -1) {
        formattedLines.push(currentLine.substring(0, breakIdx).trimEnd());
        currentLine = "  " + currentLine.substring(breakIdx).trimStart();
      } else {
        // Force break at maxLineLen
        formattedLines.push(currentLine.substring(0, maxLineLen).trimEnd());
        currentLine = "  " + currentLine.substring(maxLineLen).trimStart();
      }

      // Safeguard against infinite loop:
      if (currentLine.length >= prevLength) {
        // Force slice to guarantee progress
        formattedLines.push(currentLine.substring(0, maxLineLen).trimEnd());
        currentLine = "  " + currentLine.substring(maxLineLen).trimStart();
        if (currentLine.length >= prevLength) {
          break;
        }
      }
      prevLength = currentLine.length;
    }
    formattedLines.push(currentLine);
  }

  // Join back using actual newlines
  return formattedLines.join("\n");
}

/**
 * Main Apex-to-Mermaid converter function.
 */
export function convertApexToMermaid(sourceCode, targetMethodName) {
  if (!sourceCode) {
    return {
      mermaidCode:
        'stateDiagram-v2\n  state "No source code provided" as ERROR',
      methods: [],
      selectedMethod: ""
    };
  }

  // 1. Initialize the parser using the factory
  const parser = window.apexParser.ApexParserFactory.createParser(sourceCode);

  // Parse compilation unit (root node)
  const tree = parser.compilationUnit();

  // 2. Walk the tree to find methods
  class MethodFinderVisitor extends window.apexParser.ApexParserBaseVisitor {
    constructor() {
      super();
      this.methods = [];
      this.targetMethodCtx = null;
    }

    visitMethodDeclaration(ctx) {
      const idCtx = ctx.id();
      const name = idCtx ? idCtx.getText() : "";
      if (name) {
        this.methods.push(name);
        if (
          targetMethodName &&
          name.toLowerCase() === targetMethodName.toLowerCase()
        ) {
          this.targetMethodCtx = ctx;
        }
      }
      return this.visitChildren(ctx);
    }
  }

  const finder = new MethodFinderVisitor();
  finder.visit(tree);

  const methodsList = finder.methods;
  let selectedMethod = targetMethodName;

  // Auto-detect a default method if not specified or not found exactly
  let matchedMethod = null;
  if (selectedMethod) {
    const selLower = selectedMethod.toLowerCase();
    matchedMethod = methodsList.find((m) => m.toLowerCase() === selLower);
  }

  if (matchedMethod) {
    selectedMethod = matchedMethod;
  } else {
    // Look for @InvocableMethod annotation in the class code to use as the default entry point
    let invocableMethodName = "";
    const invocableRegex =
      /@InvocableMethod\s*(?:\([^)]*\))?\s*(?:public|global|private|protected|static|virtual|override|\s)+[\w<>]+\s+(\w+)\s*\(/gi;
    let match;
    invocableRegex.lastIndex = 0;
    while ((match = invocableRegex.exec(sourceCode)) !== null) {
      if (match[1]) {
        invocableMethodName = match[1];
        break;
      }
    }

    // Verify the detected invocable method name actually exists in the methods list
    const invocableMatch = invocableMethodName
      ? methodsList.find(
          (m) => m.toLowerCase() === invocableMethodName.toLowerCase()
        )
      : null;

    if (invocableMatch) {
      selectedMethod = invocableMatch;
    } else {
      const triggerEvents = [
        "beforeInsert",
        "afterInsert",
        "beforeUpdate",
        "afterUpdate",
        "beforeDelete",
        "afterDelete",
        "afterUndelete"
      ];
      const defaultMethod = methodsList.find((m) =>
        triggerEvents.some((event) => event.toLowerCase() === m.toLowerCase())
      );
      selectedMethod = defaultMethod || methodsList[0] || "";
    }
  }

  // Find the context of the selected method if we auto-detected it
  let methodCtx = finder.targetMethodCtx;
  if (!methodCtx && selectedMethod) {
    const targetLower = selectedMethod.toLowerCase();
    class SingleMethodSearchVisitor
      extends window.apexParser.ApexParserBaseVisitor
    {
      constructor() {
        super();
        this.ctx = null;
      }
      visitMethodDeclaration(ctx) {
        const idCtx = ctx.id();
        const name = idCtx ? idCtx.getText() : "";
        if (name && name.toLowerCase() === targetLower) {
          this.ctx = ctx;
        }
        return this.visitChildren(ctx);
      }
    }
    const searcher = new SingleMethodSearchVisitor();
    searcher.visit(tree);
    methodCtx = searcher.ctx;
  }

  if (!methodCtx) {
    return {
      mermaidCode: `stateDiagram-v2\n  state "No methods found to diagram" as EMPTY`,
      methods: methodsList,
      selectedMethod: selectedMethod
    };
  }

  // 3. Translate the method body to control flow nodes
  const lines = [
    "flowchart TD",
    "  classDef pink fill:#F43F5E, color:#ffffff",
    "  classDef orange fill:#F97316, color:#ffffff",
    "  classDef navy fill:#475569, color:#ffffff",
    "  classDef blue fill:#0284C7, color:#ffffff",
    "",
    '  METHOD_START(["METHOD_START"])',
    '  METHOD_END(["METHOD_END"])',
    "  class METHOD_START navy;",
    "  class METHOD_END navy;"
  ];

  let nodeIdCounter = 0;
  function nextNodeId(prefix = "node") {
    return `${prefix}_${++nodeIdCounter}`;
  }

  function processBlock(blockCtx, entryNodeId, exitNodeId, finalExitNodeId) {
    const statements = blockCtx.statement_list() || [];
    if (statements.length === 0) {
      lines.push(`  ${entryNodeId} --> ${exitNodeId}`);
      return entryNodeId;
    }

    let currentExit = exitNodeId;
    for (let i = statements.length - 1; i >= 0; i--) {
      currentExit = processStatement(
        statements[i],
        currentExit,
        finalExitNodeId
      );
    }

    lines.push(`  ${entryNodeId} --> ${currentExit}`);
    return currentExit;
  }

  function processBlockInner(blockCtx, exitNodeId, finalExitNodeId) {
    const statements = blockCtx.statement_list() || [];
    if (statements.length === 0) {
      return exitNodeId;
    }
    let currentExit = exitNodeId;
    for (let i = statements.length - 1; i >= 0; i--) {
      currentExit = processStatement(
        statements[i],
        currentExit,
        finalExitNodeId
      );
    }
    return currentExit;
  }

  function processStatement(stmtCtx, exitNodeId, finalExitNodeId) {
    if (!stmtCtx) {
      return exitNodeId;
    }

    // 1. Block Statement
    if (stmtCtx.block()) {
      return processBlockInner(stmtCtx.block(), exitNodeId, finalExitNodeId);
    }

    // 2. If Statement
    if (stmtCtx.ifStatement()) {
      const ifCtx = stmtCtx.ifStatement();
      const condText = getSourceText(ifCtx.parExpression(), sourceCode);
      const choiceId = nextNodeId("choice");
      const logicId = `${choiceId}_Logic`;
      const sanitizedCond = sanitizeLabel(condText);
      const nodeLabel = formatNodeLabel(sanitizedCond);

      lines.push(`  ${choiceId}{"IF"}`);
      lines.push(`  ${logicId}["${nodeLabel}"]`);
      lines.push(`  ${logicId} -.- ${choiceId}`);
      lines.push(`  class ${choiceId} orange;`);
      lines.push(`  class ${logicId} orange;`);

      const thenStmt = ifCtx.statement(0);
      const elseStmt = ifCtx.statement(1);

      const thenEntry = processStatement(thenStmt, exitNodeId, finalExitNodeId);
      lines.push(`  ${choiceId} -->|True| ${thenEntry}`);

      if (elseStmt) {
        const elseEntry = processStatement(
          elseStmt,
          exitNodeId,
          finalExitNodeId
        );
        lines.push(`  ${choiceId} -->|False| ${elseEntry}`);
      } else {
        lines.push(`  ${choiceId} -->|False| ${exitNodeId}`);
      }
      return choiceId;
    }

    // 3. While Loop
    if (stmtCtx.whileStatement()) {
      const whileCtx = stmtCtx.whileStatement();
      const condText = getSourceText(whileCtx.parExpression(), sourceCode);
      const choiceId = nextNodeId("loop_cond");
      const logicId = `${choiceId}_Logic`;
      const sanitizedCond = sanitizeLabel(condText);
      const nodeLabel = formatNodeLabel(sanitizedCond);

      lines.push(`  ${choiceId}{"WHILE"}`);
      lines.push(`  ${logicId}["${nodeLabel}"]`);
      lines.push(`  ${logicId} -.- ${choiceId}`);
      lines.push(`  class ${choiceId} orange;`);
      lines.push(`  class ${logicId} orange;`);

      const bodyStmt = whileCtx.statement();
      const bodyEntry = processStatement(bodyStmt, choiceId, finalExitNodeId);

      lines.push(`  ${choiceId} -->|True| ${bodyEntry}`);
      lines.push(`  ${choiceId} -->|False| ${exitNodeId}`);
      return choiceId;
    }

    // 4. For Loop
    if (stmtCtx.forStatement()) {
      const forCtx = stmtCtx.forStatement();
      const forControlText = getSourceText(forCtx.forControl(), sourceCode);
      const choiceId = nextNodeId("loop_cond");
      const logicId = `${choiceId}_Logic`;
      const sanitizedControl = sanitizeLabel(forControlText);
      const nodeLabel = formatNodeLabel(sanitizedControl);

      lines.push(`  ${choiceId}{"FOR"}`);
      lines.push(`  ${logicId}["${nodeLabel}"]`);
      lines.push(`  ${logicId} -.- ${choiceId}`);
      lines.push(`  class ${choiceId} orange;`);
      lines.push(`  class ${logicId} orange;`);

      const bodyStmt = forCtx.statement();
      const bodyEntry = processStatement(bodyStmt, choiceId, finalExitNodeId);

      lines.push(`  ${choiceId} -->|Each item| ${bodyEntry}`);
      lines.push(`  ${choiceId} -->|Done| ${exitNodeId}`);
      return choiceId;
    }

    // 5. Return Statement
    if (stmtCtx.returnStatement()) {
      const retText = getSourceText(
        stmtCtx.returnStatement(),
        sourceCode
      ).replace(/;$/, "");
      const retId = nextNodeId("return");
      const sanitizedRet = sanitizeLabel(retText);
      const nodeLabel = formatNodeLabel(sanitizedRet);
      lines.push(`  ${retId}["${nodeLabel}"]`);
      lines.push(`  class ${retId} blue;`);
      lines.push(`  ${retId} --> ${finalExitNodeId}`);
      return retId;
    }

    // 6. DML Statement
    const dmlCtx =
      stmtCtx.insertStatement() ||
      stmtCtx.updateStatement() ||
      stmtCtx.deleteStatement() ||
      stmtCtx.upsertStatement() ||
      stmtCtx.undeleteStatement() ||
      stmtCtx.mergeStatement();

    if (dmlCtx) {
      const dmlText = getSourceText(dmlCtx, sourceCode);
      const dmlId = nextNodeId("dml");
      const sanitizedDml = sanitizeLabel(dmlText);
      const nodeLabel = formatNodeLabel(`DML ⚡\n${sanitizedDml}`);
      lines.push(`  ${dmlId}["${nodeLabel}"]`);
      lines.push(`  class ${dmlId} pink;`);
      lines.push(`  ${dmlId} --> ${exitNodeId}`);
      return dmlId;
    }

    // 7. General Statement
    let stmtText = getSourceText(stmtCtx, sourceCode).replace(/;$/, "");
    if (!stmtText) {
      return exitNodeId;
    }

    const actionId = nextNodeId("action");
    const sanitizedStmt = sanitizeLabel(stmtText);
    const nodeLabel = formatNodeLabel(sanitizedStmt);
    lines.push(`  ${actionId}["${nodeLabel}"]`);
    lines.push(`  class ${actionId} blue;`);
    lines.push(`  ${actionId} --> ${exitNodeId}`);
    return actionId;
  }

  const blockCtx = methodCtx.block();
  if (blockCtx) {
    processBlock(blockCtx, "METHOD_START", "METHOD_END", "METHOD_END");
  } else {
    lines.push("  METHOD_START --> METHOD_END");
  }

  return {
    mermaidCode: lines.join("\n"),
    methods: methodsList,
    selectedMethod: selectedMethod
  };
}
