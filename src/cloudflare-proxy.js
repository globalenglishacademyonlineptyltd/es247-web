import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';

const IPV4_CIDRS = [
  '173.245.48.0/20','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22',
  '141.101.64.0/18','108.162.192.0/18','190.93.240.0/20','188.114.96.0/20',
  '197.234.240.0/22','198.41.128.0/17','162.158.0.0/15','104.16.0.0/13',
  '104.24.0.0/14','172.64.0.0/13','131.0.72.0/22'
];
const IPV6_CIDRS = [
  '2400:cb00::/32','2606:4700::/32','2803:f800::/32','2405:b500::/32',
  '2405:8100::/32','2a06:98c0::/29','2c0f:f248::/32'
];

function ipv4ToBigInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((value, part) => (value << 8n) | BigInt(part), 0n);
}

function ipv6ToBigInt(ip) {
  let address = ip.toLowerCase();
  if (address.includes('.')) {
    const lastColon = address.lastIndexOf(':');
    const ipv4Value = ipv4ToBigInt(address.slice(lastColon + 1));
    if (ipv4Value === null) return null;
    const high = Number((ipv4Value >> 16n) & 0xffffn).toString(16);
    const low = Number(ipv4Value & 0xffffn).toString(16);
    address = address.slice(0, lastColon + 1) + high + ':' + low;
  }
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.length !== 8) return null;
  try {
    return groups.reduce((value, group) => (value << 16n) | BigInt(parseInt(group || '0', 16)), 0n);
  } catch {
    return null;
  }
}

function cidrContains(ip, cidr) {
  const [network, prefixText] = cidr.split('/');
  const version = isIP(ip);
  if (!version || isIP(network) !== version) return false;
  const bits = version === 4 ? 32 : 128;
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return false;
  const ipValue = version === 4 ? ipv4ToBigInt(ip) : ipv6ToBigInt(ip);
  const networkValue = version === 4 ? ipv4ToBigInt(network) : ipv6ToBigInt(network);
  if (ipValue === null || networkValue === null) return false;
  const shift = BigInt(bits - prefix);
  return (ipValue >> shift) === (networkValue >> shift);
}

export function isCloudflareIp(input) {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim().replace(/^\[|\]$/g, '');
  const mapped = trimmed.toLowerCase().match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  const ip = mapped ? mapped[1] : trimmed;
  const version = isIP(ip);
  if (version === 4) return IPV4_CIDRS.some(cidr => cidrContains(ip, cidr));
  if (version === 6) return IPV6_CIDRS.some(cidr => cidrContains(ip, cidr));
  return false;
}


export function isValidOriginSecret(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string' || expected.length === 0) return false;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}
