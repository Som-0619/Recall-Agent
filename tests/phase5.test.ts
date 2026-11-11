import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runEvaluation } from '../src/evaluation/runner';
import { evaluationDataset } from '../src/evaluation/dataset';
import { calculateMetrics } from '../src/evaluation/metrics';

describe('Recall Evaluation, Benchmarking & Reliability (Phase 5)', () => {
  it('1. should execute all 24 evaluation benchmark cases successfully', async () => {
    const report = await runEvaluation();
    assert.equal(report.results.length, 24);
    assert.equal(report.summary.totalCases, 24);
    assert.equal(report.summary.passedCases, 24);
    assert.equal(report.summary.passRate, 100);
  });

  it('2. should verify cross-conversation memory retrieval', async () => {
    const crossCases = evaluationDataset.filter((c) => c.category === 'cross_conversation');
    const report = await runEvaluation(crossCases);
    assert.equal(report.summary.categoryBreakdown.cross_conversation.passRate, 100);
    // Verify A1 retrieved PostgreSQL and MongoDB from earlier conversation
    const a1 = report.results.find((r) => r.caseId === 'A1');
    assert.ok(a1);
    assert.equal(a1.passed, true);
    assert.ok(a1.retrievedContext.includes('PostgreSQL') || a1.retrievedContext.includes('MongoDB'));
  });

  it('3. should verify date-specific recall across distinct dates', async () => {
    const dateCases = evaluationDataset.filter((c) => c.category === 'date_recall');
    const report = await runEvaluation(dateCases);
    assert.equal(report.summary.categoryBreakdown.date_recall.passRate, 100);
    assert.equal(report.summary.dateAccuracy, 100);
  });

  it('4. should verify preference and decision recall', async () => {
    const prefCases = evaluationDataset.filter((c) => c.category === 'preference_decision');
    const report = await runEvaluation(prefCases);
    assert.equal(report.summary.categoryBreakdown.preference_decision.passRate, 100);
  });

  it('5. should verify search decision accuracy and citation correctness in web research', async () => {
    const webCases = evaluationDataset.filter((c) => c.category === 'web_research');
    const report = await runEvaluation(webCases);
    assert.equal(report.summary.categoryBreakdown.web_research.passRate, 100);
    assert.equal(report.summary.citationCorrectness, 100);
    assert.equal(report.summary.searchDecisionAccuracy, 100);
  });

  it('6. should verify historical vs current comparison without date fabrication', async () => {
    const compCases = evaluationDataset.filter((c) => c.category === 'historical_vs_current');
    const report = await runEvaluation(compCases);
    assert.equal(report.summary.categoryBreakdown.historical_vs_current.passRate, 100);
    const e4 = report.results.find((r) => r.caseId === 'E4');
    assert.ok(e4);
    assert.equal(e4.passed, true);
  });

  it('7. should verify failure handling and resilience in edge scenarios', async () => {
    const failCases = evaluationDataset.filter((c) => c.category === 'failure_scenarios');
    const report = await runEvaluation(failCases);
    assert.equal(report.summary.categoryBreakdown.failure_scenarios.passRate, 100);
  });
});

