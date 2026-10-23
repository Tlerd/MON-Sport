/**
 * Asserts OTP configuration at application startup (AC-34).
 * Throws when NODE_ENV=production and OTP_PROVIDER=dev,
 * or when OTP_PROVIDER=esms but an ESMS_* variable is missing.
 */
export function assertOtpConfig(env: NodeJS.ProcessEnv = process.env): void {
  const provider = env.OTP_PROVIDER;
  if (env.NODE_ENV === 'production' && provider === 'dev') {
    throw new Error('OTP_PROVIDER must not be dev in production.');
  }
  if (provider === 'esms') {
    if (!env.ESMS_API_KEY || !env.ESMS_SECRET_KEY || !env.ESMS_BRANDNAME) {
      throw new Error('ESMS_API_KEY, ESMS_SECRET_KEY, and ESMS_BRANDNAME must be set when OTP_PROVIDER is esms.');
    }
  }
}
