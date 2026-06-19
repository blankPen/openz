#!/usr/bin/env node

/**
 * Issue Data Collection Module
 * Fetches issue statistics from Multica platform
 */

import { execSync } from 'child_process';

const PROJECT_ID = '53387db1-782e-4b07-a190-d96c7ea787bc';
const PAGE_SIZE = 50;

/**
 * @typedef {Object} IssueStats
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {number} total - Total number of issues
 * @property {Object.<string, number>} byStatus - Count of issues by status
 * @property {Object.<string, number>} byAgent - Count of issues by agent
 * @property {Object} todayStats - Today's statistics
 * @property {number} todayStats.created - Issues created today
 * @property {number} todayStats.completed - Issues completed today
 * @property {number} todayStats.blocked - Issues blocked today
 * @property {number} todayStats.inReview - Issues moved to in_review today
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
 * Fetch all issues for the project
 * Handles pagination using limit/offset
 * @returns {Object[]} Array of issues
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
        // Got fewer than page size, we're done
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
 * Get today's date in YYYY-MM-DD format
 * @returns {string}
 */
function getTodayDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Check if a date string is today
 * @param {string} dateStr - ISO date string
 * @returns {boolean}
 */
function isToday(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  return date.toISOString().split('T')[0] === today.toISOString().split('T')[0];
}

/**
 * Calculate issue statistics from fetched issues
 * @param {Object[]} issues - Array of issue objects
 * @returns {IssueStats}
 */
function calculateStats(issues) {
  const today = getTodayDate();

  const byStatus = {};
  const byAgent = {};
  let todayCreated = 0;
  let todayCompleted = 0;
  let todayBlocked = 0;
  let todayInReview = 0;

  for (const issue of issues) {
    // Count by status
    const status = issue.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    // Count by agent
    const agentId = issue.assignee_id || 'unassigned';
    byAgent[agentId] = (byAgent[agentId] || 0) + 1;

    // Check if created today
    if (isToday(issue.created_at)) {
      todayCreated++;
    }

    // Check if completed today (status changed to done)
    if (issue.status === 'done' && isToday(issue.updated_at)) {
      todayCompleted++;
    }

    // Check if blocked today
    if (issue.status === 'blocked' && isToday(issue.updated_at)) {
      todayBlocked++;
    }

    // Check if moved to in_review today
    if (issue.status === 'in_review' && isToday(issue.updated_at)) {
      todayInReview++;
    }
  }

  return {
    date: today,
    total: issues.length,
    byStatus,
    byAgent,
    todayStats: {
      created: todayCreated,
      completed: todayCompleted,
      blocked: todayBlocked,
      inReview: todayInReview
    }
  };
}

/**
 * Main function to fetch daily issue statistics
 * @returns {Promise<IssueStats>} Issue statistics object
 */
async function fetchDailyIssueStats() {
  const issues = fetchAllIssues();
  return calculateStats(issues);
}

// CLI execution
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  try {
    const stats = await fetchDailyIssueStats();
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('Error fetching issue stats:', error.message);
    process.exit(1);
  }
}

export { fetchDailyIssueStats };
