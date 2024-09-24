import { beforeAll, describe, expect, it } from 'vitest';

import { fromMatrix, defaultHelpers as helpers, result } from 'generator-jhipster/testing';

const SUB_GENERATOR = 'spring-boot';
const BLUEPRINT_NAMESPACE = `jhipster:${SUB_GENERATOR}`;

const matrix = fromMatrix({
  applicationType: ['monolith', 'gateway', 'microservice'],
  build: ['maven', 'gradle'],
  reactive: [false, true],
  auth: ['jwt', 'oauth2'],
});

describe('SubGenerator spring-boot of native JHipster blueprint', () => {
  for (const [title, options] of Object.entries(matrix)) {
    describe(title, () => {
      beforeAll(async function () {
        await helpers
          .run(BLUEPRINT_NAMESPACE)
          .withJHipsterConfig()
          .withOptions({
            ignoreNeedlesError: true,
            blueprint: ['native'],
            experimental: true,
            ...options,
          })
          .withJHipsterLookup()
          .withParentBlueprintLookup();
      });

      it('should succeed', () => {
        expect(result.getStateSnapshot()).toMatchSnapshot();
      });
    });
  }
});
