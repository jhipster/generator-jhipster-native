import { extname } from 'node:path';
import { passthrough } from '@yeoman/transform';
import { isFileStateDeleted, isFileStateModified } from 'mem-fs-editor/state';
import ServerGenerator from 'generator-jhipster/generators/server';
import { javaMainPackageTemplatesBlock, addJavaAnnotation } from 'generator-jhipster/generators/java/support';

import { NATIVE_BUILDTOOLS_VERSION } from '../../lib/constants.js';
import { mavenDefinition } from './support/index.js';

export default class extends ServerGenerator {
  constructor(args, opts, features) {
    super(args, opts, { ...features, checkBlueprint: true, sbsBlueprint: true });
  }

  async beforeQueue() {
    await this.dependsOnJHipster('bootstrap-application');
  }

  get [ServerGenerator.DEFAULT]() {
    return this.asDefaultTaskGroup({
      // workaround for https://github.com/spring-projects/spring-boot/issues/32195
      async disabledInAotModeAnnotation({ application }) {
        this.queueTransformStream(
          {
            name: 'adding @DisabledInAotMode annotations',
            filter: file =>
              !isFileStateDeleted(file) &&
              isFileStateModified(file) &&
              file.path.startsWith(this.destinationPath(application.srcTestJava)) &&
              extname(file.path) === '.java',
            refresh: false,
          },
          passthrough(file => {
            const contents = file.contents.toString('utf8');
            if (/@(MockBean|SpyBean)/.test(contents) || (application.reactive && /@AuthenticationIntegrationTest/.test(contents))) {
              file.contents = Buffer.from(
                addJavaAnnotation(contents, { package: 'org.springframework.test.context.aot', annotation: 'DisabledInAotMode' }),
              );
            }
          }),
        );
      },
    });
  }

  get [ServerGenerator.WRITING]() {
    return this.asWritingTaskGroup({
      async writingTemplateTask({ application }) {
        this.removeFile('src/main/resources/META-INF/native-image/liquibase/resource-config.json');

        await this.writeFiles({
          sections: {
            common: [
              { templates: ['README.md.jhi.native'] },
              {
                transform: false,
                templates: ['src/main/resources/META-INF/native-image/common/reflect-config.json'],
              },
            ],
            config: [
              javaMainPackageTemplatesBlock({
                condition: ctx => !ctx.reactive,
                templates: ['config/JacksonNativeConfiguration.java'],
              }),
              javaMainPackageTemplatesBlock({
                templates: ['config/NativeConfiguration.java'],
              }),
            ],
            gradle: [
              {
                condition: ctx => ctx.buildToolGradle,
                templates: ['gradle/native.gradle'],
              },
            ],
            liquibase: [
              {
                condition: ctx => ctx.databaseTypeSql,
                transform: false,
                templates: ['src/main/resources/META-INF/native-image/liquibase/reflect-config.json'],
              },
            ],
            hibernate: [
              {
                condition: ctx => ctx.databaseTypeSql && !ctx.reactive,
                transform: false,
                templates: [
                  'src/main/resources/META-INF/native-image/hibernate/proxy-config.json',
                  'src/main/resources/META-INF/native-image/hibernate/reflect-config.json',
                ],
              },
            ],
            h2: [
              {
                condition: ctx => ctx.devDatabaseTypeH2Any,
                transform: false,
                templates: ['src/main/resources/META-INF/native-image/h2/reflect-config.json'],
              },
            ],
            mysql: [
              {
                condition: ctx => ctx.prodDatabaseTypeMysql,
                transform: false,
                templates: ['src/main/resources/META-INF/native-image/mysql/reflect-config.json'],
              },
            ],
            caffeine: [
              {
                condition: ctx => ctx.authenticationTypeOauth2 || ctx.cacheProviderCaffeine,
                transform: false,
                templates: ['src/main/resources/META-INF/native-image/caffeine/reflect-config.json'],
              },
            ],
          },
          context: application,
        });
      },
    });
  }

