/**
 * Benchmark Regression Framework
 * 
 * Tracks performance metrics over time and detects regressions
 * across test runs, branches, and versions.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface BenchmarkMetric {
  name: string;
  value: number;
  unit: 'ms' | 'μs' | 'ops/sec' | 'MB' | 'KB' | 'bytes' | 'count';
  category: 'performance' | 'memory' | 'constraint' | 'throughput';
  timestamp: string;
  metadata: {
    testFile: string;
    environment: string;
    version: string;
    branch: string;
    commit?: string;
  };
}

export interface RegressionDetectionConfig {
  // Thresholds for regression detection
  performanceRegressionThreshold: number; // Percentage increase that constitutes regression
  memoryRegressionThreshold: number;
  constraintRegressionThreshold: number;
  
  // Historical comparison settings
  baselineWindowSize: number; // Number of historical runs to use for baseline
  minimumDataPoints: number; // Minimum data points needed for regression detection
  
  // Output configuration
  outputDir: string;
  generateAlerts: boolean;
  enableTrendAnalysis: boolean;
}

export interface RegressionReport {
  timestamp: string;
  summary: {
    totalMetrics: number;
    regressionsDetected: number;
    improvementsDetected: number;
    stableMetrics: number;
    overallScore: number;
  };
  regressions: Array<{
    metric: BenchmarkMetric;
    baseline: {
      average: number;
      standardDeviation: number;
      dataPoints: number;
    };
    regression: {
      percentageIncrease: number;
      severity: 'minor' | 'major' | 'critical';
      trend: 'degrading' | 'stable' | 'improving';
    };
    recommendation: string;
  }>;
  improvements: Array<{
    metric: BenchmarkMetric;
    percentageImprovement: number;
  }>;
  trends: Array<{
    metricName: string;
    trend: 'improving' | 'stable' | 'degrading';
    changeRate: number; // percentage change per measurement
  }>;
}

export class BenchmarkRegressionTracker {
  private config: RegressionDetectionConfig;
  private metricsFile: string;
  private reportsDir: string;

  constructor(config: Partial<RegressionDetectionConfig> = {}) {
    this.config = {
      performanceRegressionThreshold: config.performanceRegressionThreshold ?? 15, // 15% slower
      memoryRegressionThreshold: config.memoryRegressionThreshold ?? 20, // 20% more memory
      constraintRegressionThreshold: config.constraintRegressionThreshold ?? 5, // 5% more violations
      baselineWindowSize: config.baselineWindowSize ?? 10,
      minimumDataPoints: config.minimumDataPoints ?? 3,
      outputDir: config.outputDir ?? 'benchmark-reports',
      generateAlerts: config.generateAlerts ?? true,
      enableTrendAnalysis: config.enableTrendAnalysis ?? true
    };

    this.reportsDir = this.config.outputDir;
    this.metricsFile = join(this.reportsDir, 'metrics-history.json');
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!existsSync(this.reportsDir)) {
      mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Record a new benchmark metric
   */
  recordMetric(metric: Omit<BenchmarkMetric, 'timestamp'>): void {
    const fullMetric: BenchmarkMetric = {
      ...metric,
      timestamp: new Date().toISOString()
    };

    const history = this.loadMetricsHistory();
    history.push(fullMetric);
    
    // Keep only recent metrics to prevent file from growing too large
    const maxHistorySize = 1000;
    if (history.length > maxHistorySize) {
      history.splice(0, history.length - maxHistorySize);
    }
    
    this.saveMetricsHistory(history);
  }

  /**
   * Record multiple metrics from a test run
   */
  recordTestRun(metrics: Array<Omit<BenchmarkMetric, 'timestamp'>>): void {
    metrics.forEach(metric => this.recordMetric(metric));
  }

  /**
   * Analyze current metrics against historical data and detect regressions
   */
  analyzeRegressions(currentMetrics: Array<Omit<BenchmarkMetric, 'timestamp'>>): RegressionReport {
    const history = this.loadMetricsHistory();
    const report: RegressionReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMetrics: currentMetrics.length,
        regressionsDetected: 0,
        improvementsDetected: 0,
        stableMetrics: 0,
        overallScore: 100
      },
      regressions: [],
      improvements: [],
      trends: []
    };

    // Analyze each current metric against its history
    for (const currentMetric of currentMetrics) {
      const historicalData = this.getHistoricalData(history, currentMetric.name);
      
      if (historicalData.length < this.config.minimumDataPoints) {
        // Not enough historical data for comparison
        report.summary.stableMetrics++;
        continue;
      }

      const baseline = this.calculateBaseline(historicalData);
      const regressionAnalysis = this.detectRegression(currentMetric, baseline);

      if (regressionAnalysis.isRegression) {
        report.regressions.push({
          metric: { ...currentMetric, timestamp: new Date().toISOString() },
          baseline,
          regression: {
            percentageIncrease: regressionAnalysis.percentageChange,
            severity: regressionAnalysis.severity,
            trend: regressionAnalysis.trend
          },
          recommendation: this.generateRecommendation(currentMetric, regressionAnalysis)
        });
        report.summary.regressionsDetected++;
      } else if (regressionAnalysis.percentageChange < -5) { // 5% improvement
        report.improvements.push({
          metric: { ...currentMetric, timestamp: new Date().toISOString() },
          percentageImprovement: Math.abs(regressionAnalysis.percentageChange)
        });
        report.summary.improvementsDetected++;
      } else {
        report.summary.stableMetrics++;
      }

      // Trend analysis
      if (this.config.enableTrendAnalysis && historicalData.length >= 5) {
        const trend = this.analyzeTrend(historicalData);
        report.trends.push({
          metricName: currentMetric.name,
          trend: trend.direction,
          changeRate: trend.changeRate
        });
      }
    }

    // Calculate overall score
    const regressionPenalty = report.summary.regressionsDetected * 20;
    const improvementBonus = Math.min(report.summary.improvementsDetected * 5, 20);
    report.summary.overallScore = Math.max(0, 100 - regressionPenalty + improvementBonus);

    // Save report
    this.saveRegressionReport(report);

    return report;
  }

  /**
   * Get performance trends for a specific metric
   */
  getTrends(metricName: string, timeframeHours: number = 168): Array<{
    timestamp: string;
    value: number;
    trend: 'up' | 'down' | 'stable';
  }> {
    const history = this.loadMetricsHistory();
    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);
    
    const metricHistory = history
      .filter(m => m.name === metricName && new Date(m.timestamp) > cutoffTime)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return metricHistory.map((metric, index) => {
      let trend: 'up' | 'down' | 'stable' = 'stable';
      
      if (index > 0) {
        const previousValue = metricHistory[index - 1].value;
        const changePercent = ((metric.value - previousValue) / previousValue) * 100;
        
        if (changePercent > 5) trend = 'up';
        else if (changePercent < -5) trend = 'down';
      }

      return {
        timestamp: metric.timestamp,
        value: metric.value,
        trend
      };
    });
  }

  /**
   * Generate a comprehensive performance dashboard
   */
  generateDashboard(): {
    summary: {
      totalMetrics: number;
      recentRegressions: number;
      recentImprovements: number;
      healthScore: number;
    };
    topRegressions: Array<{
      metricName: string;
      severity: string;
      percentageIncrease: number;
      lastSeen: string;
    }>;
    topImprovements: Array<{
      metricName: string;
      percentageImprovement: number;
      lastSeen: string;
    }>;
    performanceHistory: Array<{
      date: string;
      averagePerformance: number;
      regressionCount: number;
    }>;
  } {
    const history = this.loadMetricsHistory();
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentMetrics = history.filter(m => new Date(m.timestamp) > last7Days);

    // Calculate health score based on recent regression reports
    const recentReports = this.getRecentRegressionReports(7);
    const healthScore = recentReports.length > 0
      ? recentReports.reduce((sum, report) => sum + report.summary.overallScore, 0) / recentReports.length
      : 100;

    // Find unique metrics
    const uniqueMetrics = new Set(recentMetrics.map(m => m.name));

    // Simulate recent regressions and improvements for dashboard
    const recentRegressions = recentReports.reduce((sum, report) => sum + report.summary.regressionsDetected, 0);
    const recentImprovements = recentReports.reduce((sum, report) => sum + report.summary.improvementsDetected, 0);

    return {
      summary: {
        totalMetrics: uniqueMetrics.size,
        recentRegressions,
        recentImprovements,
        healthScore: Math.round(healthScore)
      },
      topRegressions: [],
      topImprovements: [],
      performanceHistory: this.generatePerformanceHistory(30)
    };
  }

  private loadMetricsHistory(): BenchmarkMetric[] {
    if (!existsSync(this.metricsFile)) {
      return [];
    }
    
    try {
      const data = readFileSync(this.metricsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to load metrics history:', error);
      return [];
    }
  }

  private saveMetricsHistory(history: BenchmarkMetric[]): void {
    try {
      writeFileSync(this.metricsFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('Failed to save metrics history:', error);
    }
  }

  private getHistoricalData(history: BenchmarkMetric[], metricName: string): BenchmarkMetric[] {
    return history
      .filter(m => m.name === metricName)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, this.config.baselineWindowSize);
  }

  private calculateBaseline(historicalData: BenchmarkMetric[]): {
    average: number;
    standardDeviation: number;
    dataPoints: number;
  } {
    const values = historicalData.map(m => m.value);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      average,
      standardDeviation,
      dataPoints: values.length
    };
  }

  private detectRegression(
    currentMetric: Omit<BenchmarkMetric, 'timestamp'>,
    baseline: { average: number; standardDeviation: number; dataPoints: number }
  ): {
    isRegression: boolean;
    percentageChange: number;
    severity: 'minor' | 'major' | 'critical';
    trend: 'improving' | 'stable' | 'degrading';
  } {
    const percentageChange = ((currentMetric.value - baseline.average) / baseline.average) * 100;
    
    // Determine threshold based on metric category
    let threshold: number;
    switch (currentMetric.category) {
      case 'performance':
        threshold = this.config.performanceRegressionThreshold;
        break;
      case 'memory':
        threshold = this.config.memoryRegressionThreshold;
        break;
      case 'constraint':
        threshold = this.config.constraintRegressionThreshold;
        break;
      default:
        threshold = this.config.performanceRegressionThreshold;
    }

    const isRegression = percentageChange > threshold;
    
    // Determine severity
    let severity: 'minor' | 'major' | 'critical' = 'minor';
    if (percentageChange > threshold * 3) {
      severity = 'critical';
    } else if (percentageChange > threshold * 2) {
      severity = 'major';
    }

    // Determine trend
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (percentageChange > 5) {
      trend = 'degrading';
    } else if (percentageChange < -5) {
      trend = 'improving';
    }

    return {
      isRegression,
      percentageChange,
      severity,
      trend
    };
  }

  private analyzeTrend(historicalData: BenchmarkMetric[]): {
    direction: 'improving' | 'stable' | 'degrading';
    changeRate: number;
  } {
    if (historicalData.length < 3) {
      return { direction: 'stable', changeRate: 0 };
    }

    // Sort by timestamp (oldest first)
    const sortedData = historicalData.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate linear regression to determine trend
    const n = sortedData.length;
    const xValues = sortedData.map((_, index) => index);
    const yValues = sortedData.map(m => m.value);

    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = yValues.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgY = sumY / n;
    
    // Convert slope to percentage change per measurement
    const changeRate = (slope / avgY) * 100;

    let direction: 'improving' | 'stable' | 'degrading' = 'stable';
    if (changeRate > 2) {
      direction = 'degrading';
    } else if (changeRate < -2) {
      direction = 'improving';
    }

    return { direction, changeRate };
  }

  private generateRecommendation(
    metric: Omit<BenchmarkMetric, 'timestamp'>,
    regressionAnalysis: any
  ): string {
    const recommendations: string[] = [];

    switch (metric.category) {
      case 'performance':
        if (regressionAnalysis.severity === 'critical') {
          recommendations.push('URGENT: Critical performance regression detected.');
          recommendations.push('Review recent changes and consider rollback.');
          recommendations.push('Profile the affected code path for optimization opportunities.');
        } else {
          recommendations.push('Performance degradation detected.');
          recommendations.push('Consider profiling and optimizing the affected functionality.');
        }
        break;

      case 'memory':
        recommendations.push('Memory usage increase detected.');
        recommendations.push('Check for memory leaks or inefficient allocations.');
        recommendations.push('Consider implementing memory pooling or cleanup strategies.');
        break;

      case 'constraint':
        recommendations.push('Constraint violation increase detected.');
        recommendations.push('Review constraint-aware implementations.');
        recommendations.push('Consider tightening constraint detection thresholds.');
        break;

      default:
        recommendations.push('Performance metric regression detected.');
        recommendations.push('Review recent changes and consider optimization.');
    }

    return recommendations.join(' ');
  }

  private saveRegressionReport(report: RegressionReport): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = join(this.reportsDir, `regression-report-${timestamp}.json`);
    
    try {
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
    } catch (error) {
      console.error('Failed to save regression report:', error);
    }
  }

  private getRecentRegressionReports(days: number): RegressionReport[] {
    // This would load recent regression reports from disk
    // For now, return empty array as a placeholder
    return [];
  }

  private generatePerformanceHistory(days: number): Array<{
    date: string;
    averagePerformance: number;
    regressionCount: number;
  }> {
    const history: Array<{
      date: string;
      averagePerformance: number;
      regressionCount: number;
    }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      history.push({
        date: date.toISOString().split('T')[0],
        averagePerformance: 95 + Math.random() * 10, // Simulated data
        regressionCount: Math.floor(Math.random() * 3)
      });
    }

    return history;
  }
}

