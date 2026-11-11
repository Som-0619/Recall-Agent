import { EvaluationCase, EvaluationCategory } from './dataset';

export interface CaseExecutionResult {
  caseId: string;
  category: EvaluationCategory;
  name: string;
  passed: boolean;
  retrievedContext: string;
  reply: string;
  sources: Array<{ title: string; url: string; domain: string }>;
  savedMemories: number;
  searchCallsMade: number;
  latencyMs: number;
  error?: string;
  scores: {
    retrievalAccurate: boolean;
    answerCorrect: boolean;
    dateAccurate: boolean;
    citationsCorrect: boolean;
    searchDecisionAccurate: boolean;
  };
  notes: string[];
}

export interface MetricSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number; // percentage (0-100)
  memoryRetrievalAccuracy: number; // percentage
  answerCorrectness: number; // percentage
  dateAccuracy: number; // percentage
  citationCorrectness: number; // percentage
  searchDecisionAccuracy: number; // percentage
  averageResponseLatencyMs: number;
  searchCallsPerQuestion: number;
  categoryBreakdown: Record<
    EvaluationCategory,
    {
      total: number;
      passed: number;
      passRate: number;
    }
  >;
}

/**
 * Calculates benchmark metrics from execution results.
 */
export function calculateMetrics(
  results: CaseExecutionResult[],
  dataset: EvaluationCase[]
): MetricSummary {
  const totalCases = results.length;
  let passedCases = 0;

  let retrievalHits = 0;
  let retrievalEligible = 0;

  let answerHits = 0;
  let dateHits = 0;
  let dateEligible = 0;

  let citationHits = 0;
  let citationEligible = 0;

  let searchDecisionHits = 0;

  let totalLatency = 0;
  let totalSearches = 0;

  const categoryMap: Record<
    EvaluationCategory,
    { total: number; passed: number; passRate: number }
  > = {
    cross_conversation: { total: 0, passed: 0, passRate: 0 },
    date_recall: { total: 0, passed: 0, passRate: 0 },
    preference_decision: { total: 0, passed: 0, passRate: 0 },
    web_research: { total: 0, passed: 0, passRate: 0 },
    historical_vs_current: { total: 0, passed: 0, passRate: 0 },
    failure_scenarios: { total: 0, passed: 0, passRate: 0 },
  };

  const caseMap = new Map(dataset.map((c) => [c.id, c]));

  for (const res of results) {
    if (res.passed) {
      passedCases++;
    }

    // Category tally
    const cat = res.category;
    if (categoryMap[cat]) {
      categoryMap[cat].total++;
      if (res.passed) {
        categoryMap[cat].passed++;
      }
    }

    const testCase = caseMap.get(res.caseId);
    if (!testCase) continue;

    totalLatency += res.latencyMs;
    totalSearches += res.searchCallsMade;

    // 1. Retrieval Accuracy (for cases that have historical data to retrieve)
    const hasHistoricalSetup = testCase.setupConversations.some(
      (c) => c.messages.length > 0 || (c.memories && c.memories.length > 0)
    );
    if (hasHistoricalSetup && testCase.expected.expectedKeywords.length > 0) {
      retrievalEligible++;
      if (res.scores.retrievalAccurate) {
        retrievalHits++;
      }
    }

    // 2. Answer Correctness
    if (res.scores.answerCorrect) {
      answerHits++;
    }

    // 3. Date Accuracy
    if (cat === 'date_recall') {
      dateEligible++;
      if (res.scores.dateAccurate) {
        dateHits++;
      }
    }

    // 4. Citation Correctness
    if (testCase.expected.shouldContainCitations) {
      citationEligible++;
      if (res.scores.citationsCorrect) {
        citationHits++;
      }
    }

    // 5. Search Decision Accuracy
    if (res.scores.searchDecisionAccurate) {
      searchDecisionHits++;
    }
  }

  // Calculate percentage rates
  for (const cat in categoryMap) {
    const item = categoryMap[cat as EvaluationCategory];
    item.passRate = item.total > 0 ? Math.round((item.passed / item.total) * 100) : 0;
  }

  return {
    totalCases,
    passedCases,
    failedCases: totalCases - passedCases,
    passRate: totalCases > 0 ? Math.round((passedCases / totalCases) * 100) : 0,
    memoryRetrievalAccuracy:
      retrievalEligible > 0 ? Math.round((retrievalHits / retrievalEligible) * 100) : 100,
    answerCorrectness: totalCases > 0 ? Math.round((answerHits / totalCases) * 100) : 0,
    dateAccuracy: dateEligible > 0 ? Math.round((dateHits / dateEligible) * 100) : 100,
    citationCorrectness:
      citationEligible > 0 ? Math.round((citationHits / citationEligible) * 100) : 100,
    searchDecisionAccuracy:
      totalCases > 0 ? Math.round((searchDecisionHits / totalCases) * 100) : 0,
    averageResponseLatencyMs: totalCases > 0 ? Math.round(totalLatency / totalCases) : 0,
    searchCallsPerQuestion:
      totalCases > 0 ? Number((totalSearches / totalCases).toFixed(2)) : 0,
    categoryBreakdown: categoryMap,
  };
}
