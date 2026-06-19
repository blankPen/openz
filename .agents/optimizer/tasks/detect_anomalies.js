#!/usr/bin/env node

/**
 * Three-Dimensional Anomaly Detection Engine
 * Detects issues in: task_allocation, automation, collaboration
 */

import { execSync } from 'child_process';

const PROJECT_ID = '53387db1-782e-4b07-a190-d96c7ea787bc';
const PAGE_SIZE = 50;

// Threshold constants
const THRESHOLDS = {
  unassigned_hours: 24,
  blocked_escalate_days: 3,
  creation_storm_count: 10,
  automation_process_days: 7,
  no_interaction_days: 14,
  review_window_hours: 2
};

/**
 * @typedef {Object} AnomalyReport
 * @property {string} id - Unique anomaly identifier
 * @property {string} type - Anomaly type
 * @property {string} dimension - One of: task_allocation, automation, collaboration
 * @property {string} severity - high | medium | low
 * @property {string[]} issues - Issue IDs affected
 * @property {string} evidence - Human-readable evidence summary
 * @property {string} suggestion - Suggested fix action
 * @property {number} confidence - 0-1 confidence score
 */

/**
 * Execute multica CLI command and return parsed JSON
 * @param {string[]} args - Command arguments
 * @returns {Object} Parsed JSON output
 */
