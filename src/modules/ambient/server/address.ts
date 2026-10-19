// Which hosts and addresses the server entry refuses to fetch from: anything
// that is not plainly on the public internet.

const PRIVATE_NAMES = /(^|\.)(localhost|local|internal|intranet|lan|home\.arpa|localdomain)$/;

/** Lower-cased, without the trailing dot(s) and IPv6 brackets. */
export function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, "").replace(/^\[|\]$/g, "");
}

function parseIPv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return bytes.every((byte) => byte >= 0 && byte <= 255) ? bytes : null;
}

function isPrivateIPv4([a, b, c]: number[]): boolean {
  return (
    a === 0 || // "this network"
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast, reserved, broadcast
  );
}

/** Eight 16-bit groups, or `null` when `value` is not an IPv6 address. */
function parseIPv6(value: string): number[] | null {
  let text = value.split("%")[0]; // zone id
  const tail = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const v4 = parseIPv4(tail[2]);
    if (!v4) return null;
    text = `${tail[1]}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const read = (part: string) => (part ? part.split(":") : []);
  const head = read(halves[0]);
  const rest = halves.length === 2 ? read(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  const words = groups.map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  return words.length === 8 && words.every((word) => word >= 0) ? words : null;
}

function isPrivateIPv6(words: number[]): boolean {
  const [w0, w1, w2, w3, w4, w5, w6, w7] = words;
  const embedded = () => [w6 >> 8, w6 & 255, w7 >> 8, w7 & 255];
  if (words.slice(0, 7).every((word) => word === 0)) return w7 <= 1; // :: and ::1
  // IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d), NAT64 (64:ff9b::a.b.c.d)
  if (w0 === 0 && w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0 && (w5 === 0xffff || w5 === 0)) {
    return isPrivateIPv4(embedded());
  }
  if (w0 === 0x64 && w1 === 0xff9b) return isPrivateIPv4(embedded());
  if (w0 === 0x2002) return isPrivateIPv4([w1 >> 8, w1 & 255, w2 >> 8, w2 & 255]); // 6to4
  return (
    (w0 & 0xfe00) === 0xfc00 || // unique local
    (w0 & 0xffc0) === 0xfe80 || // link-local
    (w0 & 0xff00) === 0xff00 || // multicast
    (w0 === 0x2001 && w1 === 0xdb8) // documentation
  );
}

/** `true` for loopback, private, link-local, CGNAT, multicast and reserved IPs. */
export function isPrivateAddress(address: string): boolean {
  const host = normalizeHost(address);
  const v4 = parseIPv4(host);
  if (v4) return isPrivateIPv4(v4);
  const v6 = parseIPv6(host);
  return v6 ? isPrivateIPv6(v6) : false;
}

export const isIpLiteral = (hostname: string) => {
  const host = normalizeHost(hostname);
  return parseIPv4(host) !== null || parseIPv6(host) !== null;
};

/** A host name that only means something on a private network. */
export function isPrivateHostname(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (!host) return true;
  if (isIpLiteral(host)) return isPrivateAddress(host);
  return PRIVATE_NAMES.test(host) || !host.includes(".");
}
