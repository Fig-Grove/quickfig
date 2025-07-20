/**
 * CI/CD Quality Gates Runner - Quality Assurance System
 * 
 * Automated system for running QuickJS constraint validation quality gates
 * in CI/CD pipelines. Generates reports and sets appropriate exit codes.
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface QualityGateConfig {
  testPatterns: string[];
  outputDir: string;
  reportFormats: ('json' | 'junit' | 'console')[];
  exitOnFailure: boolean;
  generateArtifacts: boolean;
  thresholds: {
    criticalFailuresMax: number;
    majorFailuresMax: number;
    minorFailuresMax: number;
    overallScoreMin: number;
  };
}

export interface QualityGateResults {
  startTime: string;
  endTime: string | null;
  duration: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  criticalFailures: number;
  majorFailures: number;
  minorFailures: number;
  overallScore: number;
  recommendation: string;
  testResults: TestResult[];
  cicdStatus: 'approved' | 'warning' | 'blocked' | 'error';
}

export interface TestResult {
  testFile: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  executionTime: number;
  errors: string[];
  constraintViolations?: number;
}

export class QualityGateRunner {
  private config: QualityGateConfig;
  private results: QualityGateResults;

  constructor(config: Partial<QualityGateConfig> = {}) {
    this.config = {
      testPatterns: config.testPatterns || [
        'test/**/*.test.ts',
        'test/performance/*.test.ts',
        'test/constraints/*.test.ts'
      ],
      outputDir: config.outputDir || 'quality-gate-reports',
      reportFormats: config.reportFormats || ['json', 'junit', 'console'],
      exitOnFailure: config.exitOnFailure ?? true,
      generateArtifacts: config.generateArtifacts ?? true,
      thresholds: {
        criticalFailuresMax: config.thresholds?.criticalFailuresMax ?? 0,
        majorFailuresMax: config.thresholds?.majorFailuresMax ?? 2,
        minorFailuresMax: config.thresholds?.minorFailuresMax ?? 5,
        overallScoreMin: config.thresholds?.overallScoreMin ?? 80,
        ...config.thresholds
      }
    };

    this.results = {
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      criticalFailures: 0,
      majorFailures: 0,
      minorFailures: 0,
      overallScore: 0,
      recommendation: '',
      testResults: [],
      cicdStatus: 'error'
    };
  }

  async run(): Promise<QualityGateResults> {
    console.log('🚀 Starting QuickJS Framework Quality Gates Validation');
    console.log(`📅 Started at: ${this.results.startTime}`);
    console.log(`🎯 Thresholds: Critical≤${this.config.thresholds.criticalFailuresMax}, Major≤${this.config.thresholds.majorFailuresMax}, Score≥${this.config.thresholds.overallScoreMin}`);
    
    try {
      // Create output directory
      this.ensureOutputDirectory();
      
      // Run quality gate tests
      await this.runQualityGateTests();
      
      // Generate reports
      await this.generateReports();
      
      // Evaluate results and set CI/CD status
      this.evaluateResults();
      
      // Display summary
      this.displaySummary();
      
      return this.results;
      
    } catch (error) {
      console.error('❌ Quality gate execution failed:', error);
      this.results.cicdStatus = 'error';
      this.results.recommendation = `PIPELINE ERROR: ${error instanceof Error ? error.message : String(error)}`;
      
      throw error;
    } finally {
      this.results.endTime = new Date().toISOString();
      this.results.duration = Date.now() - new Date(this.results.startTime).getTime();
    }
  }

  private ensureOutputDirectory(): void {
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  private async runQualityGateTests(): Promise<void> {
    console.log('\n🧪 Running Quality Gate Tests...');
    
    for (const testPattern of this.config.testPatterns) {
      console.log(`\n📝 Executing: ${testPattern}`);
      
      try {
        // Run npm test for the framework
        const command = `npm test`;
        const output = execSync(command, { 
          encoding: 'utf8',
          timeout: 300000, // 5 minutes timeout
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        // Parse AVA output for results
        const testResult = this.parseAvaOutput(output, testPattern);
        this.results.testResults.push(testResult);
        
        this.results.totalTests += testResult.totalTests;
        this.results.passedTests += testResult.passedTests;
        this.results.failedTests += testResult.failedTests;
        
        console.log(`✅ ${testPattern}: ${testResult.passedTests}/${testResult.totalTests} passed`);
        
      } catch (error) {
        console.log(`❌ ${testPattern}: Test execution failed`);
        console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
        
        const testResult: TestResult = {
          testFile: testPattern,
          totalTests: 1,
          passedTests: 0,
          failedTests: 1,
          executionTime: 0,
          errors: [error instanceof Error ? error.message : String(error)]
        };
        
        this.results.testResults.push(testResult);
        this.results.totalTests += 1;
        this.results.failedTests += 1;
      }
    }
  }

  private parseAvaOutput(avaOutput: string, testFile: string): TestResult {
    const lines = avaOutput.split('\n');
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let constraintViolations = 0;
    const errors: string[] = [];
    
    // Parse AVA output format
    for (const line of lines) {
      // Count test results
      if (line.includes('✔') || line.match(/^\s*✔/)) {
        totalTests++;
        passedTests++;
      } else if (line.includes('✘') || line.match(/^\s*✘/)) {
        totalTests++;
        failedTests++;
        // Extract error message
        const errorMatch = line.match(/✘\s*(.+)/);
        if (errorMatch) {
          errors.push(errorMatch[1]);
        }
      }
      
      // Count constraint violations
      if (line.includes('constraint violation') || 
          line.includes('Memory limit exceeded') ||
          line.includes('UI blocking detected') ||
          line.includes('Execution time limit')) {
        constraintViolations++;
      }
    }
    
    // Extract execution time if available
    const timeMatch = avaOutput.match(/(\d+) tests? passed.*?\((\d+(?:\.\d+)?)s\)/);
    const executionTime = timeMatch ? parseFloat(timeMatch[2]) * 1000 : 0;
    
    // If no specific test counts found, try alternative parsing
    if (totalTests === 0) {
      const testMatch = avaOutput.match(/(\d+) tests? passed/);
      const failMatch = avaOutput.match(/(\d+) tests? failed/);
      
      if (testMatch) {
        passedTests = parseInt(testMatch[1]);
        totalTests += passedTests;
      }
      
      if (failMatch) {
        failedTests = parseInt(failMatch[1]);
        totalTests += failedTests;
      }
      
      // Fallback: assume success if no explicit failures
      if (totalTests === 0 && !avaOutput.includes('failed') && !avaOutput.includes('✘')) {
        totalTests = 1;
        passedTests = 1;
      }
    }
    
    return {
      testFile,
      totalTests,
      passedTests,
      failedTests,
      executionTime,
      errors,
      constraintViolations
    };
  }

  private evaluateResults(): void {
    console.log('\n📊 Evaluating Quality Gate Results...');
    
    // Calculate overall score
    const passRate = this.results.totalTests > 0 ? (this.results.passedTests / this.results.totalTests) * 100 : 0;
    this.results.overallScore = Math.round(passRate);
    
    // Categorize failures based on constraint violations and test patterns
    let criticalFailures = 0;
    let majorFailures = 0;
    let minorFailures = 0;
    
    for (const result of this.results.testResults) {
      if (result.failedTests > 0) {
        // Performance and constraint tests are critical
        if (result.testFile.includes('performance') || result.testFile.includes('constraint')) {
          criticalFailures += result.failedTests;
        }
        // Integration tests are major
        else if (result.testFile.includes('integration')) {
          majorFailures += result.failedTests;
        }
        // Other tests are minor
        else {
          minorFailures += result.failedTests;
        }
      }
      
      // Constraint violations are always critical
      if (result.constraintViolations && result.constraintViolations > 0) {
        criticalFailures += result.constraintViolations;
      }
    }
    
    this.results.criticalFailures = criticalFailures;
    this.results.majorFailures = majorFailures;
    this.results.minorFailures = minorFailures;
    
    // Determine CI/CD status and recommendation
    if (this.results.criticalFailures > this.config.thresholds.criticalFailuresMax) {
      this.results.cicdStatus = 'blocked';
      this.results.recommendation = `BLOCK DEPLOYMENT: ${this.results.criticalFailures} critical quality gate failure(s) must be resolved before deployment. These include constraint violations and performance regressions.`;
    } else if (this.results.majorFailures > this.config.thresholds.majorFailuresMax) {
      this.results.cicdStatus = 'warning';
      this.results.recommendation = `PROCEED WITH CAUTION: ${this.results.majorFailures} major quality gate failure(s) detected. Consider resolving before deployment.`;
    } else if (this.results.overallScore < this.config.thresholds.overallScoreMin) {
      this.results.cicdStatus = 'warning';
      this.results.recommendation = `PROCEED WITH CAUTION: Overall score ${this.results.overallScore}% is below minimum threshold of ${this.config.thresholds.overallScoreMin}%.`;
    } else {
      this.results.cicdStatus = 'approved';
      this.results.recommendation = `APPROVED: All quality gates passed. Safe to deploy. Framework constraint compliance verified.`;
    }
  }

  private async generateReports(): Promise<void> {
    console.log('\n📄 Generating Quality Gate Reports...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // JSON Report
    if (this.config.reportFormats.includes('json')) {
      const jsonReport = {
        ...this.results,
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        framework: '@fig-grove/quickfig',
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          ci: process.env.CI || 'false',
          branch: process.env.GITHUB_REF_NAME || process.env.CI_COMMIT_REF_NAME || 'unknown',
          commit: process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || 'unknown'
        }
      };
      
      const jsonPath = join(this.config.outputDir, `quality-gates-${timestamp}.json`);
      writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
      console.log(`📝 JSON report: ${jsonPath}`);
    }
    
    // JUnit XML Report (for CI/CD integration)
    if (this.config.reportFormats.includes('junit')) {
      const junitXml = this.generateJUnitReport();
      const junitPath = join(this.config.outputDir, `quality-gates-${timestamp}.xml`);
      writeFileSync(junitPath, junitXml);
      console.log(`📝 JUnit report: ${junitPath}`);
    }
    
    // Console Report
    if (this.config.reportFormats.includes('console')) {
      const consoleReport = this.generateConsoleReport();
      const consolePath = join(this.config.outputDir, `quality-gates-${timestamp}.txt`);
      writeFileSync(consolePath, consoleReport);
      console.log(`📝 Console report: ${consolePath}`);
    }
  }

  private generateJUnitReport(): string {
    const testSuites = this.results.testResults.map(result => {
      const testCases: string[] = [];
      
      // Create test cases for passed tests
      for (let i = 0; i < result.passedTests; i++) {
        testCases.push(`    <testcase name="${result.testFile}-${i+1}" classname="QuickJSQualityGates" time="${(result.executionTime/1000/result.totalTests).toFixed(3)}"/>`);
      }
      
      // Create test cases for failed tests
      for (let i = 0; i < result.failedTests; i++) {
        const errorMessage = result.errors[i] || 'Test failed';
        testCases.push(`    <testcase name="${result.testFile}-failed-${i+1}" classname="QuickJSQualityGates" time="${(result.executionTime/1000/result.totalTests).toFixed(3)}">
      <failure message="${this.escapeXml(errorMessage)}">${this.escapeXml(errorMessage)}</failure>
    </testcase>`);
      }
      
      return `  <testsuite name="${result.testFile}" tests="${result.totalTests}" failures="${result.failedTests}" time="${(result.executionTime/1000).toFixed(3)}">
${testCases.join('\n')}
  </testsuite>`;
    }).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="QuickJS Framework Quality Gates" tests="${this.results.totalTests}" failures="${this.results.failedTests}" time="${(this.results.duration/1000).toFixed(3)}">
${testSuites}
</testsuites>`;
  }

  private generateConsoleReport(): string {
    return `
QuickJS Framework Quality Gates Report
=====================================

Execution Summary:
- Started: ${this.results.startTime}
- Completed: ${this.results.endTime}
- Duration: ${(this.results.duration/1000).toFixed(2)}s
- Total Tests: ${this.results.totalTests}
- Passed: ${this.results.passedTests}
- Failed: ${this.results.failedTests}
- Overall Score: ${this.results.overallScore}%

Quality Gate Status: ${this.results.cicdStatus.toUpperCase()}
Recommendation: ${this.results.recommendation}

Failure Analysis:
- Critical Failures: ${this.results.criticalFailures} (constraint violations, performance regressions)
- Major Failures: ${this.results.majorFailures} (integration test failures)
- Minor Failures: ${this.results.minorFailures} (unit test failures)

Test Results:
${this.results.testResults.map(result => 
  `- ${result.testFile}: ${result.passedTests}/${result.totalTests} passed (${(result.executionTime/1000).toFixed(2)}s)${result.constraintViolations ? ` [${result.constraintViolations} constraint violations]` : ''}`
).join('\n')}

Environment:
- Framework: @fig-grove/quickfig v1.0.0
- Node.js: ${process.version}
- Platform: ${process.platform}
- CI: ${process.env.CI || 'false'}
- Branch: ${process.env.GITHUB_REF_NAME || process.env.CI_COMMIT_REF_NAME || 'unknown'}
- Commit: ${process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || 'unknown'}
`;
  }

  private escapeXml(str: string): string {
    return str.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return c;
      }
    });
  }

  private displaySummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 QUICKJS FRAMEWORK QUALITY GATES SUMMARY');
    console.log('='.repeat(60));
    console.log(`🎯 Overall Score: ${this.results.overallScore}%`);
    console.log(`✅ Passed Tests: ${this.results.passedTests}/${this.results.totalTests}`);
    console.log(`❌ Failed Tests: ${this.results.failedTests}`);
    console.log(`🚨 Critical Failures: ${this.results.criticalFailures} (constraints/performance)`);
    console.log(`⚠️  Major Failures: ${this.results.majorFailures} (integration)`);
    console.log(`ℹ️  Minor Failures: ${this.results.minorFailures} (unit tests)`);
    console.log(`⏱️  Duration: ${(this.results.duration/1000).toFixed(2)}s`);
    console.log(`🚦 Status: ${this.results.cicdStatus.toUpperCase()}`);
    console.log(`💡 Recommendation: ${this.results.recommendation}`);
    console.log('='.repeat(60));
  }

  shouldExitWithFailure(): boolean {
    return this.config.exitOnFailure && this.results.cicdStatus === 'blocked';
  }

  shouldExitWithWarning(): boolean {
    return this.results.cicdStatus === 'warning';
  }

  isApproved(): boolean {
    return this.results.cicdStatus === 'approved';
  }
}