import { helpers, lookups } from '#test-utils';

describe('SubGenerator app of native JHipster blueprint', () => {
  describe('with defaults config', () => {
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
  describe('with defaults config, foo cacheProvider and true enableHibernateCache', () => {
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
