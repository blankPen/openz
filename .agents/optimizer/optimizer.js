#!/usr/bin/env node

/**
 * Main Optimizer Loop
 * Integrates Task 3/4/5 to perform daily issue analysis and post reports
 */

import { fetchDailyIssueStats } from './tasks/collect_issues.js';
import { detectAnomalies, summarizeAnomalies } from './tasks/detect_anomalies.js';
import { logConfigChange, postDailyReport } from './tasks/config_version.js';

const PARENT_ISSUE_ID = 'ed796dfb-ef61-4b0e-9d78-3e549874d17a';

// High confidence threshold for auto-processing
const HIGH_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Generate daily report from issue stats and anomalies
 * @param {Object} issueStats - Issue statistics
 * @param {Object[]} anomalies - Detected anomalies
 * @returns {Object} Formatted report
 */
function generateDailyReport(issueStats, anomalies) {
  const summary = summarizeAnomalies(anomalies);
  const highConfidenceAnomalies = anomalies.filter(a => a.confidence >= HIGH_CONFIDENCE_THRESHOLD);

  // Format issue IDs for the report
  const issuesAnalyzed = [];

  // Extract unique issue IDs from anomalies
  const issueIds = new Set();
  for (const anomaly of anomalies) {
    if (anomaly.issues && anomaly.issues.length > 0) {
      for (const issueId of anomaly.issues) {
        issueIds.add(issueId);
      }
    }
  }
  issuesAnalyzed.push(...issueIds);

  // Format problems found
  const problemsFound = anomalies.map(a => ({
    issue: a.issues[0] || 'N/A',
    problem: `${a.dimension}/${a.type}: ${a.evidence}`,
    severity: a.severity,
    confidence: a.confidence
  }));

  // Format config changes (only for high confidence anomalies)
  const configChanges = highConfidenceAnomalies.map(a => ({
    description: `Fix ${a.type} in ${a.dimension}`,
    before: 'current_config',
    after: 'suggested_fix',
    confidence: a.confidence,
    suggestion: a.suggestion
  }));

  // Generate summary text
  let summaryText = `Analyzed ${issueStats.total} total issues. `;
  summaryText += `Today: ${issueStats.todayStats.created} created, ${issueStats.todayStats.completed} completed. `;
  summaryText += `Found ${anomalies.length} anomalies (${summary.byDimension.task_allocation} task allocation, ${summary.byDimension.automation} automation, ${summary.byDimension.collaboration} collaboration). `;

  if (highConfidenceAnomalies.length > 0) {
    summaryText += `${highConfidenceAnomalies.length} high-confidence issues require attention.`;
  } else {
    summaryText += 'No high-confidence anomalies detected. Team is performing well.';
  }

  return {
    date: issueStats.date,
    issuesAnalyzed,
    problemsFound,
    configChanges,
    summary: summaryText,
    anomalyCount: anomalies.length,
    highConfidenceCount: highConfidenceAnomalies.length
  };
}

/**
 * Process high-confidence anomalies
 * @param {Object[]} anomalies - All detected anomalies
 */
async function processHighConfidenceAnomalies(anomalies) {
  const highConfidence = anomalies.filter(a => a.confidence >= HIGH_CONFIDENCE_THRESHOLD);

  for (const anomaly of highConfidence) {
    // Log the configuration change recommendation
    await logConfigChange({
      before: { status: 'current' },
      after: { status: 'recommended_fix', suggestion: anomaly.suggestion },
      reason: `High-confidence anomaly detected: ${anomaly.type} in ${anomaly.dimension}`,
      confidence: anomaly.confidence >= 0.9 ? '高' : '中',
      evidence: anomaly.evidence
    });
  }

  return highConfidence.length;
}

/**
 * Main optimizer loop
 * Executes the full optimization workflow
 */
async function runOptimizer() {
  console.log('=== Optimizer Starting ===\n');

  try {
    // Step 1: Fetch daily issue statistics
    console.log('Step 1: Fetching issue statistics...');
    const issueStats = await fetchDailyIssueStats();
    console.log(`  Total issues: ${issueStats.total}`);
    console.log(`  Today: ${issueStats.todayStats.created} created, ${issueStats.todayStats.completed} completed\n`);

    // Step 2: Detect anomalies
    console.log('Step 2: Detecting anomalies...');
    const anomalies = await detectAnomalies(issueStats);
    const summary = summarizeAnomalies(anomalies);
    console.log(`  Found ${anomalies.length} anomalies`);
    console.log(`  - Task allocation: ${summary.byDimension.task_allocation}`);
    console.log(`  - Automation: ${summary.byDimension.automation}`);
    console.log(`  - Collaboration: ${summary.byDimension.collaboration}\n`);

    // Step 3: Generate daily report
    console.log('Step 3: Generating daily report...');
    const report = generateDailyReport(issueStats, anomalies);
    console.log(`  Report summary: ${report.summary}\n`);

    // Step 4: Post daily report to PZ-124
    console.log('Step 4: Posting daily report to PZ-124...');
    await postDailyReport(report);
    console.log('  Report posted successfully\n');

    // Step 5: Process high-confidence anomalies
    console.log('Step 5: Processing high-confidence anomalies...');
    const processedCount = await processHighConfidenceAnomalies(anomalies);
    console.log(`  Processed ${processedCount} high-confidence anomalies\n`);

    console.log('=== Optimizer Completed Successfully ===');
    return { success: true, anomalyCount: anomalies.length, processedCount };

  } catch (error) {
    console.error('Optimizer error:', error.message);
    throw error;
  }
}

// CLI execution
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runOptimizer()
    .then(result => {
      console.log('\nResult:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}

export { runOptimizer, generateDailyReport, processHighConfidenceAnomalies };
