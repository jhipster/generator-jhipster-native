import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';

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
            mysql: [
              {
                condition: ctx => ctx.prodDatabaseTypeMysql,
                transform: false,
                templates: ['src/main/resources/META-INF/native-image/mysql/reflect-config.json'],
              },
            ],
          },
          context: application,
        });
      },
    });
  }
}
