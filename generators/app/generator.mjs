import chalk from 'chalk';
import { GeneratorBaseEntities } from 'generator-jhipster';
import { PRIORITY_PREFIX } from 'generator-jhipster/esm/priorities';

export default class extends GeneratorBaseEntities {
  constructor(args, opts, features) {
    super(args, opts, { taskPrefix: PRIORITY_PREFIX, ...features });

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

    this.sbsBlueprint = true;
  }

  [`${PRIORITY_PREFIX}task`]() {}
}
