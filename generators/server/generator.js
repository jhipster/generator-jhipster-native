import { extname } from 'node:path';
import { passthrough } from '@yeoman/transform';
import { isFileStateDeleted, isFileStateModified } from 'mem-fs-editor/state';
import chalk from 'chalk';
import ServerGenerator from 'generator-jhipster/generators/server';
import { javaMainPackageTemplatesBlock, addJavaAnnotation } from 'generator-jhipster/generators/java/support';

import { NATIVE_BUILDTOOLS_VERSION } from '../../lib/constants.js';
import { mavenDefinition } from './support/maven-definition.js';

export default class extends ServerGenerator {
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
            if (/@(MockBean|SpyBean)/.test(contents)) {
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
        await this.writeFiles({
          sections: {
            common: [
              {
                transform: false,
                templates: ['src/main/resources/META-INF/native-image/common/reflect-config.json'],
              },
            ],
            config: [
              {
                ...javaMainPackageTemplatesBlock(),
                condition: ctx => !ctx.reactive,
                templates: ['config/JacksonNativeConfiguration.java'],
              },
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
                templates: [
                  'src/main/resources/META-INF/native-image/liquibase/reflect-config.json',
                  'src/main/resources/META-INF/native-image/liquibase/resource-config.json',
                ],
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
      async packageJson({ application: { buildToolMaven, buildToolGradle } }) {
        this.packageJson.merge({
          scripts: {
            'native-e2e': 'concurrently -k -s first "npm run native-start" "npm run e2e:headless"',
            'prenative-start': 'npm run docker:db:await --if-present && npm run docker:others:await --if-present',
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

        source.addGradlePlugin({ id: 'org.graalvm.buildtools.native', version: NATIVE_BUILDTOOLS_VERSION });
        if (!reactive) {
          source.addGradleProperty({ property: 'hibernateVersion', value: springBootDependencies['hibernate'] });
          // eslint-disable-next-line no-template-curly-in-string
          source.addGradlePlugin({ id: 'org.hibernate.orm', version: '${hibernateVersion}' });
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
          this.editFile('pom.xml', { assertModified: true }, content => {
            console.log(content);
            return content.replace(
              `
        <dependency>
            <groupId>io.netty</groupId>
            <artifactId>netty-tcnative-boringssl-static</artifactId>
            <scope>runtime</scope>
        </dependency>`,
              '',
            );
          });
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

      async logoutResource({ application: { srcMainJava, packageFolder, authenticationTypeOauth2, reactive } }) {
        if (!authenticationTypeOauth2) return;
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
          this.editFile(
            `${srcMainJava}${packageFolder}/repository/UserRepository.java`,
            { assertModified: true },
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

      cypress({ application: { srcTestJavascript, cypressTests } }) {
        if (!cypressTests) return;
        this.editFile(`${srcTestJavascript}/cypress/e2e/administration/administration.cy.ts`, { assertModified: true }, contents =>
          contents
            .replace("describe('/metrics'", "describe.skip('/metrics'")
            .replace("describe('/logs'", "describe.skip('/logs'")
            .replace("describe('/configuration'", "describe.skip('/configuration'"),
        );
      },

      restErrors({ application: { javaPackageSrcDir } }) {
        this.editFile(`${javaPackageSrcDir}/web/rest/errors/FieldErrorVM.java`, { assertModified: true }, contents =>
          contents.includes('@RegisterReflectionForBinding')
            ? contents
            : contents.replace(
                'public class FieldErrorVM implements Serializable {',
                `import org.springframework.aot.hint.annotation.RegisterReflectionForBinding;

              @RegisterReflectionForBinding({ FieldErrorVM.class })
              public class FieldErrorVM implements Serializable {`,
              ),
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

      reactiveJwtTestAdjust({ application: { reactive, javaPackageTestDir, generateUserManagement, packageName } }) {
        if (reactive && generateUserManagement) {
          this.editFile(`${javaPackageTestDir}security/jwt/AuthenticationIntegrationTest.java`, { assertModified: true }, content =>
            content.replace(/@Import\(\n {4}{\n/, `$0        ${packageName}.security.DomainUserDetailsService.class,\n`),
          );
        }
      },

      keycloak({ application }) {
        if (!application.authenticationTypeOauth2) return;

        // Increase wait for macos.
        this.editFile('src/main/docker/keycloak.yml', { assertModified: true }, content =>
          content.replace('start_period: 10s', 'start_period: 30s').replace('retries: 20', 'retries: 40'),
        );
      },

      readme() {
        this.editFile('README.md', { assertModified: true }, content =>
          content.includes('## About Native Build')
            ? content
            : content.replace(
                /^(# .+?)(## .+)$/ms,
                `$1
The project has also been extended with [JHipster Native](https://github.com/jhipster/generator-jhipster-native) Blueprint.
See what's been added here to learn [About Native Build](#about-native-build).

$2

## About Native Build

### Installation

To build a Native image, you need to install a JDK that is compatible with GraalVM. Please refer to the [GraalVM Release Notes](https://www.graalvm.org/release-notes/) and install the appropriate JDK. Using SDKMAN simplifies the installation process.
\`\`\`
sdk install java 21-graalce
\`\`\`
### How to Build a Native Image

To build a native image, execute the following command:
\`\`\`bash
npm run native-package
\`\`\`

After that, set up peripheral services like PostgreSQL using \`npm run services:up\` and ensure everything is ready.

Lastly, run the Native image and experience its fast startup 😊.
\`\`\`bash
npm run native-start
\`\`\`

If you've enabled e2e testing with Cypress, you can verify its operation using the following command:
\`\`\`bash
npm run native-e2e
\`\`\`
`,
              ),
        );
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
          this.editFile(
            `${srcMainJava}/${entity.entityAbsoluteFolder}/web/rest/${entity.entityClass}Resource.java`,
            { assertModified: true },
            content =>
              content
                .replaceAll(
                  `@PathVariable(value = "${entity.primaryKey.name}", required = false) final ${entity.primaryKey.type} ${entity.primaryKey.name}`,
                  `@PathVariable(name = "${entity.primaryKey.name}", value = "${entity.primaryKey.name}", required = false) final ${entity.primaryKey.type} ${entity.primaryKey.name}`,
                )
                .replaceAll(
                  `@PathVariable ${entity.primaryKey.type} ${entity.primaryKey.name}`,
                  `@PathVariable("${entity.primaryKey.name}") ${entity.primaryKey.type} ${entity.primaryKey.name}`,
                ),
          );

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
          this.editFile(entityClassFilePath, content =>
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
