/**
 * Production Runtime Guard (TypeScript)
 *
 * Enforces "Fail-Closed" behavior for sensitive protocol paths and security guards.
 * Aligned with the native Android ProductionRuntimeGuard.kt.
 */

/**
 * Fails closed in production environments, providing a simulation result in development.
 *
 * @param feature Name of the feature/path being guarded.
 * @param simulationResult The mock result to return in non-production builds.
 * @param isProduction Optional override for production detection (default uses Vite PROD flag).
 */
export function failClosed<T>(
  feature: string,
  simulationResult: T,
  isProduction: boolean = !!(import.meta as any).env?.PROD
): T {
  if (isProduction) {
    const errorMsg = `Guard: Production path for '${feature}' is not yet enabled or sync is compromised. Fail-closed enforced.`;
    console.error(`[SECURITY_GUARD] ${errorMsg}`);
    throw new Error(errorMsg);
  } else {
    console.warn(`[SECURITY_GUARD] Feature '${feature}' is currently in simulation/fallback mode (Non-Production).`);
    return simulationResult;
  }
}
