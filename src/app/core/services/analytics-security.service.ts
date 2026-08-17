import { Injectable, inject, isDevMode, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface ChallengeResponse {
  challengeId: string;
  nonce: string;
  difficulty: number;
  expiresAt: string;
}

interface TokenResponse {
  token: string;
  expiresAt: string;
}

/**
 * SEC-AH: Manages proof-of-work challenges and session tokens for analytics security.
 * - Fetches challenges from backend and solves them using SHA-256
 * - Fetches and caches session tokens (proof-of-visit)
 * - Computation uses crypto.subtle (non-blocking, Web Crypto API)
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsSecurityService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  // Cached challenge (pre-solved for fast event submission)
  private cachedSolution: { challengeId: string; solution: string } | null = null;
  // Serializes all challenge consumption/pre-solving. Solutions are single-use
  // server-side (consumed via getAndDelete), so concurrent callers must NEVER
  // share one — the second POST would get a 400 "invalid proof of work".
  private solveQueue: Promise<void> = Promise.resolve();

  // Cached session token
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;
  private tokenPromise: Promise<string | null> | null = null;

  /**
   * Fetch a session token from the backend. Caches until 1 minute before expiry.
   */
  async getToken(): Promise<string | null> {
    if (!isPlatformBrowser(this.platformId)) return null;

    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.cachedToken;
    }

    // Deduplicate concurrent requests
    if (this.tokenPromise) return this.tokenPromise;

    this.tokenPromise = this.fetchToken();
    this.tokenPromise.finally(() => { this.tokenPromise = null; });
    return this.tokenPromise;
  }

  /**
   * Get a solved challenge. Returns pre-cached solution if available,
   * otherwise fetches and solves a new one.
   */
  async getSolvedChallenge(): Promise<{ challengeId: string; solution: string } | null> {
    if (!isPlatformBrowser(this.platformId)) return null;

    const prior = this.solveQueue;
    const mine = (async () => {
      await prior;
      // Pop the pre-solved challenge if one is waiting; otherwise solve fresh.
      // Each queued caller pops or solves its OWN challenge — never a shared one.
      if (this.cachedSolution) {
        const result = this.cachedSolution;
        this.cachedSolution = null;
        return result;
      }
      return this.fetchAndSolveChallenge();
    })();
    this.solveQueue = mine.then(() => undefined, () => undefined);
    try {
      return await mine;
    } finally {
      // Replenish the cache in the background for the next event
      this.preSolveChallenge();
    }
  }

  /**
   * Pre-fetch and solve a challenge in the background for instant use later.
   * Call this after consent is granted to minimize latency on first event.
   * Enqueued behind any in-flight consumption so it can see whether the cache
   * still needs filling; a no-op when a solution is already waiting.
   */
  preSolveChallenge(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const prior = this.solveQueue;
    this.solveQueue = (async () => {
      await prior;
      if (this.cachedSolution) return;
      this.cachedSolution = await this.fetchAndSolveChallenge();
    })().catch(() => { /* ignore pre-solve failures */ });
  }

  /**
   * Drop the cached token. Called when the backend rejects it (403): the
   * server-side half of the token lives in Redis and can vanish independently
   * of the client cache (restart, failover, flush) — without this, every
   * active session keeps replaying a dead token until its client-side expiry.
   */
  invalidateToken(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  private async fetchToken(): Promise<string | null> {
    try {
      const resp = await firstValueFrom(
        this.http.get<TokenResponse>('/api/v1/analytics/token')
      );
      this.cachedToken = resp.token;
      this.tokenExpiresAt = new Date(resp.expiresAt).getTime();
      return resp.token;
    } catch {
      this.cachedToken = null;
      this.tokenExpiresAt = 0;
      return null;
    }
  }

  private async fetchAndSolveChallenge(): Promise<{ challengeId: string; solution: string }> {
    const challenge = await firstValueFrom(
      this.http.get<ChallengeResponse>('/api/v1/analytics/challenge')
    );
    const solution = await this.solvePoW(challenge.nonce, challenge.difficulty);
    return { challengeId: challenge.challengeId, solution };
  }

  /**
   * Solve a proof-of-work challenge: find a solution string such that
   * SHA-256(nonce + solution) has `difficulty` leading zero bits.
   * Uses Web Crypto API (async, non-blocking).
   */
  private async solvePoW(nonce: string, difficulty: number): Promise<string> {
    const encoder = new TextEncoder();
    let attempt = 0;

    const MAX_ATTEMPTS = 10_000_000;
    // Q5.4: Timeout to prevent UI freezing on high difficulty values
    const TIMEOUT_MS = 15_000;
    const startTime = Date.now();

    while (attempt < MAX_ATTEMPTS) {
      const data = encoder.encode(nonce + attempt);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = new Uint8Array(hashBuffer);

      if (this.hasLeadingZeros(hashArray, difficulty)) {
        return String(attempt);
      }

      attempt++;

      // Yield to the event loop every 2000 iterations to avoid blocking UI
      if (attempt % 2000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
        // Check timeout after yielding
        if (Date.now() - startTime > TIMEOUT_MS) {
          throw new Error(`PoW solver timed out after ${TIMEOUT_MS}ms (${attempt} attempts)`);
        }
      }
    }

    if (isDevMode()) {
      console.warn(`[AnalyticsSecurity] PoW exceeded maximum attempts (${MAX_ATTEMPTS}) for nonce="${nonce}", difficulty=${difficulty}`);
    }
    throw new Error(`PoW exceeded maximum attempts (${MAX_ATTEMPTS})`);
  }

  /**
   * Check if a hash has the required number of leading zero bits.
   */
  private hasLeadingZeros(hash: Uint8Array, bits: number): boolean {
    let remaining = bits;
    for (const byte of hash) {
      if (remaining <= 0) break;
      if (remaining >= 8) {
        if (byte !== 0) return false;
        remaining -= 8;
      } else {
        const mask = 0xFF << (8 - remaining);
        if ((byte & mask) !== 0) return false;
        remaining = 0;
      }
    }
    return true;
  }
}
