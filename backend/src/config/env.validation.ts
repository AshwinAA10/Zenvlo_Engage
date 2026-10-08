export interface EnvironmentVariables {
  NODE_ENV?: string;
  PORT?: number;
  POSTGRES_HOST?: string;
  POSTGRES_PORT?: number;
  POSTGRES_USER?: string;
  POSTGRES_PASSWORD?: string;
  POSTGRES_DB?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  WHATSAPP_PROVIDER?: string;
  ZENVLO_WHATSAPP_API_URL?: string;
  ZENVLO_WHATSAPP_API_KEY?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  TRUST_PROXY?: string;
  RATE_LIMIT_ENABLED?: string;
  RATE_LIMIT_GLOBAL_LIMIT?: number;
  RATE_LIMIT_GLOBAL_TTL?: number;
  RATE_LIMIT_AUTH_LOGIN_LIMIT?: number;
  RATE_LIMIT_AUTH_LOGIN_TTL?: number;
  RATE_LIMIT_AUTH_SIGNUP_LIMIT?: number;
  RATE_LIMIT_AUTH_SIGNUP_TTL?: number;
  RATE_LIMIT_UPLOAD_LIMIT?: number;
  RATE_LIMIT_UPLOAD_TTL?: number;
  RATE_LIMIT_PUBLIC_FORM_LIMIT?: number;
  RATE_LIMIT_PUBLIC_FORM_TTL?: number;
  [key: string]: any;
}

const FORBIDDEN_PROD_PROVIDERS = ['mock', 'sandbox', 'fake', 'dev', 'development', 'test', 'simulated'];

const INSECURE_JWT_PLACEHOLDERS = [
  'super_secret_jwt_key_zenvlo_engage_production_change_me',
  'zenvlo_engage_dev_secret_key_change_in_production',
  'your_super_secret_jwt_key_at_least_64_characters_long_for_security',
];

const INSECURE_JWT_REFRESH_PLACEHOLDERS = [
  'super_secret_jwt_refresh_key_zenvlo_engage_production_change_me',
  'zenvlo_engage_dev_refresh_secret_key_change_in_production',
  'your_super_secret_jwt_refresh_key_at_least_64_characters_long',
];

/**
 * Validates environment variables at application bootstrap.
 * Enforces production security invariants and prevents dangerous fallbacks.
 */
export function validateEnvironment(config: Record<string, any>): Record<string, any> {
  const nodeEnv = (config.NODE_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  const isProduction = nodeEnv === 'production';

  if (isProduction) {
    const errors: string[] = [];

    // 1. WhatsApp Provider Enforcement
    const provider = (config.WHATSAPP_PROVIDER || process.env.WHATSAPP_PROVIDER || 'zenvlo').toLowerCase();
    if (FORBIDDEN_PROD_PROVIDERS.includes(provider)) {
      errors.push(
        `[SECURITY FATAL] Insecure WhatsApp provider '${provider}' is strictly forbidden in production. Production must use 'zenvlo'.`,
      );
    }

    // 2. WhatsApp API URL validation
    const whatsappApiUrl = config.ZENVLO_WHATSAPP_API_URL || process.env.ZENVLO_WHATSAPP_API_URL;
    if (!whatsappApiUrl || typeof whatsappApiUrl !== 'string' || whatsappApiUrl.trim().length === 0) {
      errors.push('[SECURITY FATAL] ZENVLO_WHATSAPP_API_URL is required in production.');
    } else {
      try {
        const parsed = new URL(whatsappApiUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errors.push('[SECURITY FATAL] ZENVLO_WHATSAPP_API_URL must be a valid HTTP/HTTPS URL.');
        }
      } catch {
        errors.push('[SECURITY FATAL] ZENVLO_WHATSAPP_API_URL is not a valid URL.');
      }
    }

    // 3. WhatsApp API Key validation
    const whatsappApiKey = config.ZENVLO_WHATSAPP_API_KEY || process.env.ZENVLO_WHATSAPP_API_KEY;
    if (!whatsappApiKey || typeof whatsappApiKey !== 'string' || whatsappApiKey.trim().length === 0) {
      errors.push('[SECURITY FATAL] ZENVLO_WHATSAPP_API_KEY is required in production.');
    } else if (
      whatsappApiKey.startsWith('placeholder_') ||
      whatsappApiKey.includes('your_internal_zenvlo_engage_api_key')
    ) {
      errors.push('[SECURITY FATAL] ZENVLO_WHATSAPP_API_KEY cannot use placeholder credentials in production.');
    }

    // 4. JWT Secret Validation
    const jwtSecret = config.JWT_SECRET || process.env.JWT_SECRET;
    if (!jwtSecret || INSECURE_JWT_PLACEHOLDERS.includes(jwtSecret)) {
      errors.push('[SECURITY FATAL] JWT_SECRET must be securely set in production and cannot use development placeholders.');
    }

    const jwtRefreshSecret = config.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET;
    if (!jwtRefreshSecret || INSECURE_JWT_REFRESH_PLACEHOLDERS.includes(jwtRefreshSecret)) {
      errors.push(
        '[SECURITY FATAL] JWT_REFRESH_SECRET must be securely set in production and cannot use development placeholders.',
      );
    }

    // 5. Database Password Validation
    const postgresPassword = config.POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD;
    if (!postgresPassword) {
      errors.push('[SECURITY FATAL] POSTGRES_PASSWORD is required in production.');
    }

    // 6. Webhook Secrets Validation
    const metaAppSecret = config.META_APP_SECRET || process.env.META_APP_SECRET;
    if (metaAppSecret && (metaAppSecret.startsWith('placeholder_') || metaAppSecret.includes('your_live_'))) {
      errors.push('[SECURITY FATAL] META_APP_SECRET cannot use placeholder credentials in production.');
    }

    const zenvloWebhookSecret = config.ZENVLO_WHATSAPP_WEBHOOK_SECRET || process.env.ZENVLO_WHATSAPP_WEBHOOK_SECRET;
    if (zenvloWebhookSecret && (zenvloWebhookSecret.startsWith('placeholder_') || zenvloWebhookSecret.includes('your_internal_'))) {
      errors.push('[SECURITY FATAL] ZENVLO_WHATSAPP_WEBHOOK_SECRET cannot use placeholder credentials in production.');
    }

    if (errors.length > 0) {
      throw new Error(`Production Environment Configuration Validation Failed:\n- ${errors.join('\n- ')}`);
    }
  }

  return config;
}
