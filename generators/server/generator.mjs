import chalk from 'chalk';
import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';
import { javaMainPackageTemplatesBlock } from 'generator-jhipster/generators/java/support';

import { JAVA_MAIN_SOURCES_DIR, TEMPLATES_JAVASCRIPT_TEST_DIR } from 'generator-jhipster';

export default class extends BaseApplicationGenerator {
  constructor(args, opts, features) {
    super(args, opts, features);

    if (this.options.help) return;

    if (!this.jhipsterContext) {
      throw new Error(`This is a JHipster blueprint and should be used only like ${chalk.yellow('jhipster --blueprints native')}`);
    }

    this.sbsBlueprint = true;
  }

  async _postConstruct() {
    await this.dependsOnJHipster('bootstrap-application');
  }

  get [BaseApplicationGenerator.POST_WRITING]() {
    return {
      async packageJson() {
        this.packageJson.merge({
          scripts: {
            'native-e2e': 'concurrently -k -s first "npm run native-start" "npm run e2e:headless"',
            'prenative-start': 'npm run docker:db:await --if-present && npm run docker:others:await --if-present',
          },
        });
      },

      async asyncConfiguration({ application: { authenticationTypeOauth2, packageFolder } }) {
        if (authenticationTypeOauth2) return;
        const asyncConfigurationPath = `${JAVA_MAIN_SOURCES_DIR}${packageFolder}/config/AsyncConfiguration.java`;
        this.editFile(asyncConfigurationPath, content =>
          content.replace(
            'return new ExceptionHandlingAsyncTaskExecutor(executor);',
            'executor.initialize();\nreturn new ExceptionHandlingAsyncTaskExecutor(executor);',
          ),
        );
      },
      async common() {
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/common/reflect-config.json',
          'src/main/resources/META-INF/native-image/common/reflect-config.json',
        );
      },

      async h2({ application: { devDatabaseTypeH2Any } }) {
        if (devDatabaseTypeH2Any) {
          await this.copyTemplate(
            'src/main/resources/META-INF/native-image/h2/reflect-config.json',
            'src/main/resources/META-INF/native-image/h2/reflect-config.json',
          );
        }
      },

      async hibernate() {
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/hibernate/reflect-config.json',
          'src/main/resources/META-INF/native-image/hibernate/reflect-config.json',
        );
      },

      async mysql({ application: { databaseTypeMysql } }) {
        if (databaseTypeMysql) {
          await this.copyTemplate(
            'src/main/resources/META-INF/native-image/mysql/reflect-config.json',
            'src/main/resources/META-INF/native-image/mysql/reflect-config.json',
          );
        }
      },

      async caffeine({ application: { authenticationTypeOauth2 } }) {
        if (authenticationTypeOauth2) {
          await this.copyTemplate(
            'src/main/resources/META-INF/native-image/caffeine/reflect-config.json',
            'src/main/resources/META-INF/native-image/caffeine/reflect-config.json',
          );
        }
      },

