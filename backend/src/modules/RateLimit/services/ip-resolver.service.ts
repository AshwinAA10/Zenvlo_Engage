import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';

/**
 * IpResolverService
 *
 * Securely extracts and verifies client IP addresses.
 *
 * Defenses:
 * - Prevents X-Forwarded-For spoofing: Header is NEVER trusted unless the direct
 *   socket connection originates from a designated trusted proxy / private network.
 * - Parses proxy chains right-to-left to discard intermediate trusted proxy hops.
 * - Strips IPv6-mapped IPv4 prefixes (::ffff:).
 * - Validates IP structure using node:net.
 */
@Injectable()
export class IpResolverService {
  private readonly trustProxy: boolean;
  private readonly trustedProxiesList: Set<string>;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const rawTrust =
      this.configService?.get<string>('TRUST_PROXY') ??
      process.env.TRUST_PROXY ??
      'false';

    if (rawTrust === 'true' || rawTrust === '1') {
      this.trustProxy = true;
      this.trustedProxiesList = new Set();
    } else if (rawTrust === 'false' || rawTrust === '0' || !rawTrust) {
      this.trustProxy = false;
      this.trustedProxiesList = new Set();
    } else {
      // Comma-separated list of trusted proxy IPs
      this.trustProxy = true;
      this.trustedProxiesList = new Set(
        rawTrust.split(',').map((ip) => this.normalizeIp(ip.trim())),
      );
    }
  }

  /**
   * Resolves the true client IP from request and connection metadata.
   */
  resolveClientIp(req: any): string {
    const rawDirectPeer =
      req?.socket?.remoteAddress ||
      req?.raw?.socket?.remoteAddress ||
      req?.connection?.remoteAddress ||
      req?.ip ||
      '127.0.0.1';

    const directPeer = this.normalizeIp(rawDirectPeer);

    // If proxy trusting is completely disabled, use direct peer address
    if (!this.trustProxy) {
      return directPeer;
    }

    // Verify whether the direct connection peer is trusted
    const isPeerTrusted = this.isTrustedProxy(directPeer);
    if (!isPeerTrusted) {
      // Untrusted peer attempting to spoof X-Forwarded-For: IGNORE headers
      return directPeer;
    }

    // Inspect headers when peer is verified as a trusted proxy
    const headers = req?.headers || req?.raw?.headers || {};
    const forwardedFor = headers['x-forwarded-for'];
    const realIp = headers['x-real-ip'] || headers['cf-connecting-ip'];

    if (forwardedFor && typeof forwardedFor === 'string') {
      const parts = forwardedFor
        .split(',')
        .map((p) => this.normalizeIp(p.trim()))
        .filter((p) => net.isIP(p) !== 0);

      // Walk right-to-left: the first untrusted IP is the real client
      for (let i = parts.length - 1; i >= 0; i--) {
        const candidate = parts[i];
        if (!this.isTrustedProxy(candidate)) {
          return candidate;
        }
      }

      // If all hops were trusted proxies, return the leftmost entry
      if (parts.length > 0) {
        return parts[0];
      }
    }

    if (realIp && typeof realIp === 'string') {
      const normalizedReal = this.normalizeIp(realIp.trim());
      if (net.isIP(normalizedReal) !== 0) {
        return normalizedReal;
      }
    }

    return directPeer;
  }

  /**
   * Checks if an IP belongs to a trusted proxy or private/loopback network.
   */
  isTrustedProxy(ip: string): boolean {
    const normalized = this.normalizeIp(ip);

    // Check explicit trusted list if provided
    if (this.trustedProxiesList.size > 0) {
      return this.trustedProxiesList.has(normalized);
    }

    // Default trusted proxy ranges when trustProxy=true:
    // 1. Loopback
    if (normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost') {
      return true;
    }

    // 2. Private IPv4 ranges (RFC 1918) & link-local
    if (net.isIPv4(normalized)) {
      const octets = normalized.split('.').map((o) => parseInt(o, 10));
      // 10.0.0.0/8
      if (octets[0] === 10) return true;
      // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
      // 192.168.0.0/16
      if (octets[0] === 192 && octets[1] === 168) return true;
      // 169.254.0.0/16 (link-local)
      if (octets[0] === 169 && octets[1] === 254) return true;
    }

    // 3. Private / local IPv6
    if (net.isIPv6(normalized)) {
      const lower = normalized.toLowerCase();
      // fc00::/7 (unique local)
      if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
      // fe80::/10 (link local)
      if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Normalizes IP representation, stripping IPv6-mapped IPv4 prefix (::ffff:).
   */
  normalizeIp(ip: string): string {
    if (!ip) return '127.0.0.1';
    let clean = ip.trim();
    if (clean.startsWith('::ffff:')) {
      clean = clean.slice(7);
    }
    return clean;
  }
}
