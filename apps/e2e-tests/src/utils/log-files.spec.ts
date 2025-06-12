import { describe, expect, test } from 'vitest';
import { getLogsLines, parseLogs } from './log-files';
import { processComposeLogsFiles } from '@blocksense/base-utils';

describe('Test utils for working with log files', async () => {
  const mockLogs = await parseLogs('sequencer', `${__dirname}/../mock`);

  test('parseLogs should return an array of log lines', async () => {
    expect(mockLogs).toBeInstanceOf(Array);
    expect(mockLogs.length).toBe(10);
    expect(mockLogs[0]).toHaveProperty('lineNumber');
    expect(mockLogs[0]).toHaveProperty('content');
  });

  test('getLogsLines should return a string with log lines', async () => {
    const logLines = Array.from({ length: 10 }, (_, i) => i + 1)
      .map(lineNumber => {
        return `${processComposeLogsFiles['sequencer']}:${lineNumber}`;
      })
      .join('\n');
    const logsString = getLogsLines(mockLogs, 'sequencer');
    expect(logsString).toBe(logLines);
  });
});