  get [ServerGenerator.POST_WRITING]() {
    return this.asPostWritingTaskGroup({
      hints({ application: { mainClass, javaPackageSrcDir, packageName } }) {
        this.editFile(`${javaPackageSrcDir}${mainClass}.java`, { assertModified: true }, contents =>
          addJavaAnnotation(contents, { package: 'org.springframework.context.annotation', annotation: 'ImportRuntimeHints' }).replaceAll(
            '@ImportRuntimeHints\n',
            `@ImportRuntimeHints({ ${packageName}.config.NativeConfiguration.JHipsterNativeRuntimeHints.class })\n`,
          ),
        );
      },

      async packageJson({ application: { buildToolMaven, buildToolGradle } }) {
        this.packageJson.merge({
          scripts: {
            'native-e2e': 'concurrently -k -s first "npm run native-start" "npm run e2e:headless"',
            'prenative-start': 'npm run services:up',
          },
        });
        if (buildToolMaven) {
          this.packageJson.merge({
            scripts: {
              'native-package': './mvnw package -B -ntp -Pnative,prod -DskipTests',
              'native-start': './target/native-executable',
            },
          });
        } else if (buildToolGradle) {
          this.packageJson.merge({
            scripts: {
              'native-package': './gradlew nativeCompile -Pprod -x test -x integrationTest',
              'native-start': './build/native/nativeCompile/native-executable',
            },
          });
        }
      },

      async customizeGradle({ application: { buildToolGradle, reactive, springBootDependencies }, source }) {
        if (!buildToolGradle) return;

        source.addGradleDependencyCatalogPlugin({
          addToBuild: true,
          pluginName: 'graalvm',
          id: 'org.graalvm.buildtools.native',
          version: NATIVE_BUILDTOOLS_VERSION,
        });

        if (!reactive) {
          source.addGradleDependencyCatalogVersion({ name: 'hibernate', version: springBootDependencies.hibernate });
          source.addGradleDependencyCatalogPlugin({
            addToBuild: true,
            pluginName: 'hibernate',
            id: 'org.hibernate.orm',
            'version.ref': 'hibernate',
          });
        }

        source.applyFromGradle({ script: 'gradle/native.gradle' });

        if (reactive) {
          this.editFile('build.gradle', { assertModified: true }, content =>
            content.replace('runtimeOnly "io.netty:netty-tcnative-boringssl-static"', ''),
          );
        }
      },

      async customizeMaven({ application: { buildToolMaven, reactive }, source }) {
        if (!buildToolMaven) return;

        source.addMavenDefinition(mavenDefinition({ reactive }));

        if (reactive) {
          this.editFile('pom.xml', { assertModified: true }, content =>
            content.replace(
              `
        <dependency>
            <groupId>io.netty</groupId>
            <artifactId>netty-tcnative-boringssl-static</artifactId>
            <scope>runtime</scope>
        </dependency>`,
              '',
            ),
          );
        }
      },

      async asyncConfiguration({ application: { authenticationTypeOauth2, srcMainJava, packageFolder } }) {
        if (authenticationTypeOauth2) return;
        const asyncConfigurationPath = `${srcMainJava}${packageFolder}/config/AsyncConfiguration.java`;
        this.editFile(asyncConfigurationPath, { assertModified: true }, content =>
          content.replace(
            'return new ExceptionHandlingAsyncTaskExecutor(executor);',
            'executor.initialize();\nreturn new ExceptionHandlingAsyncTaskExecutor(executor);',
          ),
        );
      },

      async logoutResource({ application: { srcMainJava, packageFolder, authenticationTypeOauth2, reactive, generateAuthenticationApi } }) {
        if (!authenticationTypeOauth2 || !generateAuthenticationApi) return;
        const filePath = `${srcMainJava}${packageFolder}/web/rest/LogoutResource.java`;

        this.editFile(filePath, { assertModified: true }, content =>
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
          this.editFile(filePath, { assertModified: true }, content => content.replace(', idToken)', ', oidcUser.getIdToken())'));
        } else {
          this.editFile(filePath, { assertModified: true }, content => content.replace('(idToken.', `(oidcUser.getIdToken().`));
        }
      },

      userRepository({ application: { srcMainJava, packageFolder, reactive, databaseTypeSql, generateBuiltInUserEntity } }) {
        if (reactive && databaseTypeSql && generateBuiltInUserEntity) {
          this.editFile(`${srcMainJava}${packageFolder}/repository/UserRepository.java`, { assertModified: true }, contents =>
            addJavaAnnotation(contents, { package: 'org.springframework.stereotype', annotation: 'Component' }),
          );
        }
      },

      cypress({ application: { srcTestJavascript, cypressTests } }) {
        if (!cypressTests) return;
        this.editFile(`${srcTestJavascript}/cypress/e2e/administration/administration.cy.ts`, { assertModified: true }, contents =>
          contents
            .replace("describe('/metrics'", "describe.skip('/metrics'")
            .replace("describe('/logs'", "describe.skip('/logs'")
            .replace("describe('/configuration'", "describe.skip('/configuration'"),
        );
      },

      // workaround for arch error in backend:unit:test caused by gradle's org.graalvm.buildtools.native plugin
      technicalStructureTest({ application: { buildToolGradle, javaPackageTestDir } }) {
        if (!buildToolGradle) return;
        this.editFile(`${javaPackageTestDir}/TechnicalStructureTest.java`, { assertModified: true }, contents =>
          contents.includes('__BeanFactoryRegistrations')
            ? contents
            : contents
                .replace(
                  'import static com.tngtech.archunit.core.domain.JavaClass.Predicates.belongToAnyOf;',
                  `import static com.tngtech.archunit.core.domain.JavaClass.Predicates.belongToAnyOf;
                  import static com.tngtech.archunit.core.domain.JavaClass.Predicates.simpleNameEndingWith;`,
                )
                .replace(
                  '.ignoreDependency(belongToAnyOf',
                  `.ignoreDependency(simpleNameEndingWith("_BeanFactoryRegistrations"), alwaysTrue())
        .ignoreDependency(belongToAnyOf`,
                ),
        );
      },

      keycloak({ application }) {
        if (!application.authenticationTypeOauth2) return;

        // Increase wait for macos. Keyclock container start can take over 3 min. 4 min is not enough to download/start containers/start server.
        this.editFile('src/main/docker/keycloak.yml', { assertModified: true }, content =>
          content.replace('start_period: 10s', 'start_period: 30s').replace('retries: 20', 'retries: 60'),
        );

        const awaitScript = this.packageJson.getPath('scripts.ci:server:await');
        if (awaitScript) {
          this.packageJson.merge({
            scripts: {
              'ci:server:await': awaitScript.replaceAll('180', '360'),
            },
          });
        }
      },
    });
  }

