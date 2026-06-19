/**
 * 配置版本管理模块
 * 负责记录配置变更和发布每日分析报告到 PZ-124
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// PZ-124 issue ID - 父级优化任务
const PARENT_ISSUE_ID = 'ed796dfb-ef61-4b0e-9d78-3e549874d17a';

/**
 * 将配置变更记录发布到 PZ-124 评论
 * @param {Object} change - 变更对象
 * @param {Object} change.before - 变更前配置
 * @param {Object} change.after - 变更后配置
 * @param {string} change.reason - 触发原因
 * @param {string} change.confidence - 置信度：高/中/低
 * @param {string} change.evidence - Agent 判断依据
 */
async function logConfigChange(change) {
  const { before, after, reason, confidence, evidence } = change;

  const today = new Date().toISOString().split('T')[0];

  const content = `## 配置变更记录 - ${today}
### 变更详情
- 变更前: \`${JSON.stringify(before, null, 2)}\`
- 变更后: \`${JSON.stringify(after, null, 2)}\`
### 触发原因
${reason}
### 置信度
${confidence}
### Agent 判断依据
${evidence}
`;

  const tmpFile = path.join('/tmp', `config_change_${Date.now()}.md`);
  fs.writeFileSync(tmpFile, content, 'utf8');

  try {
    execSync(`multica issue comment add ${PARENT_ISSUE_ID} --content-file ${tmpFile}`, {
      stdio: 'inherit'
    });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

/**
 * 将每日分析报告发布到 PZ-124 评论
 * @param {Object} report - 报告对象
 * @param {string} report.date - 报告日期
 * @param {Array} report.issuesAnalyzed - 分析的 issue 列表
 * @param {Array} report.problemsFound - 发现的问题
 * @param {Array} report.configChanges - 建议的配置变更
 * @param {string} report.summary - 总结
 */
async function postDailyReport(report) {
  const { date, issuesAnalyzed, problemsFound, configChanges, summary } = report;

  let content = `## 每日分析报告 - ${date}
### 分析范围
分析了 ${issuesAnalyzed.length} 个 issue: ${issuesAnalyzed.map(i => `[${i}](mention://issue/${i})`).join(', ')}
`;

  if (problemsFound.length > 0) {
    content += `
### 发现的问题
`;
    problemsFound.forEach((p, idx) => {
      content += `${idx + 1}. [${p.issue}](mention://issue/${p.issue}) - ${p.problem}\n`;
    });
  }

  if (configChanges.length > 0) {
    content += `
### 建议的配置变更
`;
    configChanges.forEach((c, idx) => {
      content += `${idx + 1}. ${c.description}\n`;
      content += `   - 变更前: \`${c.before}\` → 变更后: \`${c.after}\`\n`;
      content += `   - 置信度: ${c.confidence}\n`;
    });
  }

  content += `
### 总结
${summary}
`;

  const tmpFile = path.join('/tmp', `daily_report_${date}_${Date.now()}.md`);
  fs.writeFileSync(tmpFile, content, 'utf8');

  try {
    execSync(`multica issue comment add ${PARENT_ISSUE_ID} --content-file ${tmpFile}`, {
      stdio: 'inherit'
    });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

module.exports = {
  logConfigChange,
  postDailyReport
};
