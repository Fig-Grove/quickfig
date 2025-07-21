import { type SandboxOptions, loadQuickJs } from "@sebastianwessel/quickjs";

export const FIGMA_SANDBOX_CONFIG: SandboxOptions = {
  // Figma plugin constraints
  allowFetch: false, // Figma plugins limited network access
  allowFs: false, // No direct file system access
  enableTestUtils: false, // Disable to avoid fs-related issues

  // Performance constraints matching Figma
  executionTimeout: 50, // 50ms UI blocking threshold
  maxStackSize: 1024 * 1024, // 1MB stack limit
  memoryLimit: 100 * 1024 * 1024, // 100MB per plugin operation

  // Environment variables for testing
  env: {
    NODE_ENV: "figma-plugin-test",
    FIGMA_PLUGIN_SIMULATION: "true",
  },

  // Custom console for test output
  console: {
    log: (message, ...args) => console.log(`[QuickJS]: ${message}`, ...args),
    error: (message, ...args) =>
      console.error(`[QuickJS Error]: ${message}`, ...args),
    warn: (message, ...args) =>
      console.warn(`[QuickJS Warning]: ${message}`, ...args),
  },
};

/**
 * Wrapper to adapt the current test usage patterns to the correct @sebastianwessel/quickjs API
 */
function createSandboxedFunctionWrapper(originalRunSandboxed: any) {
  return async function runSandboxed(
    code: string | (() => any),
    options?: SandboxOptions,
  ): Promise<any> {
    const config = {
      ...FIGMA_SANDBOX_CONFIG,
      ...options,
      // Explicitly disable file system to avoid __dirname issues
      allowFs: false,
      enableTestUtils: false,
    };

    if (typeof code === "string") {
      // Handle string code by using evalCode
      return originalRunSandboxed(
        async ({ evalCode }: { evalCode: (code: string) => any }) => {
          const result = await evalCode(code);
          // Check if result has ok/data structure and extract data if available
          if (
            result &&
            typeof result === "object" &&
            "ok" in result &&
            "data" in result
          ) {
            return result.data;
          }
          return result;
        },
        config,
      );
    } else if (typeof code === "function") {
      // Handle function code by converting to string and then using evalCode
      const functionBody = code.toString();

      // Improved function parsing with better error handling
      let codeBody: string;

      // Try multiple parsing strategies

      // Strategy 1: Standard function/arrow function patterns
      const standardMatch = functionBody.match(
        /^(?:async\s+)?(?:function\s*)?\([^)]*\)\s*(?:=>\s*)?{\s*([\s\S]*?)\s*}$/,
      );
      if (standardMatch) {
        codeBody = standardMatch[1];
      } else {
        // Strategy 2: Arrow function with implicit return (no braces)
        const arrowMatch = functionBody.match(
          /^(?:async\s+)?\([^)]*\)\s*=>\s*(.+)$/,
        );
        if (arrowMatch) {
          const returnValue = arrowMatch[1].trim();
          // If it's not already wrapped in a return statement, wrap it
          if (!returnValue.startsWith("return ")) {
            codeBody = `return ${returnValue}`;
          } else {
            codeBody = returnValue;
          }
        } else {
          // Strategy 3: Single parameter arrow function
          const singleArrowMatch = functionBody.match(
            /^(?:async\s+)?[^(=>\s]+\s*=>\s*(.+)$/,
          );
          if (singleArrowMatch) {
            const returnValue = singleArrowMatch[1].trim();
            if (returnValue.startsWith("{") && returnValue.endsWith("}")) {
              // It's a function body
              codeBody = returnValue.slice(1, -1).trim();
            } else {
              // It's an expression to return
              codeBody = `return ${returnValue}`;
            }
          } else {
            // Strategy 4: Try to find body between first { and last }
            const firstBrace = functionBody.indexOf("{");
            const lastBrace = functionBody.lastIndexOf("}");
            if (
              firstBrace !== -1 &&
              lastBrace !== -1 &&
              firstBrace < lastBrace
            ) {
              codeBody = functionBody.slice(firstBrace + 1, lastBrace).trim();
            } else {
              throw new Error(
                `Unable to parse function code for sandboxed execution. Function body: ${functionBody.substring(0, 100)}...`,
              );
            }
          }
        }
      }

      // Improved code wrapping logic
      let wrappedCode: string;

      // Check if the code already has a return statement
      const hasReturn = /\breturn\b/.test(codeBody);

      if (hasReturn) {
        // Function already has return statements, use as-is
        wrappedCode = codeBody;
      } else {
        // Check if it's likely an object literal or expression
        const trimmedBody = codeBody.trim();

        // If it starts with an object literal pattern, wrap with return
        if (
          trimmedBody.startsWith("{") &&
          trimmedBody.endsWith("}") &&
          !trimmedBody.includes(";")
        ) {
          wrappedCode = `return ${codeBody}`;
        } else {
          // For code with statements, check if we need to add return for the last expression
          const lines = codeBody
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
          const lastLine = lines[lines.length - 1];

          if (
            lastLine &&
            !lastLine.startsWith("return") &&
            !lastLine.includes(";") &&
            !lastLine.includes("=")
          ) {
            // Last line looks like an expression, wrap it with return
            const otherLines = lines.slice(0, -1).join("\n");
            wrappedCode =
              otherLines + (otherLines ? "\n" : "") + `return ${lastLine}`;
          } else {
            // Use the code as-is
            wrappedCode = codeBody;
          }
        }
      }

      return originalRunSandboxed(
        async ({ evalCode }: { evalCode: (code: string) => any }) => {
          const codeToExecute = `(function() { ${wrappedCode} })()`;
          const result = await evalCode(codeToExecute);
          // Check if result has ok/data structure and extract data if available
          if (
            result &&
            typeof result === "object" &&
            "ok" in result &&
            "data" in result
          ) {
            return result.data;
          }
          return result;
        },
        config,
      );
    } else {
      throw new Error("runSandboxed expects either a string or function");
    }
  };
}

export async function createFigmaTestEnvironment() {
  const { runSandboxed: originalRunSandboxed } = await loadQuickJs();
  const runSandboxed = createSandboxedFunctionWrapper(originalRunSandboxed);
  return { runSandboxed, config: FIGMA_SANDBOX_CONFIG };
}
