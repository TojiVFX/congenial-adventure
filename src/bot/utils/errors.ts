import { GrammyError, HttpError } from 'grammy';

export interface ClassifiedError {
  isBenign: boolean;
  isCritical: boolean;
  category: 'telegram_benign' | 'telegram_critical' | 'telegram_ratelimit' | 'network' | 'database' | 'unknown';
  message: string;
  code?: number;
}

/**
 * Regex patterns for benign errors that are part of normal bot operation
 * and do not need alerts or alarm logs.
 */
const BENIGN_PATTERNS = [
  /query is too old/i,
  /query ID is invalid/i,
  /message is not modified/i,
  /message to edit not found/i,
  /bot was blocked by the user/i,
  /user is deactivated/i,
  /chat not found/i,
  /USER_ALREADY_PARTICIPANT/i,
  /HIDE_REQUESTER_MISSING/i,
  /cannot be modified/i,
  /have no rights to send a message/i,
];

/**
 * Regex patterns for critical errors where bot operation in a channel is compromised
 */
const CRITICAL_PATTERNS = [
  /not enough rights/i,
  /CHAT_ADMIN_REQUIRED/i,
  /need administrator rights/i,
  /bot was kicked/i,
  /rights to invite/i,
];

/**
 * Classifies an incoming error to determine appropriate logging and alerting strategy
 */
export function classifyError(error: any): ClassifiedError {
  const message = error?.description || error?.message || String(error);
  const code = error?.error_code || error?.code;

  if (error instanceof GrammyError || error?.error_code) {
    if (code === 429) {
      return {
        isBenign: false,
        isCritical: false,
        category: 'telegram_ratelimit',
        message,
        code,
      };
    }

    for (const pattern of CRITICAL_PATTERNS) {
      if (pattern.test(message)) {
        return {
          isBenign: false,
          isCritical: true,
          category: 'telegram_critical',
          message,
          code,
        };
      }
    }

    for (const pattern of BENIGN_PATTERNS) {
      if (pattern.test(message)) {
        return {
          isBenign: true,
          isCritical: false,
          category: 'telegram_benign',
          message,
          code,
        };
      }
    }

    return {
      isBenign: false,
      isCritical: false,
      category: 'telegram_critical',
      message,
      code,
    };
  }

  if (error instanceof HttpError || /ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(message)) {
    return {
      isBenign: false,
      isCritical: false,
      category: 'network',
      message,
      code,
    };
  }

  if (/Mongo|Mongoose|connection timeout/i.test(message)) {
    return {
      isBenign: false,
      isCritical: true,
      category: 'database',
      message,
      code,
    };
  }

  return {
    isBenign: false,
    isCritical: false,
    category: 'unknown',
    message,
    code,
  };
}
