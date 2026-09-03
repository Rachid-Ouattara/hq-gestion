/**
 * Comparaison d'IP sans dépendance externe — gère l'IPv4 nu, l'IPv4 « mappée »
 * en IPv6 (`::ffff:x.x.x.x`, forme fréquente derrière `trust proxy`), et la
 * notation CIDR (`x.x.x.x/24`).
 */

function normalizeIp(ip) {
  if (!ip) return ip;
  if (ip === '::1') return '127.0.0.1';
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  return mapped ? mapped[1] : ip;
}

function ipToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/** `ip` : l'adresse du client. `ipOuCidr` : une IP exacte ou une notation CIDR (`x.x.x.x/24`). */
export function ipInRange(ip, ipOuCidr) {
  const clientIp = normalizeIp(ip);
  const [rangeIp, prefixStr] = ipOuCidr.trim().split('/');
  const clientInt = ipToInt(clientIp);
  const rangeInt = ipToInt(rangeIp);
  if (clientInt === null || rangeInt === null) return false;

  if (prefixStr === undefined) return clientInt === rangeInt;

  const prefix = Number(prefixStr);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (clientInt & mask) === (rangeInt & mask);
}

export function isIpAllowed(ip, allowedList) {
  return allowedList.some((entry) => ipInRange(ip, entry.ip_ou_cidr));
}
