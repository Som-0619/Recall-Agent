import { runEvaluation } from './runner';

async function main() {
  console.log('====================================================');
  console.log('   Recall Agent — Phase 5 Evaluation Benchmark      ');
  console.log('====================================================\n');

  const report = await runEvaluation();
  const { summary } = report;

  console.log('--- Overall Metrics ---');
  console.log(`Total Evaluation Cases:       ${summary.totalCases}`);
  console.log(`Passed Cases:                 ${summary.passedCases} (${summary.passRate}%)`);
  console.log(`Failed Cases:                 ${summary.failedCases}`);
  console.log(`Memory Retrieval Accuracy:    ${summary.memoryRetrievalAccuracy}%`);
  console.log(`Answer Correctness:           ${summary.answerCorrectness}%`);
  console.log(`Date-Specific Accuracy:       ${summary.dateAccuracy}%`);
  console.log(`Citation Correctness:         ${summary.citationCorrectness}%`);
  console.log(`Search Decision Accuracy:     ${summary.searchDecisionAccuracy}%`);
  console.log(`Average Response Latency:     ${summary.averageResponseLatencyMs} ms`);
  console.log(`Search Calls per Question:    ${summary.searchCallsPerQuestion}\n`);

  console.log('--- Category Breakdown ---');
  for (const [cat, data] of Object.entries(summary.categoryBreakdown)) {
    console.log(`  • ${cat.padEnd(25)}: ${data.passed}/${data.total} passed (${data.passRate}%)`);
  }

  console.log('\n--- Case Details ---');
  for (const res of report.results) {
    const symbol = res.passed ? '✅' : '❌';
    console.log(`${symbol} [${res.caseId}] ${res.name} (${res.latencyMs}ms)`);
    if (!res.passed && res.notes.length > 0) {
      console.log(`     Reason: ${res.notes.join(' | ')}`);
    }
  }

  console.log('\n====================================================\n');
}

main().catch((err) => {
  console.error('Evaluation run failed:', err);
  process.exit(1);
});

