// Logger utility for Bocado AI
// Sanitizes logs in production to prevent data leaks
// Supports structured logging for production monitoring

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStructured: boolean; // Send to Sentry/external services
}

interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  component?: string;
  message: string;
  context?: Record<string, any>;
  stack?: string;
  duration?: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isDev = import.meta.env.DEV || import.meta.env.MODE === "development";

const config: LoggerConfig = {
  level: isDev ? "debug" : "warn",
  enableConsole: true,
  enableStructured: !isDev,
};

// Patterns que podrían indicar datos sensibles
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /api[_-]?key/i,
  /secret/i,
  /credential/i,
  /email/i,
  /uid[:\s=]/i,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // emails
];

const containsSensitiveData = (args: any[]): boolean => {
  const text = JSON.stringify(args).toLowerCase();
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
};

const sanitizeArgs = (args: any[]): any[] => {
  if (isDev) return args;

  return args.map((arg) => {
    if (typeof arg === "string") {
      // Truncar strings largos
      return arg.length > 500 ? arg.substring(0, 500) + "..." : arg;
    }
    return arg;
  });
};

/**
 * 📊 Envía logs estructurados a Sentry (en producción)
 */
const sendStructuredLog = (entry: StructuredLogEntry) => {
  if (!config.enableStructured || isDev) return;

  try {
    // Importar dinámicamente para no añadir peso en dev
    import("../utils/sentry").then(({ captureError, addBreadcrumb }) => {
      if (entry.level === "error") {
        captureError(new Error(entry.message), {
          extra: entry.context,
          tags: { component: entry.component },
        });
      } else {
        addBreadcrumb({
          message: entry.message,
          level: entry.level,
          data: entry.context,
          category: entry.component,
        });
      }
    });
  } catch (err) {
    console.warn("[Logger] Failed to send structured log:", err);
  }
};

export const logger = {
  debug: (...args: any[]) => {
    if (LOG_LEVELS[config.level] > LOG_LEVELS.debug) return;
    if (!config.enableConsole) return;
    if (!isDev) return; // No debug en producción

    console.debug("[BOCADO:DEBUG]", ...sanitizeArgs(args));
  },

  info: (...args: any[]) => {
    if (LOG_LEVELS[config.level] > LOG_LEVELS.info) return;
    if (!config.enableConsole) return;

    if (containsSensitiveData(args) && !isDev) {
      console.info("[BOCADO:INFO]", "[Datos omitidos por seguridad]");
      return;
    }

    console.info("[BOCADO:INFO]", ...sanitizeArgs(args));
  },

  warn: (...args: any[]) => {
    if (LOG_LEVELS[config.level] > LOG_LEVELS.warn) return;
    if (!config.enableConsole) return;

    console.warn("[BOCADO:WARN]", ...sanitizeArgs(args));
  },

  error: (...args: any[]) => {
    if (LOG_LEVELS[config.level] > LOG_LEVELS.error) return;
    if (!config.enableConsole) return;

    // En producción, sanitizar errores
    if (!isDev && containsSensitiveData(args)) {
      console.error(
        "[BOCADO:ERROR]",
        "Error occurred (details hidden in production)",
      );
      return;
    }

    console.error("[BOCADO:ERROR]", ...sanitizeArgs(args));
  },

  // Para errores que siempre deben loguearse (críticos)
  critical: (...args: any[]) => {
    console.error("[BOCADO:CRITICAL]", ...args);
  },

  /**
   * 📊 Structured logging con contexto (para análisis en producción)
   */
  structured: (
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    component?: string,
  ) => {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      context,
    };

    // Log a console primero
    logger[level](message, context);

    // Enviar a Sentry en producción
    sendStructuredLog(entry);
  },
};

// Hook para logging en desarrollo
export const useLogger = (component: string) => {
  return {
    debug: (...args: any[]) => logger.debug(`[${component}]`, ...args),
    info: (...args: any[]) => logger.info(`[${component}]`, ...args),
    warn: (...args: any[]) => logger.warn(`[${component}]`, ...args),
    error: (...args: any[]) => logger.error(`[${component}]`, ...args),
    
    /**
     * Structured logging con component automático
     */
    structured: (level: LogLevel, message: string, context?: Record<string, any>) => {
      logger.structured(level, message, context, component);
    },
  };
};

export default logger;
