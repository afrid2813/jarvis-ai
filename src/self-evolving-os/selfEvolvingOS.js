const STORAGE_KEY = 'jarvis.selfEvolvingOS.v1';
const DEFAULT_AGENT_SCORE = 0.5;

const initialState = {
  traces: [],
  reflections: [],
  routingPolicy: {},
  agentScores: {},
  workflowCounts: {},
  pluginCandidates: [],
  metrics: {
    taskCount: 0,
    successRate: 0,
    averageLatencyMs: 0,
    averageConfidence: 0,
    tokenEfficiency: 1,
  },
};

export function loadEvolutionState(agents) {
  const stored = readStoredState();
  const agentScores = { ...stored.agentScores };

  agents.forEach(agent => {
    if (agentScores[agent.name] == null) agentScores[agent.name] = DEFAULT_AGENT_SCORE;
  });

  return {
    ...initialState,
    ...stored,
    agentScores,
    metrics: { ...initialState.metrics, ...stored.metrics },
  };
}

export function runEvolutionCycle({ state, task, asset, phase, signal, error, startedAt, endedAt, agents }) {
  const success = Boolean(signal && !error);
  const latencyMs = Math.max(endedAt - startedAt, 0);
  const taskType = classifyTask(task, phase);
  const topology = selectTopology(taskType, phase);
  const selectedAgents = selectAgents(agents, taskType, phase);
  const reward = calculateReward({ success, latencyMs, signal });
  const trace = {
    id: `trace-${Date.now()}`,
    task,
    taskType,
    asset: asset.symbol,
    phase,
    topology,
    selectedAgents: selectedAgents.map(agent => agent.name),
    success,
    latencyMs,
    reward,
    confidence: signal?.confidence || 0,
    risk: signal?.risk || 'UNKNOWN',
    action: signal?.action || 'NONE',
    createdAt: new Date().toISOString(),
  };

  const nextState = {
    ...state,
    traces: [trace, ...state.traces].slice(0, 50),
    routingPolicy: updateRoutingPolicy(state.routingPolicy, selectedAgents, taskType, reward),
    agentScores: updateAgentScores(state.agentScores, selectedAgents, reward),
    workflowCounts: updateWorkflowCounts(state.workflowCounts, taskType),
  };

  if (!success || signal?.risk === 'HIGH') {
    nextState.reflections = [
      buildReflection({ trace, error, signal }),
      ...state.reflections,
    ].slice(0, 20);
  }

  nextState.pluginCandidates = detectPluginCandidates(nextState.workflowCounts, nextState.pluginCandidates);
  nextState.metrics = calculateMetrics(nextState.traces);
  persistEvolutionState(nextState);

  return { state: nextState, trace };
}

export function recallBestStrategy(state, task, phase) {
  const taskType = classifyTask(task, phase);
  return state.traces
    .filter(trace => trace.taskType === taskType && trace.success)
    .sort((a, b) => b.reward - a.reward)[0] || null;
}

function readStoredState() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || initialState;
  } catch {
    return initialState;
  }
}

function persistEvolutionState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Browser storage can be unavailable in private contexts; learning stays in memory.
  }
}

function classifyTask(task, phase) {
  const lower = task.toLowerCase();
  if (phase === 1 || lower.includes('what is') || lower.includes('explain')) return 'education';
  if (phase === 3 || lower.includes('swarm') || lower.includes('risk report')) return 'swarm-analysis';
  if (lower.includes('entry') || lower.includes('exit') || lower.includes('strategy')) return 'strategy';
  if (lower.includes('risk') || lower.includes('stop loss')) return 'risk';
  return 'technical-analysis';
}

function selectTopology(taskType, phase) {
  if (taskType === 'education') return 'ring';
  if (taskType === 'risk') return 'hierarchical';
  if (phase === 3 || taskType === 'swarm-analysis') return 'hybrid';
  return 'mesh';
}

function selectAgents(agents, taskType, phase) {
  if (phase === 3 || taskType === 'swarm-analysis') return agents;
  const byName = name => agents.find(agent => agent.name === name);
  const agentMap = {
    education: ['Market Agent', 'Technical Agent'],
    risk: ['Risk Agent', 'Strategy Agent', 'Fusion Agent'],
    strategy: ['Technical Agent', 'Risk Agent', 'Strategy Agent', 'Fusion Agent'],
    'technical-analysis': ['Market Agent', 'Technical Agent', 'Fusion Agent'],
  };

  return (agentMap[taskType] || agentMap['technical-analysis']).map(byName).filter(Boolean);
}

function calculateReward({ success, latencyMs, signal }) {
  const confidence = (signal?.confidence || 0) / 100;
  const speed = Math.max(0, 1 - latencyMs / 45_000);
  const riskPenalty = signal?.risk === 'HIGH' ? 0.2 : 0;
  return clamp((success ? 0.45 : -0.2) + confidence * 0.35 + speed * 0.2 - riskPenalty);
}

function updateRoutingPolicy(policy, agents, taskType, reward) {
  const next = { ...policy };
  const learningRate = 0.25;

  agents.forEach(agent => {
    const key = `${taskType}:${agent.name}`;
    const current = next[key] ?? DEFAULT_AGENT_SCORE;
    next[key] = round(current + learningRate * (reward - current));
  });

  return next;
}

function updateAgentScores(scores, agents, reward) {
  const next = { ...scores };
  const learningRate = 0.2;

  agents.forEach(agent => {
    const current = next[agent.name] ?? DEFAULT_AGENT_SCORE;
    next[agent.name] = round(current + learningRate * (reward - current));
  });

  return next;
}

function updateWorkflowCounts(counts, taskType) {
  return {
    ...counts,
    [taskType]: (counts[taskType] || 0) + 1,
  };
}

function detectPluginCandidates(counts, existingCandidates) {
  const seen = new Set(existingCandidates.map(candidate => candidate.taskType));
  const next = [...existingCandidates];

  Object.entries(counts).forEach(([taskType, count]) => {
    if (count >= 3 && !seen.has(taskType)) {
      next.push({
        taskType,
        name: `${taskType.replace(/-/g, ' ')} accelerator`,
        status: 'candidate',
        reason: `Repeated ${count} times; ready for plugin extraction.`,
        createdAt: new Date().toISOString(),
      });
    }
  });

  return next.slice(-8);
}

function buildReflection({ trace, error, signal }) {
  return {
    id: `reflection-${Date.now()}`,
    traceId: trace.id,
    taskType: trace.taskType,
    summary: error
      ? `Execution failed during ${trace.taskType}: ${error.message}`
      : `${trace.taskType} produced elevated risk and should route Risk Agent earlier.`,
    fix: error
      ? 'Recall similar successful traces, lower prompt complexity, and verify provider availability before retry.'
      : 'Increase risk weighting and prefer WAIT/HOLD until confirmation improves.',
    createdAt: new Date().toISOString(),
    signal: signal || null,
  };
}

function calculateMetrics(traces) {
  if (!traces.length) return initialState.metrics;

  const successes = traces.filter(trace => trace.success);
  const totalLatency = traces.reduce((sum, trace) => sum + trace.latencyMs, 0);
  const totalConfidence = traces.reduce((sum, trace) => sum + trace.confidence, 0);
  const efficient = traces.filter(trace => trace.latencyMs < 20_000).length;

  return {
    taskCount: traces.length,
    successRate: round(successes.length / traces.length),
    averageLatencyMs: Math.round(totalLatency / traces.length),
    averageConfidence: Math.round(totalConfidence / traces.length),
    tokenEfficiency: round(efficient / traces.length),
  };
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function round(value) {
  return Math.round(value * 100) / 100;
}
