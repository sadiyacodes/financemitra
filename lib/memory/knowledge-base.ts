import fs from 'fs';
import path from 'path';
import { KnowledgeEntry } from '../types';

// ── Synonym expansion for financial domain terms ─────────────────────────────
const SYNONYMS: Record<string, string[]> = {
  fuel:         ['petrol', 'diesel', 'gas'],
  petrol:       ['fuel', 'gas'],
  income:       ['earnings', 'salary', 'revenue', 'earning'],
  expenses:     ['spending', 'costs', 'expenditure', 'spend'],
  savings:      ['save', 'saving', 'surplus'],
  budget:       ['budgeting', 'plan'],
  forex:        ['exchange', 'currency', 'fx', 'usd', 'eur'],
  loan:         ['emi', 'debt', 'borrow', 'credit'],
  invest:       ['investment', 'investing', 'returns'],
  // Tax domain
  tax:          ['taxes', 'taxation', 'income tax', 'itr', 'return', 'filing'],
  tds:          ['tax deducted', 'deduction', '194o', 'platform deduct', 'withholding'],
  itr:          ['income tax return', 'tax return', 'filing', 'sugam', 'return'],
  gst:          ['goods services tax', 'indirect tax', 'registration'],
  presumptive:  ['44ada', '44ad', 'simplified', 'no books'],
  advance:      ['quarterly tax', 'installment', 'prepay', 'advance payment'],
  penalty:      ['fine', 'interest', '234b', '234c', 'late fee', 'notice'],
  regime:       ['new regime', 'old regime', 'tax regime', 'slab'],
  refund:       ['tax refund', 'overpaid', 'excess tds', 'credit'],
  grab:         ['platform', 'swiggy', 'ola', 'uber', 'ecommerce operator'],
};

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'this', 'that', 'with', 'have', 'from',
  'your', 'you', 'can', 'will', 'more', 'its', 'not', 'when', 'how',
  'what', 'use', 'get', 'per', 'than', 'but', 'about',
]);

// ── Tokenisation with synonym expansion ──────────────────────────────────────
function tokenize(text: string): string[] {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));

  const expanded: string[] = [...base];
  for (const word of base) {
    const syns = SYNONYMS[word];
    if (syns) expanded.push(...syns);
  }
  return expanded;
}

// ── TF-IDF index ─────────────────────────────────────────────────────────────
interface TFIDFIndex {
  idf: Map<string, number>;
  vectors: Map<string, number>[];
}

function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  // Use Array.from to avoid downlevelIteration issues
  Array.from(tf.entries()).forEach(([t, c]) => tf.set(t, c / tokens.length));
  return tf;
}

function buildIndex(entries: KnowledgeEntry[]): TFIDFIndex {
  const docs = entries.map(e =>
    tokenize(`${e.title} ${e.content} ${e.tags.join(' ')}`)
  );
  const N = docs.length;

  // IDF: smoothed to avoid division-by-zero
  const idf = new Map<string, number>();
  const allTerms = new Set(docs.flat());
  Array.from(allTerms).forEach(term => {
    const df = docs.filter(d => d.includes(term)).length;
    idf.set(term, Math.log((N + 1) / (df + 1)) + 1);
  });

  // TF-IDF vector per entry
  const vectors = docs.map(tokens => {
    const tf = computeTF(tokens);
    const vec = new Map<string, number>();
    Array.from(tf.entries()).forEach(([term, tfVal]) => {
      vec.set(term, tfVal * (idf.get(term) ?? 0));
    });
    return vec;
  });

  return { idf, vectors };
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0;
  Array.from(a.entries()).forEach(([t, v]) => {
    dot   += v * (b.get(t) ?? 0);
    normA += v * v;
  });
  Array.from(b.values()).forEach(v => { normB += v * v; });
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Cached KB + index ─────────────────────────────────────────────────────────
let kbCache: KnowledgeEntry[] | null = null;
let indexCache: TFIDFIndex | null = null;
let kbSizeCache = 0;

function loadKB(): { kb: KnowledgeEntry[]; index: TFIDFIndex } {
  const filePath = path.join(process.cwd(), 'data', 'knowledge-base.json');
  const stat = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  if (kbCache && indexCache && stat === kbSizeCache) return { kb: kbCache, index: indexCache };
  kbSizeCache = stat;
  kbCache = fs.existsSync(filePath)
    ? (JSON.parse(fs.readFileSync(filePath, 'utf8')) as KnowledgeEntry[])
    : [];
  indexCache = buildIndex(kbCache);
  return { kb: kbCache, index: indexCache };
}

// ── Public API ────────────────────────────────────────────────────────────────
export function retrieveRelevantTips(query: string, topK: number = 3): KnowledgeEntry[] {
  const { kb, index } = loadKB();
  if (kb.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Build query TF-IDF vector
  const queryTF = computeTF(queryTokens);
  const queryVec = new Map<string, number>();
  Array.from(queryTF.entries()).forEach(([term, tfVal]) => {
    queryVec.set(term, tfVal * (index.idf.get(term) ?? 1)); // 1 = unseen term penalty
  });

  // Score all entries by cosine similarity
  const scored = kb.map((entry, i) => ({
    entry,
    score: cosineSim(queryVec, index.vectors[i]),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter(s => s.score > 0.01) // ignore near-zero matches
    .slice(0, topK)
    .map(s => s.entry);
}
