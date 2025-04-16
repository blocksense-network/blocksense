import { drawBox } from '@blocksense/base-utils/tty';

type LogLevel = 'info' | 'error' | 'warn';

interface LogLevelConfig {
  icon: string;
  logFunction: (message?: any, ...optionalParams: Array<any>) => void;
}

const logLevelConfig: Record<LogLevel, LogLevelConfig> = {
  info: {
    icon: '(i)',
    logFunction: console.log,
  },
  error: {
    icon: '❌',
    logFunction: console.error,
  },
  warn: {
    icon: '⚠️',
    logFunction: console.warn,
  },
};

export function logMessage(
  level: LogLevel,
  title: string,
  message: string,
  width?: number,
): void {
  const rendered = drawBox(
    `${logLevelConfig[level].icon} ${title}`,
    message,
  )({ maxWidth: width || 80 });
  logLevelConfig[level].logFunction(rendered.join('\n'));
}

export function logProcessComposeInfo(status: 'Starting' | 'Stopping'): void {
  const time = new Date();
  logMessage(
    'info',
    `${status} process-compose`,
    `${status} time: ${time.toDateString()} ${time.toTimeString()}`,
  );
}
