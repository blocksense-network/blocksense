import boxen from 'boxen';

type LogLevel = 'info' | 'error' | 'warn';

interface LogLevelConfig {
  icon: string;
  logFunction: (message?: any, ...optionalParams: any[]) => void;
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
  const formattedMessage = boxen(message, {
    width: width,
    float: 'center',
    title: `${logLevelConfig[level].icon} ${title}`,
    titleAlignment: 'center',
    padding: 1,
    margin: 1,
    borderStyle: 'double',
  });

  logLevelConfig[level].logFunction(formattedMessage);
}

export function logProcessComposeInfo(status: 'Starting' | 'Stopping'): void {
  const time = new Date();
  logMessage(
    'info',
    `${status} process-compose`,
    `${status} time: ${time.toDateString()} ${time.toTimeString()}`,
  );
}
