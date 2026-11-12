export interface Entry {
  subpath: string;
  source: string;
  out: string;
  client: boolean;
}
export const ENTRIES: ReadonlyArray<Entry>;
export function buildExports(): Record<
  string,
  { types: string; import: string; default: string }
>;
