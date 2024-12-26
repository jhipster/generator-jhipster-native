import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import BaseGenerator from 'generator-jhipster/generators/base-application';
import { lt as semverLessThan } from 'semver';

export default class extends BaseGenerator {
  blueprintVersion;

  constructor(args, opts, features) {
    super(args, opts, { ...features, queueCommandTasks: true, checkBlueprint: true, sbsBlueprint: true });
  }

  async beforeQueue() {
    await this.dependsOnJHipster('bootstrap-application');
  }

  get [BaseGenerator.CONFIGURING]() {
    return this.asConfiguringTaskGroup({
      graalvm() {
        this.jhipsterConfig.graalvmSupport = true;
      },
      async setVersion() {
        this.blueprintVersion = this.blueprintStorage.get('version');
        const { version } = JSON.parse(await readFile(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'));
        this.blueprintStorage.set('version', version);
      },
    });
  }

  get [BaseGenerator.PREPARING]() {
    return this.asPreparingTaskGroup({
      fix({ application }) {
        application.languagesDefinition ??= undefined;
      },
    });
  }

  get [BaseGenerator.WRITING]() {
    return this.asWritingTaskGroup({
      async writingTemplateTask({ application, control }) {
        if (control.existingProject && (this.blueprintVersion === undefined || this.isBlueprintVersionLessThan('2.0.1'))) {
          if (application.databaseMigrationLiquibase) {
            this.removeFile('src/main/resources/META-INF/native-image/liquibase/resource-config.json');
          }
          if (application.authenticationTypeOauth2 || application.cacheProviderCaffeine) {
            this.removeFile('src/main/resources/META-INF/native-image/caffeine/reflect-config.json');
          }
          if (application.databaseTypeSql && !application.reactive) {
            this.removeFile('src/main/resources/META-INF/native-image/hibernate/proxy-config.json');
            this.removeFile('src/main/resources/META-INF/native-image/hibernate/reflect-config.json');
          }
        }

        if (control.existingProject && (this.blueprintVersion === undefined || this.isBlueprintVersionLessThan('2.1.1'))) {
          this.removeFile('src/main/resources/META-INF/native-image/common/reflect-config.json');
        }

        if (control.existingProject && (this.blueprintVersion === undefined || this.isBlueprintVersionLessThan('2.4.1'))) {
          this.removeFile('src/main/resources/META-INF/native-image/h2/reflect-config.json');
        }

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

  get [BaseGenerator.END]() {
    return this.asEndTaskGroup({
      async checkCompatibility({
        application: {
          reactive,
          databaseTypeNo,
          prodDatabaseTypePostgresql,
          cacheProviderNo,
          enableHibernateCache,
          communicationSpringWebsocket,
          searchEngineAny,
        },
      }) {
        if (!databaseTypeNo && !prodDatabaseTypePostgresql) {
          this.log.warn('JHipster Native is only tested with PostgreSQL database');
        }
        if (searchEngineAny) {
          this.log.warn('JHipster Native is only tested without a search engine');
        }
        if (!reactive) {
          if (!cacheProviderNo) {
            this.log.warn('JHipster Native is only tested without a cache provider');
          }
          if (enableHibernateCache) {
            this.log.warn('JHipster Native is only tested without Hibernate second level cache');
          }
          if (communicationSpringWebsocket) {
            this.log.warn('JHipster Native is only tested without WebSocket support');
          }
        }
      },

      async endTemplateTask() {
        this.log.info(
          `You can see some tips about running Spring Boot with GraalVM at https://github.com/mraible/spring-native-examples#readme.`,
        );
      },
    });
  }

  isBlueprintVersionLessThan(version) {
    return this.blueprintVersion ? semverLessThan(this.blueprintVersion, version) : false;
  }
}
