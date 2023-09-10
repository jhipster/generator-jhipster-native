import chalk from 'chalk';
import ServerGenerator from 'generator-jhipster/generators/server';
import { javaMainPackageTemplatesBlock } from 'generator-jhipster/generators/java/support';

import { NATIVE_BUILDTOOLS_VERSION, GRAALVM_VERSION } from '../../lib/constants.mjs';

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
        if (application.reactive) return;
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

      // async removeFiles() {
      //   this.deleteDestination('src/main/resources/logback-spring.xml');
      //   this.deleteDestination('src/test/resources/logback.xml');

      //   // Don't use deleteDestination because it deletes the existing file.
      //   delete this.env.sharedFs.store[this.destinationPath('.npmrc')];
      // },

      async customizeGradle({ application: { buildToolGradle, reactive }, source }) {
        if (!buildToolGradle) return;

        source.addGradlePlugin({ id: 'org.graalvm.buildtools.native', version: NATIVE_BUILDTOOLS_VERSION });
        if (!reactive) {
          // eslint-disable-next-line no-template-curly-in-string
          source.addGradlePlugin({ id: 'org.hibernate.orm', version: '${hibernateVersion}' });
        }

        this.editFile('build.gradle', content =>
          content.replace('implementation "io.netty:netty-tcnative-boringssl-static"', '').replace(
            'processResources.dependsOn bootBuildInfo',
            `processResources.dependsOn bootBuildInfo

bootBuildImage {
  builder = "paketobuildpacks/builder:tiny"
  environment = [
    "BP_NATIVE_IMAGE" : "true",
    "BP_NATIVE_IMAGE_BUILD_ARGUMENTS": "--no-fallback \${findProperty('nativeImageProperties') ?: ''}"
  ]
}
graalvmNative {
  toolchainDetection = true
  binaries {
    main {
      imageName = 'native-executable'
      //this is only needed when you toolchain can't be detected
      //javaLauncher = javaToolchains.launcherFor {
      //  languageVersion = JavaLanguageVersion.of(19)
      //  vendor = JvmVendorSpec.matching("GraalVM Community")
      //}
      verbose = false
    }
  }
}
processTestAot {
  jvmArgs += ["-XX:+AllowRedefinitionToAddDeleteMethods"]
}
${
  reactive
    ? ''
    : `
hibernate {
  enhancement {
      enableLazyInitialization = true
  }
}`
}
`,
          ),
        );
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

      /*       async customizeConfig() {
        this.fs.append(
          this.destinationPath('src/main/resources/config/application.yml'),
          `
---
logging:
  level:
    root: ERROR
    io.netty: ERROR
    liquibase: ERROR
    org.hibernate: ERROR
    org.springframework: ERROR
    com.zaxxer.hikari: ERROR
    org.apache.catalina: ERROR
    org.apache.tomcat: ERROR
    tech.jhipster.config: ERROR
    jdk.event.security: ERROR
    java.net: ERROR
    sun.net.www: ERROR
`
        );
      }, */

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
      async common({ application }) {
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/common/reflect-config.json',
          'src/main/resources/META-INF/native-image/common/reflect-config.json',
        );
      },

      // TODO: platform selection.
      async h2({ application }) {
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/h2/reflect-config.json',
          'src/main/resources/META-INF/native-image/h2/reflect-config.json',
        );
      },

      async hibernate({ application }) {
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/hibernate/reflect-config.json',
          'src/main/resources/META-INF/native-image/hibernate/reflect-config.json',
        );
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/hibernate/proxy-config.json',
          'src/main/resources/META-INF/native-image/hibernate/proxy-config.json',
        );
      },

      // TODO: platform selection.
      async mysql({ application }) {
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/mysql/reflect-config.json',
          'src/main/resources/META-INF/native-image/mysql/reflect-config.json',
        );
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

        /*         this.fs.append(
          this.destinationPath('src/main/resources/config/application.yml'),
          `
---
spring:
  sql:
    init:
      mode: never
`
        ); */
      },

      /*       async mainClass({ application: { baseName, packageFolder, databaseTypeSql, prodDatabaseTypePostgres, reactive } }) {
        const mainClassPath = `${srcMainJava}${packageFolder}/${this.getMainClassName(baseName)}.java`;
        const types = [
          'org.HdrHistogram.Histogram.class',
          'org.HdrHistogram.ConcurrentHistogram.class',
          // Required by *ToMany relationships
          'java.util.HashSet.class',
        ];
        const typeNames = [];
        if (databaseTypeSql) {
          types.push(
            'liquibase.configuration.LiquibaseConfiguration.class',
            'com.zaxxer.hikari.HikariDataSource.class',
            'liquibase.change.core.LoadDataColumnConfig.class'
          );
          if (prodDatabaseTypePostgres && !reactive) {
            types.push('org.hibernate.type.TextType.class', 'tech.jhipster.domain.util.FixedPostgreSQL10Dialect.class');
          }
          if (reactive) {
            types.push('org.springframework.data.r2dbc.repository.support.SimpleR2dbcRepository.class');
            typeNames.push('"com.zaxxer.hikari.util.ConcurrentBag$IConcurrentBagEntry[]"');
          }
        }

        const typeNamesContent =
          typeNames.length > 0
            ? `,
    typeNames = {
${typeNames.join('        ,\n')}
    }`
            : '';

        this.editFile(mainClassPath, content =>
          content.replace(
            '@SpringBootApplication',
            `@org.springframework.nativex.hint.TypeHint(
    types = {
${types.join('        ,\n')}
    }${typeNamesContent}
)
@SpringBootApplication`
          )
        );
      }, */

      /*       async webConfigurer({ application: { packageFolder } }) {
        this.editFile(`${srcMainJava}${packageFolder}/config/WebConfigurer.java`, content =>
          content.replace('setLocationForStaticAssets(server)', '// setLocationForStaticAssets(server)')
        );
      }, */

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
