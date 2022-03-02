import chalk from 'chalk';
import { GeneratorBaseEntities } from 'generator-jhipster';
import { PRIORITY_PREFIX } from 'generator-jhipster/esm/priorities';

export default class extends GeneratorBaseEntities {
  constructor(args, opts, features) {
    super(args, opts, { taskPrefix: PRIORITY_PREFIX, ...features });

    this.option('cache-provider', {
      desc: 'Cache provider',
      type: String,
    });

    this.option('enable-hibernate-cache', {
      desc: 'Enable hibernate cache',
      type: Boolean,
    });

    if (this.options.help) return;

    if (!this.options.jhipsterContext) {
      throw new Error(`This is a JHipster blueprint and should be used only like ${chalk.yellow('jhipster --blueprints native')}`);
    }

    // Cache provider and enableHibernateCache are known to fail. Set default values to no/false.
    if (!this.options.jhipsterContext.config.existed && !this.options.jhipsterContext.config.get('reactive')) {
      this.config.set({
        cacheProvider: 'no',
        enableHibernateCache: false,
      });
    }

    if (this.options.cacheProvider !== undefined) {
      this.jhipsterConfig.cacheProvider = this.options.cacheProvider;
    }

    if (this.options.enableHibernateCache !== undefined) {
      this.jhipsterConfig.enableHibernateCache = this.options.enableHibernateCache;
    }

    this.sbsBlueprint = true;
  }

  [`${PRIORITY_PREFIX}task`]() {}
}
