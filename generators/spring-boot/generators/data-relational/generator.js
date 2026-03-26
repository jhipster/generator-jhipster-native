import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';
import { javaMainPackageTemplatesBlock } from 'generator-jhipster/generators/java/support';

export default class extends BaseApplicationGenerator {
  constructor(args, opts, features) {
    super(args, opts, {
      ...features,
      checkBlueprint: true,
      sbsBlueprint: true,
    });
  }

  async beforeQueue() {
    await this.dependsOnJHipster('spring-boot');
  }

  get [BaseApplicationGenerator.WRITING]() {
    return this.asWritingTaskGroup({
      async writingTemplateTask({ application }) {
        await this.writeFiles({
          sections: {
            graalvm: [
              javaMainPackageTemplatesBlock({
                condition: ctx => !ctx.reactive && ctx.graalvmSupport,
                templates: ['config/JacksonNativeConfiguration.java'],
              }),
            ],
          },
          context: application,
        });
      },
    });
  }
}
