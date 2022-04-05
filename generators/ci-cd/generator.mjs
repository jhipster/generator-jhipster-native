import chalk from 'chalk';
import CiCdGenerator from 'generator-jhipster/esm/generators/ci-cd';
import { constants } from 'generator-jhipster';
import { PRIORITY_PREFIX, WRITING_PRIORITY } from 'generator-jhipster/esm/priorities';
import { GRAALVM_VERSION } from '../../lib/constants.mjs';

const { NODE_VERSION, JAVA_VERSION } = constants;

const githubActions = {
  'actions/checkout': 'actions/checkout@v3',
  'actions/cache': 'actions/cache@v3',
  'actions/upload-artifact': 'actions/upload-artifact@v3',
  'graalvm/setup-graalvm': 'graalvm/setup-graalvm@v1',
  'actions/setup-node': 'actions/setup-node@v3',
};

export default class extends CiCdGenerator {
  constructor(args, opts, features) {
    super(args, opts, { priorityArgs: true, taskPrefix: PRIORITY_PREFIX, ...features });

    if (this.options.help) return;

    if (!this.options.jhipsterContext) {
      throw new Error(`This is a JHipster blueprint and should be used only like ${chalk.yellow('jhipster --blueprints native')}`);
    }

    this.sbsBlueprint = true;
  }

  async _postConstruct() {
    await this.dependsOnJHipster('bootstrap-application');
  }

  get [WRITING_PRIORITY]() {
    return {
      async writingTemplateTask({ application }) {
        if (this.options.jhipsterContext.pipeline !== 'github') return;
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
            NODE_VERSION,
            JAVA_VERSION,
            GRAALVM_VERSION,
            githubActions,
          },
        });
      },
    };
  }
}