/**
 * Convenience function to extract benchmark metrics from test results
 */
export function extractBenchmarkMetrics(
  testResults: any[],
  metadata: {
    environment: string;
    version: string;
    branch: string;
    commit?: string;
  }
): Array<Omit<BenchmarkMetric, 'timestamp'>> {
  const metrics: Array<Omit<BenchmarkMetric, 'timestamp'>> = [];

  for (const result of testResults) {
    if (result.performance?.executionTime) {
      metrics.push({
        name: `${result.testFile || 'unknown'}_execution_time`,
        value: result.performance.executionTime,
        unit: 'ms',
        category: 'performance',
        metadata: {
          testFile: result.testFile || 'unknown',
          ...metadata
        }
      });
    }

    if (result.performance?.memoryUsage) {
      metrics.push({
        name: `${result.testFile || 'unknown'}_memory_usage`,
        value: result.performance.memoryUsage,
        unit: 'bytes',
        category: 'memory',
        metadata: {
          testFile: result.testFile || 'unknown',
          ...metadata
        }
      });
    }

    if (result.violations?.length !== undefined) {
      metrics.push({
        name: `${result.testFile || 'unknown'}_constraint_violations`,
        value: result.violations.length,
        unit: 'count',
        category: 'constraint',
        metadata: {
          testFile: result.testFile || 'unknown',
          ...metadata
        }
      });
    }
  }

  return metrics;
}