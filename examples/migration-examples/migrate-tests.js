#!/usr/bin/env node

/**
 * Migration Helper Script for QuickFig
 * 
 * Automates common migration patterns:
 * - Updates imports to use @fig-grove/quickfig
 * - Converts function-based runSandboxed calls to string-based
 * - Adds result extraction helpers
 * 
 * Usage:
 *   node migrate-tests.js ./test/**/*.test.js
 *   node migrate-tests.js ./test/specific-test.test.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

class TestMigrator {
  constructor() {
    this.migratedFiles = [];
    this.errors = [];
  }

  /**
   * Main migration function
   */
  migrate(filePattern) {
    console.log(`🔄 Starting migration for pattern: ${filePattern}`);
    
    const files = glob.sync(filePattern);
    
    if (files.length === 0) {
      console.log('❌ No files found matching pattern');
      return;
    }

    console.log(`📁 Found ${files.length} test files to migrate`);
    
    files.forEach(filePath => {
      try {
        this.migrateFile(filePath);
        this.migratedFiles.push(filePath);
      } catch (error) {
        this.errors.push({ file: filePath, error: error.message });
        console.error(`❌ Error migrating ${filePath}: ${error.message}`);
      }
    });
    
    this.printSummary();
  }

  /**
   * Migrate a single test file
   */
  migrateFile(filePath) {
    console.log(`🔄 Migrating: ${filePath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Step 1: Update imports
    content = this.updateImports(content);
    
    // Step 2: Convert function-based runSandboxed calls
    content = this.convertFunctionCalls(content);
    
    // Step 3: Add result extraction pattern
    content = this.addResultExtraction(content);
    
    // Step 4: Update test environment initialization
    content = this.updateTestEnvironment(content);
    
    // Only write if content changed
    if (content !== originalContent) {
      // Create backup
      const backupPath = filePath + '.backup';
      fs.writeFileSync(backupPath, originalContent);
      
      // Write migrated content
      fs.writeFileSync(filePath, content);
      
      console.log(`✅ Migrated: ${filePath} (backup: ${backupPath})`);
    } else {
      console.log(`⚪ No changes needed: ${filePath}`);
    }
  }

  /**
   * Update imports to use the framework
   */
  updateImports(content) {
    // Remove old imports
    const oldImportPatterns = [
      /import.*from.*['"]\.\.\/.*[mock|harness|setup].*['"];?\s*\n/g,
      /import.*\{.*mock.*\}.*from.*['"].*['"];?\s*\n/g,
      /import.*\{.*harness.*\}.*from.*['"].*['"];?\s*\n/g,
      /const.*=.*require\(['"]\.\.\/.*[mock|harness].*['"]\);?\s*\n/g
    ];
    
    oldImportPatterns.forEach(pattern => {
      content = content.replace(pattern, '');
    });
    
    // Add new import if not already present
    if (!content.includes('@fig-grove/quickfig')) {
      const importLine = "import { createFigmaTestEnvironment } from '@fig-grove/quickfig';\n";
      
      // Find the last import statement
      const importMatch = content.match(/^import.*from.*['"].*['"];?\s*$/gm);
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1];
        const lastImportIndex = content.indexOf(lastImport) + lastImport.length;
        content = content.slice(0, lastImportIndex) + '\n' + importLine + content.slice(lastImportIndex);
      } else {
        // No imports found, add at the top
        content = importLine + '\n' + content;
      }
    }
    
    return content;
  }

  /**
   * Convert function-based runSandboxed calls to string-based
   */
  convertFunctionCalls(content) {
    // Pattern to match: runSandboxed(() => { ... })
    const functionPattern = /runSandboxed\(\(\) => \{([\s\S]*?)\}\)/g;
    
    content = content.replace(functionPattern, (match, functionBody) => {
      // Clean up the function body
      const cleanBody = functionBody.trim();
      
      // Convert to string-based call
      return `runSandboxed(\`\n${cleanBody}\n\`)`;
    });
    
    // Pattern to match: runSandboxed(async () => { ... })
    const asyncFunctionPattern = /runSandboxed\(async \(\) => \{([\s\S]*?)\}\)/g;
    
    content = content.replace(asyncFunctionPattern, (match, functionBody) => {
      const cleanBody = functionBody.trim();
      return `runSandboxed(\`\n${cleanBody}\n\`)`;
    });
    
    return content;
  }

