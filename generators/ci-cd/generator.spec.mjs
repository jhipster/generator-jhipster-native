import { beforeAll, describe, expect, it } from 'vitest';

import { helpers, lookups } from '#test-utils';

const SUB_GENERATOR = 'ci-cd';
const BLUEPRINT_NAMESPACE = `jhipster:${SUB_GENERATOR}`;

describe('SubGenerator ci-cd of native JHipster blueprint', () => {
  describe('run', () => {
    let result;
    beforeAll(async function () {
      result = await helpers
        .create(BLUEPRINT_NAMESPACE)
        .withOptions({
          reproducible: true,
          defaults: true,
          baseName: 'jhipster',
          ignoreNeedlesError: true,
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
