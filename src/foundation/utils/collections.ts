interface MapLike<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): unknown;
}

/**
 * Returns the value stored under `key`, storing `create()` there first when
 * the key has no value yet. Works with Map and WeakMap.
 */
export function getOrInsert<K, V>(
  map: MapLike<K, V>,
  key: K,
  create: () => NoInfer<V>,
): V {
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    map.set(key, value);
  }
  return value;
}
