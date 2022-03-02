import { helpers, lookups } from '#test-utils';

describe('SubGenerator app of native JHipster blueprint', () => {
  describe('run', () => {
    let result;
    before(async function () {
      result = await helpers
        .create('jhipster:app')
        .withOptions({
          reproducible: true,
          defaults: true,
          blueprint: 'native',
          skipClient: true,
          skipServer: true,
        })
        .withLookups(lookups)
        .run();
    });

    it('should write default config', () => {
      result.assertJsonFileContent('.yo-rc.json', { 'generator-jhipster': { cacheProvider: 'no', enableHibernateCache: false } });
    });
  });
});
