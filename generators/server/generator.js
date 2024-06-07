import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname } from 'node:path';
import { passthrough } from '@yeoman/transform';
import { isFileStateDeleted, isFileStateModified } from 'mem-fs-editor/state';
import ServerGenerator from 'generator-jhipster/generators/base-application';
import { javaMainPackageTemplatesBlock, addJavaAnnotation, addJavaImport } from 'generator-jhipster/generators/java/support';
import { lt as semverLessThan } from 'semver';

import { NATIVE_BUILDTOOLS_VERSION } from '../../lib/constants.js';
import { mavenDefinition } from './support/index.js';
import { createNeedleCallback } from 'generator-jhipster/generators/base/support';

export default class extends ServerGenerator {
  blueprintVersion;

  constructor(args, opts, features) {
    super(args, opts, { ...features, checkBlueprint: true, sbsBlueprint: true });
  }

  async beforeQueue() {
    await this.dependsOnJHipster('bootstrap-application');
  }

  get [ServerGenerator.CONFIGURING]() {
    return this.asConfiguringTaskGroup({
      async setVersion() {
        this.blueprintVersion = this.blueprintStorage.get('version');
        const { version } = JSON.parse(await readFile(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'));
        this.blueprintStorage.set('version', version);
      },
    });
  }

  get [ServerGenerator.PREPARING]() {
    return this.asPreparingTaskGroup({
      addNativeHint({ source, application }) {
        source.addNativeHint = ({ publicConstructors = [], declaredConstructors = [] }) => {
          this.editFile(
            `${application.javaPackageSrcDir}config/NativeConfiguration.java`,
            addJavaImport('org.springframework.aot.hint.MemberCategory'),
            createNeedleCallback({
              contentToAdd: [
                ...publicConstructors.map(
                  classPath =>
                    `hints.reflection().registerType(${classPath}, (hint) -> hint.withMembers(MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS));`,
                ),
                ...declaredConstructors.map(
                  classPath =>
                    `hints.reflection().registerType(${classPath}, (hint) -> hint.withMembers(MemberCategory.INVOKE_DECLARED_CONSTRUCTORS));`,
                ),
              ],
              needle: 'add-native-hints',
              ignoreWhitespaces: true,
            }),
          );
        };
      },
    });
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
          },
          context: application,
        });
      },
    });
  }

  get [ServerGenerator.POST_WRITING]() {
    return this.asPostWritingTaskGroup({
      hints({ application, source }) {
        const { mainClass, javaPackageSrcDir, packageName } = application;

        this.editFile(`${javaPackageSrcDir}${mainClass}.java`, { assertModified: true }, contents =>
          addJavaAnnotation(contents, {
            package: 'org.springframework.context.annotation',
            annotation: 'ImportRuntimeHints',
            parameters: () => `{ ${packageName}.config.NativeConfiguration.JHipsterNativeRuntimeHints.class }`,
          }),
        );

        if (application.databaseMigrationLiquibase) {
          // Latest liquibase version supported by Reachability Repository is 4.23.0
          // Hints may be dropped if newer version is supported
          // https://github.com/oracle/graalvm-reachability-metadata/blob/master/metadata/org.liquibase/liquibase-core/index.json
          source.addNativeHint({
            publicConstructors: ['liquibase.ui.LoggerUIService.class'],
            declaredConstructors: [
              'liquibase.database.LiquibaseTableNamesFactory.class',
              'liquibase.report.ShowSummaryGeneratorFactory.class',
            ],
          });
        }

        if (application.databaseTypeSql && !application.reactive) {
          // Latest hibernate-core version supported by Reachability Repository is 6.5.0.Final
          // Hints may be dropped if newer version is supported
          // https://github.com/oracle/graalvm-reachability-metadata/blob/master/metadata/org.hibernate.orm/hibernate-core/index.json
          source.addNativeHint({
            publicConstructors: ['org.hibernate.binder.internal.BatchSizeBinder.class'],
          });
        }
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

      restErrors({ application: { javaPackageSrcDir } }) {
        this.editFile(`${javaPackageSrcDir}/web/rest/errors/FieldErrorVM.java`, { assertModified: true }, contents =>
          addJavaAnnotation(contents, {
            package: 'org.springframework.aot.hint.annotation',
            annotation: 'RegisterReflectionForBinding',
            parameters: () => '{ FieldErrorVM.class }',
          }),
        );
      },

      // workaround for arch error in backend:unit:test caused by gradle's org.graalvm.buildtools.native plugin
      technicalStructureTest({ application: { buildToolGradle, javaPackageTestDir } }) {
        if (!buildToolGradle) return;
        this.editFile(
          `${javaPackageTestDir}/TechnicalStructureTest.java`,
          { assertModified: true },
          addJavaImport('com.tngtech.archunit.core.domain.JavaClass.Predicates.simpleNameEndingWith', { staticImport: true }),
          contents =>
            contents.includes('__BeanFactoryRegistrations')
              ? contents
              : contents.replace(
                  '.ignoreDependency(belongToAnyOf',
                  `.ignoreDependency(simpleNameEndingWith("_BeanFactoryRegistrations"), alwaysTrue())
        .ignoreDependency(belongToAnyOf`,
                ),
        );
      },

      keycloak({ application }) {
        if (!application.authenticationTypeOauth2) return;

        // Increase wait for macOS. Keyclock container start can take over 3 min. 4 min is not enough to download/start containers/start server.
        this.editFile('src/main/docker/keycloak.yml', { assertModified: true }, content => content.replace('retries: 20', 'retries: 100'));

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
      async jsonFilter({ application, entities }) {
        if (application.reactive) return;
        for (const entity of entities.filter(({ builtIn, builtInUser, embedded }) => builtInUser || (!builtIn && !embedded))) {
          const entityClassFilePath = `${application.srcMainJava}/${entity.entityAbsoluteFolder}/domain/${entity.entityClass}.java`;
          this.editFile(entityClassFilePath, { assertModified: true }, content =>
            addJavaAnnotation(content, {
              package: 'com.fasterxml.jackson.annotation',
              annotation: 'JsonFilter',
              parameters: () => '"lazyPropertyFilter"',
            }),
          );
        }
      },
    });
  }

  get [ServerGenerator.END]() {
    return {
      async checkCompatibility({
        application: {
          reactive,
          databaseTypeNo,
          prodDatabaseTypePostgres,
          cacheProviderNo,
          enableHibernateCache,
          websocket,
          searchEngineAny,
        },
      }) {
        if (!databaseTypeNo && !prodDatabaseTypePostgres) {
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
          if (websocket && websocket !== 'no') {
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

  isBlueprintVersionLessThan(version) {
    return this.blueprintVersion ? semverLessThan(this.blueprintVersion, version) : false;
  }
}
