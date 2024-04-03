import chalk from 'chalk';
import ServerGenerator from 'generator-jhipster/generators/server';
import { javaMainPackageTemplatesBlock } from 'generator-jhipster/generators/java/support';

import { NATIVE_BUILDTOOLS_VERSION, GRAALVM_VERSION } from '../../lib/constants.js';

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

      async customizeGradle({ application: { buildToolGradle, reactive }, source }) {
        if (!buildToolGradle) return;

        source.addGradlePlugin({ id: 'org.graalvm.buildtools.native', version: NATIVE_BUILDTOOLS_VERSION });
        if (!reactive) {
          // eslint-disable-next-line no-template-curly-in-string
          source.addGradlePlugin({ id: 'org.hibernate.orm', version: '${hibernateVersion}' });
        }

        source.applyFromGradle({ script: 'gradle/native.gradle' });

        this.editFile('build.gradle', content => content.replace('implementation "io.netty:netty-tcnative-boringssl-static"', ''));
      },

      async customizeMaven({ application: { buildToolMaven, reactive }, source }) {
        if (!buildToolMaven) return;

        source.addMavenProperty({ property: 'repackage.classifier' });
        source.addMavenProperty({ property: 'native-image-name', value: 'native-executable' });
        source.addMavenProperty({ property: 'native-build-args', value: '--verbose -J-Xmx10g' });

        source.addMavenProfile({
          id: 'native',
          content: `            <properties>
          <repackage.classifier>exec</repackage.classifier>
          <native-buildtools.version>${NATIVE_BUILDTOOLS_VERSION}</native-buildtools.version>
          <graalvm.version>${GRAALVM_VERSION}</graalvm.version>
        </properties>
        <dependencies>
            <dependency>
                <groupId>com.querydsl</groupId>
                <artifactId>querydsl-core</artifactId>
            </dependency>
        </dependencies>
        <build>
            <plugins>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-jar-plugin</artifactId>
                    <configuration>
                        <archive>
                            <manifestEntries>
                                <Spring-Boot-Native-Processed>true</Spring-Boot-Native-Processed>
                            </manifestEntries>
                        </archive>
                    </configuration>
                </plugin>
                <plugin>
                    <groupId>org.springframework.boot</groupId>
                    <artifactId>spring-boot-maven-plugin</artifactId>
                    <configuration>
                        <image>
                            <builder>paketobuildpacks/builder:tiny</builder>
                            <env>
                                <BP_NATIVE_IMAGE>true</BP_NATIVE_IMAGE>
                            </env>
                        </image>
                    </configuration>
                    <executions>
                        <execution>
                            <id>process-aot</id>
                            <goals>
                                <goal>process-aot</goal>
                            </goals>
                        </execution>
                    </executions>
                </plugin>
                <plugin>
                    <groupId>org.graalvm.buildtools</groupId>
                    <artifactId>native-maven-plugin</artifactId>
                    <version>\${native-buildtools.version}</version>
                    <executions>
                        <execution>
                            <id>add-reachability-metadata</id>
                            <goals>
                                <goal>add-reachability-metadata</goal>
                            </goals>
                        </execution>
                        <execution>
                            <id>build-native</id>
                            <goals>
                                <goal>build</goal>
                            </goals>
                            <phase>package</phase>
                        </execution>
                        <execution>
                            <id>test-native</id>
                            <goals>
                                <goal>test</goal>
                            </goals>
                            <phase>test</phase>
                        </execution>
                    </executions>
                    <configuration>
                        <classesDirectory>\${project.build.outputDirectory}</classesDirectory>
                        <metadataRepository>
                            <enabled>true</enabled>
                        </metadataRepository>
                        <requiredVersion>\${graalvm.version}</requiredVersion>
                        <imageName>\${native-image-name}</imageName>
                        <buildArgs>
                            <buildArg>--no-fallback \${native-build-args}</buildArg>
                        </buildArgs>
                    </configuration>
                </plugin>
            </plugins>
        </build>`,
        });
        source.addMavenProfile({
          id: 'nativeTest',
          content: `            <dependencies>
           <dependency>
               <groupId>org.junit.platform</groupId>
               <artifactId>junit-platform-launcher</artifactId>
               <scope>test</scope>
           </dependency>
       </dependencies>
       <build>
           <plugins>
               <plugin>
                   <groupId>org.springframework.boot</groupId>
                   <artifactId>spring-boot-maven-plugin</artifactId>
                   <executions>
                       <execution>
                           <id>process-test-aot</id>
                           <goals>
                               <goal>process-test-aot</goal>
                           </goals>
                       </execution>
                   </executions>
               </plugin>
               <plugin>
                   <groupId>org.graalvm.buildtools</groupId>
                   <artifactId>native-maven-plugin</artifactId>
                   <configuration>
                       <classesDirectory>\${project.build.outputDirectory}</classesDirectory>
                       <metadataRepository>
                           <enabled>true</enabled>
                       </metadataRepository>
                       <requiredVersion>22.3</requiredVersion>
                   </configuration>
                   <executions>
                       <execution>
                           <id>native-test</id>
                           <goals>
                               <goal>test</goal>
                           </goals>
                       </execution>
                   </executions>
               </plugin>
           </plugins>
       </build>`,
        });

        this.editFile('pom.xml', content =>
          content
            .replace(
              `
        <dependency>
            <groupId>io.netty</groupId>
            <artifactId>netty-tcnative-boringssl-static</artifactId>
            <scope>runtime</scope>
        </dependency>`,
              '',
            )
            // Add the GraalVM native-maven-plugin to the 'prod' profile
            .replace(
              /(<build>[\s\S]*?<pluginManagement>\s*<plugins>[\s\S]*?)(<\/plugins>\s*<\/pluginManagement>\s*<\/build>)/,
              `$1<plugin>
              <groupId>org.graalvm.buildtools</groupId>
              <artifactId>native-maven-plugin</artifactId>
          </plugin>$2`,
            )
            // Remove the modernizer-maven-plugin from the content
            .replace(/<plugin>\s*<groupId>org.gaul<\/groupId>\s*<artifactId>modernizer-maven-plugin<\/artifactId>[\s\S]*?<\/plugin>/g, ''),
        );

        if (!reactive) {
          this.editFile('pom.xml', content =>
            content
              // Add the hibernate-enhance-maven-plugin to the 'prod' profile
              .replace(
                /(<id>prod<\/id>[\s\S]*?<plugins>[\s\S]*?)(<\/plugins>)/,
                `$1<plugin>
              <groupId>org.hibernate.orm.tooling</groupId>
              <artifactId>hibernate-enhance-maven-plugin</artifactId>
              <version>\${hibernate.version}</version>
              <executions>
                  <execution>
                      <configuration>
                          <enableLazyInitialization>true</enableLazyInitialization>
                      </configuration>
                      <goals>
                          <goal>enhance</goal>
                      </goals>
                  </execution>
              </executions>
          </plugin>$2`,
              ),
          );
        }
      },

      async asyncConfiguration({ application: { authenticationTypeOauth2, srcMainJava, packageFolder } }) {
        if (authenticationTypeOauth2) return;
        const asyncConfigurationPath = `${srcMainJava}${packageFolder}/config/AsyncConfiguration.java`;
        this.editFile(asyncConfigurationPath, content =>
          content.replace(
            'return new ExceptionHandlingAsyncTaskExecutor(executor);',
            'executor.initialize();\nreturn new ExceptionHandlingAsyncTaskExecutor(executor);',
          ),
        );
      },

      async logoutResource({ application: { srcMainJava, packageFolder, authenticationTypeOauth2, reactive } }) {
        if (!authenticationTypeOauth2) return;
        const filePath = `${srcMainJava}${packageFolder}/web/rest/LogoutResource.java`;

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

      userRepository({ application: { srcMainJava, packageFolder, reactive, databaseTypeSql } }) {
        if (reactive && databaseTypeSql) {
          this.editFile(
            `${srcMainJava}${packageFolder}/repository/UserRepository.java`,
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
        this.editFile(`${srcTestJavascript}/cypress/e2e/administration/administration.cy.ts`, contents =>
          contents
            .replace("describe('/metrics'", "describe.skip('/metrics'")
            .replace("describe('/logs'", "describe.skip('/logs'")
            .replace("describe('/configuration'", "describe.skip('/configuration'"),
        );
      },

      restErrors({ application: { srcMainJava, packageFolder } }) {
        this.editFile(`${srcMainJava}${packageFolder}/web/rest/errors/FieldErrorVM.java`, contents =>
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

      testUtil({ application: { srcTestJava, packageFolder, packageName, reactive } }) {
        if (reactive) return;
        this.editFile(`${srcTestJava}${packageFolder}/web/rest/TestUtil.java`, contents =>
          contents.includes('JacksonNativeConfiguration')
            ? contents
            : contents
                .replace(
                  'import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;',
                  `import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
                  import ${packageName}.config.JacksonNativeConfiguration;
                  import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;`,
                )
                .replace(
                  'mapper.registerModule(new JavaTimeModule());',
                  `mapper.registerModule(new JavaTimeModule());
                  Jackson2ObjectMapperBuilder builder = new Jackson2ObjectMapperBuilder();
                new JacksonNativeConfiguration().customizeJackson().customize(builder);
                builder.configure(mapper);`,
                ),
        );
      },

      // workaround for arch error in backend:unit:test caused by gradle's org.graalvm.buildtools.native plugin
      technicalStructureTest({ application: { buildToolGradle, srcTestJava, packageFolder } }) {
        if (!buildToolGradle) return;
        this.editFile(`${srcTestJava}${packageFolder}/TechnicalStructureTest.java`, contents =>
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

        // Increase wait for macos.
        this.editFile('src/main/docker/keycloak.yml', content =>
          content.replace('start_period: 10s', 'start_period: 30s').replace('retries: 20', 'retries: 40'),
        );
      },

      // workaround for https://github.com/spring-projects/spring-boot/issues/32195
      disableMockBean({ application: { srcTestJava, packageFolder } }) {
        const targetClasses = [
          { packageSubFolder: 'security/jwt', targetClass: 'TokenAuthenticationIT' },
          { packageSubFolder: 'security/jwt', targetClass: 'TokenAuthenticationSecurityMetersIT' },
          { packageSubFolder: 'security/oauth2', targetClass: 'CustomClaimConverterIT' },
          { packageSubFolder: 'service', targetClass: 'MailServiceIT' },
          { packageSubFolder: 'service', targetClass: 'UserServiceIT' },
        ];
        for (const { packageSubFolder, targetClass } of targetClasses) {
          const filePath = `${srcTestJava}${packageFolder}/${packageSubFolder}/${targetClass}.java`;
          if (this.existsDestination(filePath)) {
            this.editFile(filePath, content =>
              content
                .replace(
                  `class ${targetClass}`,
                  `@DisabledInAotMode // workaround for https://github.com/spring-projects/spring-boot/issues/32195\nclass ${targetClass}`,
                )
                .replace(/(import .+;)\n/, '$1\nimport org.springframework.test.context.aot.DisabledInAotMode;\n'),
            );
          }
        }
      },

      readme() {
        this.editFile('README.md', content =>
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
        for (const { name } of entities.filter(({ builtIn, embedded }) => !builtIn && !embedded)) {
          // Use entity from old location for more complete data.
          const entity = this.sharedData.getEntity(name);
          if (!entity) {
            this.log.warn(`Skipping entity generation, use '--with-entities' flag`);
            continue;
          }
          this.editFile(`${srcMainJava}/${entity.entityAbsoluteFolder}/web/rest/${entity.entityClass}Resource.java`, content =>
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

          if (!reactive && databaseTypeSql && entity.containsBagRelationships) {
            this.editFile(
              `${srcMainJava}${entity.entityAbsoluteFolder}/repository/${entity.entityClass}RepositoryWithBagRelationshipsImpl.java`,
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
              `${srcMainJava}${entity.entityAbsoluteFolder}/repository/${entity.entityClass}RepositoryInternalImpl.java`,
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
      async userEntity({ application }) {
        if (!application.generateUserManagement) return;
        // Use entity from old location for more complete data.
        const entity = this.sharedData.getEntity('User');
        if (!entity) {
          this.log.warn(`Skipping entity generation, use '--with-entities' flag`);
        } else {
          this.editFile(`${application.srcMainJava}/${entity.entityAbsoluteFolder}/web/rest/UserResource.java`, content =>
            content.replaceAll(
              `@PathVariable @Pattern(regexp = Constants.LOGIN_REGEX) String login`,
              `@PathVariable(name = "login") @Pattern(regexp = Constants.LOGIN_REGEX) String login`,
            ),
          );
        }
      },
      async jsonFilter({ application, entities }) {
        if (application.reactive) return;
        // include user entity.
        const targetEntities = [...entities.filter(({ builtIn, embedded }) => !builtIn && !embedded), this.sharedData.getEntity('User')];
        for (const entity of targetEntities) {
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
