import { getKnuctConfig } from './config';

let consecutiveFailures = 0;
let openUntil = 0;
const COOLDOWN_MS = 60_000;

export function recordKnuctSuccess(): void {
  consecutiveFailures = 0;
  openUntil = 0;
}

export function recordKnuctFailure(): void {
  consecutiveFailures += 1;
  const { circuitBreakerThreshold } = getKnuctConfig();
  if (consecutiveFailures >= circuitBreakerThreshold) {
    openUntil = Date.now() + COOLDOWN_MS;
  }
}

export function isKnuctCircuitOpen(): boolean {
  if (openUntil && Date.now() < openUntil) {
    return true;
  }
  if (openUntil && Date.now() >= openUntil) {
    consecutiveFailures = 0;
    openUntil = 0;
  }
  return false;
}

export function getKnuctCircuitState(): { open: boolean; consecutiveFailures: number } {
  return { open: isKnuctCircuitOpen(), consecutiveFailures };
}

export function resetKnuctCircuit(): void {
  consecutiveFailures = 0;
  openUntil = 0;
}
