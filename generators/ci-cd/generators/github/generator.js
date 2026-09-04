import { RECOMMENDED_NODE_VERSION } from 'generator-jhipster';
import CiCdGenerator from 'generator-jhipster/generators/base-application';

// GraalVM CE releases are only published for the current JDK. Releases before 25.3 (JDK 25.0.2 and older) fail to set
// boolean fields through MethodHandles in native images, which breaks Spring Data R2DBC entity reads
// (https://github.com/oracle/graal/issues/12596).
const GRAALVM_VERSION = '25.3';
const GRAALVM_JAVA_VERSION = '25';

const githubActions = {
  'actions/checkout': 'actions/checkout@v4',
  'actions/cache': 'actions/cache@v4',
  'actions/upload-artifact': 'actions/upload-artifact@v4',
  'graalvm/setup-graalvm': 'graalvm/setup-graalvm@v1',
  'actions/setup-node': 'actions/setup-node@v4',
};

export default class extends CiCdGenerator {
  constructor(args, opts, features) {
    super(args, opts, { ...features, sbsBlueprint: true, checkBlueprint: true });
  }

  get [CiCdGenerator.WRITING]() {
    return {
      async writingTemplateTask({ application }) {
        if (!application.ciCdGithub) return;
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
            ...(this.useVersionPlaceholders
              ? {
                  RECOMMENDED_NODE_VERSION: 'RECOMMENDED_NODE_VERSION',
                  GRAALVM_VERSION: 'GRAALVM_VERSION',
                  GRAALVM_JAVA_VERSION: 'GRAALVM_JAVA_VERSION',
                }
              : { RECOMMENDED_NODE_VERSION, GRAALVM_VERSION, GRAALVM_JAVA_VERSION }),
            githubActions,
          },
        });
      },
    };
  }
}
