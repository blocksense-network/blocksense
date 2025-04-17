import {
  selectDirectory,
  processComposeLogsDir,
  processComposeLogsFiles,
} from '@blocksense/base-utils';

type LogLine = {
  lineNumber: number;
  content: string;
};

export async function parseLogs(
  logFileName: keyof typeof processComposeLogsFiles,
  logsDir: string = processComposeLogsDir,
): Promise<LogLine[]> {
  const { read } = selectDirectory(logsDir);
  const logs = await read({
    base: `${logFileName}.log`,
  });
  const logLines = logs.split('\n').map((line, index) => {
    return {
      lineNumber: ++index,
      content: line.trim(),
    };
  });

  return logLines;
}

export function getLogsLines(
  logLines: LogLine[],
  logFileName: keyof typeof processComposeLogsFiles,
): string {
  return logLines
    .map(line => {
      return `${processComposeLogsFiles[logFileName]}:${line.lineNumber}`;
    })
    .join('\n');
}
