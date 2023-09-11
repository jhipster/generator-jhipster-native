import chalk from 'chalk';
import CiCdGenerator from 'generator-jhipster/generators/base-application';
import { RECOMMENDED_NODE_VERSION, RECOMMENDED_JAVA_VERSION } from 'generator-jhipster';
import { GRAALVM_VERSION } from '../../lib/constants.mjs';

const githubActions = {
  'actions/checkout': 'actions/checkout@v3',
  'actions/cache': 'actions/cache@v3',
  'actions/upload-artifact': 'actions/upload-artifact@v3',
  'graalvm/setup-graalvm': 'graalvm/setup-graalvm@v1',
  'actions/setup-node': 'actions/setup-node@v3',
};

export default class extends CiCdGenerator {
  constructor(args, opts, features) {
    super(args, opts, { ...features, sbsBlueprint: true });

    if (this.options.help) return;

    if (!this.jhipsterContext) {
      throw new Error(`This is a JHipster blueprint and should be used only like ${chalk.yellow('jhipster --blueprints native')}`);
    }
  }

  async _postConstruct() {
    await this.dependsOnJHipster('bootstrap-application');
  }

  get [CiCdGenerator.WRITING]() {
    return {
      async writingTemplateTask({ application }) {
        if (this.jhipsterContext.pipeline !== 'github') return;
        await this.writeFiles({
          sections: {
            files: [
              {
                templates: [
                  { file: 'github-native.yml', renameTo: '.github/workflows/native.yml' },
                  { file: 'github-artifact.yml', renameTo: '.github/workflows/native-artifact.yml' },
                ],
              },
            ],
          },
          context: {
            ...application,
            RECOMMENDED_NODE_VERSION,
            RECOMMENDED_JAVA_VERSION,
            GRAALVM_VERSION,
            githubActions,
          },
        });
      },
    };
  }
}
