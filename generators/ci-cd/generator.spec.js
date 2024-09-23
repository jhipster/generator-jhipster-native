import { beforeAll, describe, expect, it } from 'vitest';

import { defaultHelpers as helpers, result } from 'generator-jhipster/testing';

const SUB_GENERATOR = 'ci-cd';
const BLUEPRINT_NAMESPACE = `jhipster:${SUB_GENERATOR}`;

describe('SubGenerator ci-cd of native JHipster blueprint', () => {
  describe('run', () => {
    beforeAll(async function () {
      await helpers
        .run(BLUEPRINT_NAMESPACE)
        .withJHipsterConfig({
          testFrameworks: ['cypress'],
        })
        .withArguments(['github'])
        .withOptions({
          ignoreNeedlesError: true,
          blueprint: ['native'],
        })
        .withJHipsterLookup()
        .withParentBlueprintLookup();
    });

    it('should succeed', () => {
      expect(result.getStateSnapshot()).toMatchSnapshot();
    });

    it('native.yml should match snapshot', () => {
      expect(result.getSnapshot('**/.github/workflows/native.yml')).toMatchSnapshot();
    });

    it('native-artifact.yml should match snapshot', () => {
      expect(result.getSnapshot('**/.github/workflows/native-artifact.yml')).toMatchSnapshot();
    });
  });
});
