/**
 * Scoring-config loader.
 *
 * All SessionScore weights, Likert anchors, result values, and eval tolerances
 * live in config/scoring.json (single source of truth for Claude's in-session
 * math, the evaluator, the report, and the diff). This module loads that file,
 * deep-merges it over built-in defaults (so a partial override is fine),
 * validates the weights, and computes a stable hash of the effective config.
 *
 * Every scorecard.json is stamped with that hash, so any later reader can tell
 * whether two scores were produced by the same ruler.
 *
 * Pure Node, no dependencies.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONFIG_PATH = path.join(ROOT, 'config', 'scoring.json');

// Built-in fallback: identical to config/scoring.json, so the tools still work
// (and score identically) if the file is deleted.
const DEFAULTS = {
  weights: { success: 0.4, efficiency: 0.2, seq: 0.133, intent: 0.133, confidence: 0.134 },
  result: { PASS: 1.0, PARTIAL: 0.5, FAIL: 0.0 },
  likert: {
    min: 1, max: 7,
    anchors: {
      1: "I'd close the tab and never come back / never recommend this",
      4: 'Neutral. No strong feeling either way.',
      7: 'Best site I\'ve used for this kind of product.',
    },
    items: {
      seq: 'Overall, how easy was that?',
      intent: 'Would you take the next step (demo / signup / share with team)?',
      confidence: 'How confident are you that you actually found / understood what you were looking for?',
    },
  },
  eval: { sessionScoreTolerance: 0.03, efficiencyTolerance: 0.02 },
};

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, override) {
  if (!isPlainObject(override)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (k.startsWith('$')) continue; // $comment keys are documentation, not config
    out[k] = isPlainObject(v) && isPlainObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

// Stable stringify (sorted keys) so the hash doesn't depend on key order.
function stableStringify(obj) {
  if (!isPlainObject(obj)) return JSON.stringify(obj);
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',') + '}';
}

function kitVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Load the effective scoring config.
 * @param {string} [customPath] optional path to an override scoring.json
 * @returns {{ scoring, hash, source, kitVersion }}
 */
function loadConfig(customPath) {
  const filePath = customPath ? path.resolve(customPath) : DEFAULT_CONFIG_PATH;
  let fileConfig = null;
  let source = 'built-in defaults';

  if (fs.existsSync(filePath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      source = path.relative(ROOT, filePath) || filePath;
    } catch (e) {
      throw new Error(`Could not parse scoring config ${filePath}: ${e.message}`);
    }
  } else if (customPath) {
    throw new Error(`Scoring config not found: ${filePath}`);
  }

  const scoring = deepMerge(DEFAULTS, fileConfig || {});

  const weightSum = Object.values(scoring.weights).reduce((s, w) => s + w, 0);
  if (Math.abs(weightSum - 1) > 0.001) {
    throw new Error(`SessionScore weights must sum to 1.0 (got ${weightSum.toFixed(3)}) — check the "weights" block in ${source}`);
  }

  const hash = crypto.createHash('sha1').update(stableStringify(scoring)).digest('hex').slice(0, 12);
  return { scoring, hash, source, kitVersion: kitVersion() };
}

module.exports = { loadConfig, DEFAULTS };
