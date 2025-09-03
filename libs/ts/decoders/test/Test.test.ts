import { expandJsonFields } from '../src/utils';
import data from './test.json';

describe.only('expandJsonFields', () => {
  it('should expand JSON fields correctly', () => {
    const res = expandJsonFields('payload', data);
    console.log(JSON.stringify(res.inputData, null, 2));
    console.log(JSON.stringify(res.unionTypes, null, 2));
  });
});
