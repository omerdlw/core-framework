export interface KMeansResult {
  assignment: Int32Array;
  centroids: Float64Array;
  k: number;
}

export interface KMeansOptions {
  iterations?: number;
  lightnessWeight?: number;
}

export function kmeans(
  points: Float64Array,
  weights: Float64Array,
  requested: number,
  { iterations = 16, lightnessWeight = 0.45 }: KMeansOptions = {},
): KMeansResult {
  const n = weights.length;
  const assignment = new Int32Array(n);
  const k = Math.max(0, Math.min(requested, n));
  const centroids = new Float64Array(k * 3);
  if (k === 0) return { assignment, centroids, k };

  const distance = (i: number, j: number) => {
    const dl = points[i * 3] - centroids[j * 3];
    const da = points[i * 3 + 1] - centroids[j * 3 + 1];
    const db = points[i * 3 + 2] - centroids[j * 3 + 2];
    return lightnessWeight * dl * dl + da * da + db * db;
  };

  let first = 0;
  for (let i = 1; i < n; i++) if (weights[i] > weights[first]) first = i;
  centroids.set(points.subarray(first * 3, first * 3 + 3), 0);

  const nearest = new Float64Array(n).fill(Infinity);
  let found = 1;
  for (; found < k; found++) {
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < n; i++) {
      const d = distance(i, found - 1);
      if (d < nearest[i]) nearest[i] = d;
      const score = weights[i] * nearest[i];
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) break;
    centroids.set(points.subarray(best * 3, best * 3 + 3), found * 3);
  }

  const sums = new Float64Array(found * 4);
  for (let round = 0; round < iterations; round++) {
    let moved = round === 0;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestDistance = Infinity;
      for (let j = 0; j < found; j++) {
        const d = distance(i, j);
        if (d < bestDistance) {
          bestDistance = d;
          best = j;
        }
      }
      if (assignment[i] !== best) {
        assignment[i] = best;
        moved = true;
      }
    }
    if (!moved) break;

    sums.fill(0);
    for (let i = 0; i < n; i++) {
      const j = assignment[i] * 4;
      const w = weights[i];
      sums[j] += points[i * 3] * w;
      sums[j + 1] += points[i * 3 + 1] * w;
      sums[j + 2] += points[i * 3 + 2] * w;
      sums[j + 3] += w;
    }
    for (let j = 0; j < found; j++) {
      const w = sums[j * 4 + 3];
      if (w <= 0) continue;
      centroids[j * 3] = sums[j * 4] / w;
      centroids[j * 3 + 1] = sums[j * 4 + 1] / w;
      centroids[j * 3 + 2] = sums[j * 4 + 2] / w;
    }
  }

  return { assignment, centroids: centroids.slice(0, found * 3), k: found };
}
