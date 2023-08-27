import { beforeAll, describe, it } from 'vitest';

import { helpers, lookups } from '#test-utils';

const SUB_GENERATOR = 'app';
const BLUEPRINT_NAMESPACE = `jhipster:${SUB_GENERATOR}`;

describe('SubGenerator app of native JHipster blueprint', () => {
  describe('with defaults config', () => {
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
        })
        .withLookups(lookups)
        .run();
    });

    it('should write default config', () => {
      result.assertJsonFileContent('.yo-rc.json', { 'generator-jhipster': { cacheProvider: 'no', enableHibernateCache: false } });
    });
  });
  describe('with defaults config, foo cacheProvider and true enableHibernateCache', () => {
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
          enableHibernateCache: true,
          cacheProvider: 'foo',
        })
        .withLookups(lookups)
        .run();
    });

    it('should write custom config', () => {
      result.assertJsonFileContent('.yo-rc.json', { 'generator-jhipster': { cacheProvider: 'foo', enableHibernateCache: true } });
    });
  });
});
