import { expect } from 'expect';

import { helpers, lookups } from '#test-utils';

describe('SubGenerator ci-cd of native JHipster blueprint', () => {
  describe('run', () => {
    let result;
    before(async function () {
      result = await helpers
        .create('jhipster:ci-cd')
        .withOptions({
          reproducible: true,
          defaults: true,
          blueprint: 'native',
          autoconfigureGithub: true,
          localConfig: {
            baseName: 'jhipster',
            testFrameworks: ['cypress'],
          },
        })
        .withLookups(lookups)
        .run();
    });

    it('native.yml should match snapshot', () => {
      expect(result.getSnapshot('**/.github/workflows/native.yml')).toMatchSnapshot();
    });

    it('native-artifact.yml should match snapshot', () => {
      expect(result.getSnapshot('**/.github/workflows/native-artifact.yml')).toMatchSnapshot();
    });

    it('generated files should match snapshot', () => {
      expect(result.getStateSnapshot()).toMatchSnapshot();
    });
  });
});