  get [ServerGenerator.POST_WRITING_ENTITIES]() {
    return this.asPostWritingEntitiesTaskGroup({
      async entities({ application: { srcMainJava, reactive, databaseTypeSql }, entities }) {
        for (const entity of entities.filter(({ builtIn, embedded }) => !builtIn && !embedded)) {
          if (!entity) {
            this.log.warn(`Skipping entity generation, use '--with-entities' flag`);
            continue;
          }

          if (reactive && databaseTypeSql) {
            this.editFile(
              `${srcMainJava}${entity.entityAbsoluteFolder}/repository/${entity.entityClass}RepositoryInternalImpl.java`,
              { assertModified: true },
              contents => addJavaAnnotation(contents, { package: 'org.springframework.stereotype', annotation: 'Component' }),
            );
          }
        }
      },
      async jsonFilter({ application, entities }) {
        if (application.reactive) return;
        for (const entity of entities.filter(({ builtIn, builtInUser, embedded }) => builtInUser || (!builtIn && !embedded))) {
          const entityClassFilePath = `${application.srcMainJava}/${entity.entityAbsoluteFolder}/domain/${entity.entityClass}.java`;
          this.editFile(entityClassFilePath, { assertModified: true }, content =>
            addJavaAnnotation(content, { package: 'com.fasterxml.jackson.annotation', annotation: 'JsonFilter' }).replace(
              '@JsonFilter\n',
              '@JsonFilter("lazyPropertyFilter")\n',
            ),
          );
        }
      },
    });
  }

  get [ServerGenerator.END]() {
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
}