function execMultica(args) {
  const cmd = ['multica', ...args].join(' ');
  try {
    const output = execSync(cmd, { encoding: 'utf-8' });
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Failed to execute: ${cmd}\nError: ${error.message}`);
  }
}

/**
 * Fetch all issues for the project with full details
 * @returns {Object[]} Array of issue objects
 */
function fetchAllIssues() {
  const allIssues = [];
  let offset = 0;

  while (true) {
    const args = [
      'issue', 'list',
      '--project', PROJECT_ID,
      '--output', 'json',
      '--limit', String(PAGE_SIZE),
      '--offset', String(offset)
    ];

    const result = execMultica(args);

    if (result.issues && result.issues.length > 0) {
      allIssues.push(...result.issues);

      if (result.issues.length < PAGE_SIZE) {
        break;
      }

      offset += PAGE_SIZE;
    } else {
      break;
    }
  }

  return allIssues;
}

/**
 * Fetch comments for an issue
 * @param {string} issueId - Issue ID
 * @returns {Object[]} Array of comments
 */
function fetchIssueComments(issueId) {
  try {
    const args = [
      'issue', 'comment', 'list',
      issueId,
      '--output', 'json'
    ];
    const result = execMultica(args);
    return result.comments || [];
  } catch {
    return [];
  }
}

/**
 * Get days between two dates
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @returns {number} Number of days
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get hours between two dates
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @returns {number} Number of hours
 */
function hoursBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.floor(diffTime / (1000 * 60 * 60));
}

/**
 * Check if a date is today
 * @param {string} dateStr - ISO date string
 * @returns {boolean}
 */
function isToday(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  return date.toISOString().split('T')[0] === today.toISOString().split('T')[0];
}

/**
 * Detect task allocation anomalies
 * A.1: Issues with no assignee for > 24h
 * A.2: Blocked issues not escalated after > 3 days
 * @param {Object[]} issues - Array of issue objects
 * @returns {AnomalyReport[]}
 */
function detectTaskAllocationAnomalies(issues) {
  const reports = [];
  const now = new Date();

  for (const issue of issues) {
    // A.1: Unassigned issue for > 24h
    if (!issue.assignee_id && !issue.assignee_type) {
      const createdAt = new Date(issue.created_at);
      const hoursSinceCreation = hoursBetween(createdAt, now);

      if (hoursSinceCreation > THRESHOLDS.unassigned_hours) {
        reports.push({
          id: `unassigned_${issue.id}`,
          type: 'unassigned_issue',
          dimension: 'task_allocation',
          severity: hoursSinceCreation > 72 ? 'high' : 'medium',
          issues: [issue.id],
          evidence: `Issue ${issue.id} has been unassigned for ${hoursSinceCreation} hours (threshold: ${THRESHOLDS.unassigned_hours}h)`,
          suggestion: `Assign this issue to an appropriate team member or close it if not needed`,
          confidence: Math.min(0.95, 0.5 + (hoursSinceCreation / 168) * 0.45)
        });
      }
    }

    // A.2: Blocked issue not escalated after > 3 days
    if (issue.status === 'blocked') {
      const updatedAt = new Date(issue.updated_at);
      const daysSinceUpdate = daysBetween(updatedAt, now);

      if (daysSinceUpdate > THRESHOLDS.blocked_escalate_days) {
        reports.push({
          id: `blocked_${issue.id}`,
          type: 'blocked_not_escalated',
          dimension: 'task_allocation',
          severity: daysSinceUpdate > 7 ? 'high' : 'medium',
          issues: [issue.id],
          evidence: `Issue ${issue.id} has been blocked for ${daysSinceUpdate} days without escalation (threshold: ${THRESHOLDS.blocked_escalate_days}d)`,
          suggestion: `Review blocked issue: unblock if possible, escalate to parent issue, or convert to bug if dependency cannot be resolved`,
          confidence: Math.min(0.95, 0.6 + (daysSinceUpdate / 30) * 0.35)
        });
      }
    }
  }

  return reports;
}

/**
 * Detect automation effectiveness anomalies
 * B.1: Issue creation storm (> 10 issues in a day)
 * B.2: Autopilot-created issues not processed after > 7 days
 * @param {Object} issueStats - IssueStats from Task 3
 * @param {Object[]} issues - Array of issue objects
 * @returns {AnomalyReport[]}
 */
function detectAutomationAnomalies(issueStats, issues) {
  const reports = [];

  // B.1: Creation storm detection (using IssueStats.todayStats.created)
  const todayCreated = issueStats.todayStats?.created || 0;
  if (todayCreated > THRESHOLDS.creation_storm_count) {
    reports.push({
      id: 'creation_storm',
      type: 'creation_storm',
      dimension: 'automation',
      severity: todayCreated > 50 ? 'high' : todayCreated > 20 ? 'medium' : 'low',
      issues: [],
      evidence: `${todayCreated} issues created today (threshold: ${THRESHOLDS.creation_storm_count}). Possible runaway automation or bulk import.`,
      suggestion: `Review recent automation scripts or imports. Consider implementing rate limiting for issue creation.`,
      confidence: 0.9
    });
  }

  // B.2: Unprocessed automation issues (> 7 days)
  const now = new Date();
  for (const issue of issues) {
    // Check if created by automation (creator_type === 'agent' and not assigned to a specific person)
    // or check if the issue has an automation-related label
    const isAutomationCreated = issue.creator_type === 'agent' &&
      (!issue.assignee_id || issue.assignee_id === 'unassigned');

    if (isAutomationCreated) {
      const createdAt = new Date(issue.created_at);
      const daysSinceCreation = daysBetween(createdAt, now);

      // Check if still open (not done, cancelled)
      const isOpen = !['done', 'cancelled'].includes(issue.status);

      if (isOpen && daysSinceCreation > THRESHOLDS.automation_process_days) {
        reports.push({
          id: `unprocessed_automation_${issue.id}`,
          type: 'unprocessed_automation_issue',
          dimension: 'automation',
          severity: daysSinceCreation > 14 ? 'high' : 'medium',
          issues: [issue.id],
          evidence: `Issue ${issue.id} created by automation ${daysSinceCreation} days ago and remains unprocessed (threshold: ${THRESHOLDS.automation_process_days}d)`,
          suggestion: `Review and process this automation-created issue, or adjust the automation to only create actionable issues`,
          confidence: Math.min(0.95, 0.6 + (daysSinceCreation / 30) * 0.35)
        });
      }
    }
  }

  return reports;
}

/**
 * Detect collaboration anomalies
 * C.1: Issues with no human comments for > 14 days
 * C.2: Issues completed in < 2 hours with no review
 * @param {Object[]} issues - Array of issue objects
 * @returns {AnomalyReport[]}
 */
function detectCollaborationAnomalies(issues) {
  const reports = [];
  const now = new Date();

  for (const issue of issues) {
    // C.1: No interaction for > 14 days
    const updatedAt = new Date(issue.updated_at);
    const daysSinceUpdate = daysBetween(updatedAt, now);

    if (daysSinceUpdate > THRESHOLDS.no_interaction_days) {
      // Check if it's not already done/cancelled
      if (!['done', 'cancelled'].includes(issue.status)) {
        reports.push({
          id: `no_interaction_${issue.id}`,
          type: 'no_interaction',
          dimension: 'collaboration',
          severity: daysSinceUpdate > 30 ? 'high' : 'medium',
          issues: [issue.id],
          evidence: `Issue ${issue.id} has had no updates for ${daysSinceUpdate} days (threshold: ${THRESHOLDS.no_interaction_days}d)`,
          suggestion: `Reach out to the assignee for a status update, or close if the issue is no longer relevant`,
          confidence: Math.min(0.9, 0.5 + (daysSinceUpdate / 60) * 0.4)
        });
      }
    }

    // C.2: Completed without review (completed in < 2h with no in_review state)
    if (issue.status === 'done') {
      const createdAt = new Date(issue.created_at);
      const updatedAtIssue = new Date(issue.updated_at);
      const hoursToComplete = hoursBetween(createdAt, updatedAtIssue);

      // If completed very quickly and never went to in_review
      if (hoursToComplete < THRESHOLDS.review_window_hours && issue.status !== 'in_review') {
        // Check if there was a review process
        const comments = fetchIssueComments(issue.id);
        const hasReviewComment = comments.some(c =>
          c.content && (c.content.toLowerCase().includes('review') ||
                       c.content.toLowerCase().includes('lgtm') ||
                       c.content.toLowerCase().includes('approved'))
        );

        if (!hasReviewComment) {
          reports.push({
            id: `no_review_${issue.id}`,
            type: 'completed_without_review',
            dimension: 'collaboration',
            severity: hoursToComplete < 1 ? 'high' : 'medium',
            issues: [issue.id],
            evidence: `Issue ${issue.id} was completed in ${hoursToComplete} hours without any review comments (threshold: ${THRESHOLDS.review_window_hours}h)`,
            suggestion: `Review the completed issue to ensure quality standards are met. Consider requiring in_review status before closing.`,
            confidence: 0.75
          });
        }
      }
    }
  }

  return reports;
}

/**
 * Main anomaly detection function
 * @param {Object} issueStats - IssueStats from Task 3 (collect_issues.js)
 * @returns {Promise<AnomalyReport[]>} Array of anomaly reports
 */
async function detectAnomalies(issueStats) {
  const issues = fetchAllIssues();

  const taskAllocationReports = detectTaskAllocationAnomalies(issues);
  const automationReports = detectAutomationAnomalies(issueStats, issues);
  const collaborationReports = detectCollaborationAnomalies(issues);

  return [
    ...taskAllocationReports,
    ...automationReports,
    ...collaborationReports
  ];
}

/**
 * Summarize anomalies by dimension
 * @param {AnomalyReport[]} reports
 * @returns {Object}
 */
function summarizeAnomalies(reports) {
  const summary = {
    total: reports.length,
    byDimension: {
      task_allocation: 0,
      automation: 0,
      collaboration: 0
    },
    bySeverity: {
      high: 0,
      medium: 0,
      low: 0
    }
  };

  for (const report of reports) {
    summary.byDimension[report.dimension]++;
    summary.bySeverity[report.severity]++;
  }

  return summary;
}

// CLI execution
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  (async () => {
    try {
      // Import IssueStats from collect_issues.js
      const { fetchDailyIssueStats } = await import('./collect_issues.js');
      const issueStats = await fetchDailyIssueStats();

      const anomalies = await detectAnomalies(issueStats);
      const summary = summarizeAnomalies(anomalies);

      console.log(JSON.stringify({
        date: issueStats.date,
        totalIssues: issueStats.total,
        anomalyCount: anomalies.length,
        summary,
        anomalies
      }, null, 2));
    } catch (error) {
      console.error('Error detecting anomalies:', error.message);
      process.exit(1);
    }
  })();
}

export { detectAnomalies, summarizeAnomalies };
