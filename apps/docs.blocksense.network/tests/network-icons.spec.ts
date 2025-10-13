import { describe, test, expect } from 'vitest';
import path from 'path';

import { listEvmNetworks } from '@blocksense/config-types/read-write-config';
import { selectDirectory } from '@blocksense/base-utils/fs';

import { networkNameToIconName } from '../src/utils';

describe('Network Icons', () => {
  test('all deployed networks should have corresponding icons in the website', async () => {
    const deployedNetworks = await listEvmNetworks();

    const expectedIconNames = deployedNetworks.map(network =>
      networkNameToIconName(network),
    );

    const uniqueExpectedIconNames = [...new Set(expectedIconNames)];

    const iconsDir = path.join(__dirname, '../public/images/network-icons');
    const { readDir } = selectDirectory(iconsDir);
    const iconFiles = await readDir();

    const availableIconNames = iconFiles
      .filter(file => file.endsWith('.png'))
      .map(file => file.replace('.png', ''));

    const missingIcons = uniqueExpectedIconNames.filter(
      iconName => !availableIconNames.includes(iconName),
    );

    let errorMessage = '';
    if (missingIcons.length > 0) {
      errorMessage += `Missing icons for networks: ${missingIcons.join(', ')}\n`;
    }

    if (errorMessage) {
      errorMessage += `\n\nExpected icons: ${uniqueExpectedIconNames.sort().join(', ')}`;
      errorMessage += `\n\nAvailable icons: ${availableIconNames.sort().join(', ')}`;
      errorMessage += `\n\nDeployed networks: ${deployedNetworks.sort().join(', ')}`;
      errorMessage += `\n\nMissing icons: ${missingIcons.join(', ')}`;
    }

    expect(missingIcons, errorMessage).toEqual([]);
  });
});
