import expect from 'expect';

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

    it('should match snapshot', () => {
      expect(result.getSnapshot('**/.github/workflows/native.yml')).toMatchSnapshot();
    });
  });
});