  /**
   * Add result extraction pattern where needed
   */
  addResultExtraction(content) {
    // Find test functions that use runSandboxed
    const testPattern = /test\(['"`]([^'"`]+)['"`],\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\);/g;
    
    content = content.replace(testPattern, (match, testName, testBody) => {
      // Check if test uses runSandboxed and accesses result directly
      if (testBody.includes('runSandboxed') && testBody.includes('result.') && !testBody.includes('testData')) {
        // Add result extraction helper
        const extractionHelper = `
    // Extract data from framework result structure
    const testData = (result && typeof result === 'object' && 'data' in result) 
      ? result.data 
      : result;`;
        
        // Insert after the runSandboxed call
        const runSandboxedPattern = /(const result = await runSandboxed\([^;]+\);)/;
        testBody = testBody.replace(runSandboxedPattern, `$1${extractionHelper}`);
        
        // Replace result. with testData.
        testBody = testBody.replace(/result\./g, 'testData.');
      }
      
      return `test('${testName}', async (t) => {${testBody}});`;
    });
    
    return content;
  }

  /**
   * Update test environment initialization
   */
  updateTestEnvironment(content) {
    // Replace old test environment patterns
    const oldEnvironmentPatterns = [
      /const\s*\{\s*runSandboxed\s*\}\s*=\s*mockTestEnvironment\(\);?/g,
      /const\s*\{\s*mockRunSandboxed\s*\}\s*=\s*mockFigmaEnvironment\(\);?/g,
      /const\s*\{\s*runSandboxed\s*\}\s*=\s*createTestEnvironment\(\);?/g
    ];
    
    oldEnvironmentPatterns.forEach(pattern => {
      content = content.replace(pattern, 'const { runSandboxed } = await createFigmaTestEnvironment();');
    });
    
    return content;
  }

  /**
   * Print migration summary
   */
  printSummary() {
    console.log('\n📊 MIGRATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log(`✅ Successfully migrated: ${this.migratedFiles.length} files`);
    
    if (this.errors.length > 0) {
      console.log(`❌ Errors encountered: ${this.errors.length} files`);
      this.errors.forEach(({ file, error }) => {
        console.log(`   ${file}: ${error}`);
      });
    }
    
    console.log('\n📋 NEXT STEPS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Review migrated files for correctness');
    console.log('2. Run tests to verify migration: npm test');
    console.log('3. Validate with CLI: npx quickfig validate ./src/plugin.js');
    console.log('4. Remove backup files once confirmed working');
    
    if (this.migratedFiles.length > 0) {
      console.log('\n🗂️ BACKUP FILES CREATED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.migratedFiles.forEach(file => {
        console.log(`   ${file}.backup`);
      });
      console.log('\nRemove backups with: rm **/*.backup');
    }
  }
}

/**
 * CLI entry point
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🔄 QuickFig Migration Helper

Usage:
  node migrate-tests.js <file-pattern>

Examples:
  node migrate-tests.js "./test/**/*.test.js"
  node migrate-tests.js "./src/test/*.test.js"
  node migrate-tests.js "./test/specific-test.test.js"

What this script does:
  ✅ Updates imports to use @fig-grove/quickfig
  ✅ Converts function-based runSandboxed() to string-based
  ✅ Adds result extraction helpers
  ✅ Updates test environment initialization
  ✅ Creates backup files (.backup)

Manual steps still needed:
  🔧 Review string conversion for complex function bodies
  🔧 Update assertions to use testData instead of result
  🔧 Add proper error handling for constraint validation
  🔧 Test and validate migrations
    `);
    process.exit(0);
  }

  const filePattern = args[0];
  const migrator = new TestMigrator();
  
  try {
    migrator.migrate(filePattern);
  } catch (error) {
    console.error(`❌ Migration failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = TestMigrator;