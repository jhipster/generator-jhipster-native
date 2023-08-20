import chalk from 'chalk';
import AppGenerator from 'generator-jhipster/generators/app';

export default class extends AppGenerator {
  constructor(args, opts, features) {
    super(args, opts, features);

    this.option('cache-provider', {
      desc: 'Cache provider',
      type: String,
    });

    this.option('enable-hibernate-cache', {
      desc: 'Enable hibernate cache',
      type: Boolean,
    });

    if (this.options.help) return;

    if (!this.jhipsterContext) {
      throw new Error(`This is a JHipster blueprint and should be used only like ${chalk.yellow('jhipster --blueprints native')}`);
    }

    // Cache provider and enableHibernateCache are known to fail. Set default values to no/false.
    if (!this.jhipsterContext.config.existed && !this.jhipsterContext.config.get('reactive')) {
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

  // Temporary fix for 'Error: This Generator is empty. Add at least one method for it to run.'
  get [AppGenerator.WRITING]() {
  }
}