      async liquibase({ application: { databaseTypeSql } }) {
        if (!databaseTypeSql) return;
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/liquibase/reflect-config.json',
          'src/main/resources/META-INF/native-image/liquibase/reflect-config.json',
        );
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/liquibase/resource-config.json',
          'src/main/resources/META-INF/native-image/liquibase/resource-config.json',
        );
      },

      async logoutResource({ application: { packageFolder, authenticationTypeOauth2, reactive } }) {
        if (!authenticationTypeOauth2) return;
        const filePath = `${JAVA_MAIN_SOURCES_DIR}${packageFolder}/web/rest/LogoutResource.java`;

        this.editFile(filePath, content =>
          content
            .replace('@AuthenticationPrincipal(expression = "idToken") OidcIdToken idToken', '@AuthenticationPrincipal OidcUser oidcUser')
            .replace(
              'import org.springframework.security.oauth2.core.oidc.OidcIdToken;',
              `import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;`,
            )
            .replace('@param idToken the ID token.', '@param oidcUser the OIDC user.'),
        );
        if (reactive) {
          this.editFile(filePath, content => content.replace(', idToken)', ', oidcUser.getIdToken())'));
        } else {
          this.editFile(filePath, content => content.replace('(idToken.', `(oidcUser.getIdToken().`));
        }
      },

      userRepository({ application: { packageFolder, reactive, databaseTypeSql } }) {
        if (reactive && databaseTypeSql) {
          this.editFile(
            `${JAVA_MAIN_SOURCES_DIR}${packageFolder}/repository/UserRepository.java`,
            contents =>
              contents.replace(
                'import reactor.core.publisher.Flux;',
                `import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;`,
              ),
            contents =>
              contents.replace(
                '\nclass ',
                `
@Component
class `,
              ),
          );
        }
      },

      cypress({ application: { cypressTests } }) {
        if (!cypressTests) return;
        this.editFile(`${TEMPLATES_JAVASCRIPT_TEST_DIR}/cypress/e2e/administration/administration.cy.ts`, contents =>
          contents
            .replace("describe('/metrics'", "describe.skip('/metrics'")
            .replace("describe('/logs'", "describe.skip('/logs'")
            .replace("describe('/configuration'", "describe.skip('/configuration'"),
        );
      },
    };
  }

  get [BaseApplicationGenerator.POST_WRITING_ENTITIES]() {
    return this.asPostWritingTaskGroup({
      async entities({ application: { reactive, databaseTypeSql }, entities }) {
        for (const { name } of entities.filter(({ builtIn, embedded }) => !builtIn && !embedded)) {
          // Use entity from old location for more complete data.
          const entity = this.sharedData.getEntity(name);
          if (!entity) {
            this.log.warn(`Skipping entity generation, use '--with-entities' flag`);
            // eslint-disable-next-line no-continue
            continue;
          }
          this.editFile(`${JAVA_MAIN_SOURCES_DIR}/${entity.entityAbsoluteFolder}/web/rest/${entity.entityClass}Resource.java`, content =>
            content
              .replaceAll(
                `@PathVariable(value = "${entity.primaryKey.name}", required = false) final ${entity.primaryKey.type} ${entity.primaryKey.name}`,
                `@PathVariable(name = "${entity.primaryKey.name}", value = "${entity.primaryKey.name}", required = false) final ${entity.primaryKey.type} ${entity.primaryKey.name}`,
              )
              .replaceAll(
                `@PathVariable ${entity.primaryKey.type} ${entity.primaryKey.name}`,
                `@PathVariable("${entity.primaryKey.name}") ${entity.primaryKey.type} ${entity.primaryKey.name}`,
              )
              .replaceAll(
                `@RequestParam(required = false, defaultValue = "false") boolean eagerload`,
                `@RequestParam(name = "eagerload", required = false, defaultValue = "false") boolean eagerload`,
              )
              .replaceAll(
                `@RequestParam(required = false, defaultValue = "true") boolean eagerload`,
                `@RequestParam(name = "eagerload", required = false, defaultValue = "true") boolean eagerload`,
              ),
          );

          if (!reactive && databaseTypeSql && entity.containsBagRelationships) {
            this.editFile(
              `${JAVA_MAIN_SOURCES_DIR}${entity.entityAbsoluteFolder}/repository/${entity.entityClass}RepositoryWithBagRelationshipsImpl.java`,
              contents =>
                contents.replace(
                  'import org.springframework.beans.factory.annotation.Autowired;',
                  'import javax.persistence.PersistenceContext;',
                ),
              contents => contents.replace('@Autowired', '@PersistenceContext'),
            );
          }

          if (reactive && databaseTypeSql) {
            this.editFile(
              `${JAVA_MAIN_SOURCES_DIR}${entity.entityAbsoluteFolder}/repository/${entity.entityClass}RepositoryInternalImpl.java`,
              contents =>
                contents.replace(
                  'import reactor.core.publisher.Flux;',
                  `import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;`,
                ),
              contents =>
                contents.replace(
                  '\nclass ',
                  `
@Component
class `,
                ),
            );
          }
        }
      },
      async jsonFilter({ entities }) {
        // include user entity.
        const targetEntities = [...entities.filter(({ builtIn, embedded }) => !builtIn && !embedded), this.sharedData.getEntity('User')];
        for (const entity of targetEntities) {
          this.editFile(`${JAVA_MAIN_SOURCES_DIR}/${entity.entityAbsoluteFolder}/domain/${entity.entityClass}.java`, content =>
            content.includes('@JsonFilter("lazyPropertyFilter")')
              ? content
              : content
                  .replace('\npublic class ', '\n@JsonFilter("lazyPropertyFilter")\npublic class ')
                  .replace(/(package[\s\S]*?)(import)/, `$1import com.fasterxml.jackson.annotation.JsonFilter;$2`),
          );
        }
      },
    });
  }

  get [BaseApplicationGenerator.WRITING]() {
    return this.asWritingTaskGroup({
      async writingTemplateTask({ application }) {
        await this.writeFiles({
          sections: {
            config: [
              {
                ...javaMainPackageTemplatesBlock(),
                templates: ['config/JacksonNativeConfiguration.java'],
              },
            ],
          },
          context: application,
        });
      },
    });
  }

  get [BaseApplicationGenerator.END]() {
    return {
      async checkCompatibility({
        application: { reactive, databaseTypeNo, prodDatabaseTypePostgres, cacheProviderNo, enableHibernateCache, websocket, searchEngine },
      }) {
        if (!databaseTypeNo && !prodDatabaseTypePostgres) {
          this.log.warn('JHipster Native is only tested with PostgreSQL database');
        }
        if (searchEngine) {
          this.log.warn('JHipster Native is only tested without a search engine');
        }
        if (!reactive) {
          if (!cacheProviderNo) {
            this.log.warn('JHipster Native is only tested without a cache provider');
          }
          if (enableHibernateCache) {
            this.log.warn('JHipster Native is only tested without Hibernate second level cache');
          }
          if (websocket) {
            this.log.warn('JHipster Native is only tested without WebSocket support');
          }
        }
      },

      async endTemplateTask() {
        this.log.info(
          `You can see some tips about running Spring Boot with GraalVM at https://github.com/mraible/spring-native-examples#readme.`,
        );
      },
    };
  }

  editFile(filePath, ...transformCallbacks) {
    let content = this.readDestination(filePath);
    for (const cb of transformCallbacks) {
      content = cb(content);
    }
    this.writeDestination(filePath, content);
  }
}
