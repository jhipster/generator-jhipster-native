import chalk from 'chalk';
import ServerGenerator from 'generator-jhipster/generators/server';
import {
  javaMainPackageTemplatesBlock,
} from 'generator-jhipster/generators/java/support';

import { SPRING_NATIVE_VERSION, NATIVE_BUILDTOOLS_VERSION } from '../../lib/constants.mjs';

import { JAVA_MAIN_SOURCES_DIR, TEMPLATES_TEST_SOURCES_DIR, TEMPLATES_JAVASCRIPT_TEST_DIR } from 'generator-jhipster';


export default class extends ServerGenerator {
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

  get [ServerGenerator.POST_WRITING]() {
    return {
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

      async customizeGradle({ application: { buildToolGradle, reactive } }) {
        if (!buildToolGradle) return;

        this.addGradlePluginToPluginsBlock('org.springframework.experimental.aot', SPRING_NATIVE_VERSION);
        this.addGradleMavenRepository('https://repo.spring.io/release');
        this.addGradlePluginManagementRepository('https://repo.spring.io/release');

        this.editFile('build.gradle', content =>
          content.replace('implementation "io.netty:netty-tcnative-boringssl-static"', '').replace(
            'processResources.dependsOn bootBuildInfo',
            `
processResources.dependsOn bootBuildInfo
bootBuildImage {
  builder = "paketobuildpacks/builder:tiny"
  environment = [
    "BP_NATIVE_IMAGE" : "true",
    "BP_NATIVE_IMAGE_BUILD_ARGUMENTS": "--no-fallback \${findProperty('nativeImageProperties') ?: ''}"
  ]
}
graalvmNative {
  binaries {
    main {
      imageName = 'native-executable'
      //this is only needed when you toolchain can't be detected
      //javaLauncher = javaToolchains.launcherFor {
      //  languageVersion = JavaLanguageVersion.of(11)
      //  vendor = JvmVendorSpec.matching("GraalVM Community")
      //}
      verbose = false
      buildArgs.add("\${findProperty('nativeBuildArgs') ?: ''}")
    }
  }
}`
          )
        );
      },

      async customizeMaven({ application: { buildToolMaven }, source}) {
        if (!buildToolMaven) return;

        source.addMavenProfile(
          {id: 'native',
           content: `            <build>
           <pluginManagement>
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
                       <configuration>
                           <classesDirectory>\${project.build.outputDirectory}</classesDirectory>
                           <metadataRepository>
                               <enabled>true</enabled>
                           </metadataRepository>
                           <requiredVersion>22.3</requiredVersion>
                       </configuration>
                       <executions>
                           <execution>
                               <id>add-reachability-metadata</id>
                               <goals>
                                   <goal>add-reachability-metadata</goal>
                               </goals>
                           </execution>
                       </executions>
                   </plugin>
               </plugins>
           </pluginManagement>
       </build>`}
       );
       source.addMavenProfile(
          {id: 'nativeTest',
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
       </build>`}
        );

        this.editFile('pom.xml', content =>
          content
            .replace(
              `
        <dependency>
            <groupId>io.netty</groupId>
            <artifactId>netty-tcnative-boringssl-static</artifactId>
            <scope>runtime</scope>
        </dependency>`,
              ''
            )
            // Add the GraalVM native-maven-plugin to the 'prod' profile
            .replace(
              /(<build>[\s\S]*?<pluginManagement>\s*<plugins>[\s\S]*?)(<\/plugins>\s*<\/pluginManagement>\s*<\/build>)/,
              `$1<plugin>
              <groupId>org.graalvm.buildtools</groupId>
              <artifactId>native-maven-plugin</artifactId>
          </plugin>$2`
            )
            // Remove the modernizer-maven-plugin from the content
            .replace(
              /<plugin>\s*<groupId>org.gaul<\/groupId>\s*<artifactId>modernizer-maven-plugin<\/artifactId>[\s\S]*?<\/plugin>/g,
              ''
            )
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
          </plugin>$2`
            )
        );
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

      async asyncConfiguration({ application: { authenticationTypeOauth2, packageFolder } }) {
        if (authenticationTypeOauth2) return;
        const asyncConfigurationPath = `${JAVA_MAIN_SOURCES_DIR}${packageFolder}/config/AsyncConfiguration.java`;
        this.editFile(asyncConfigurationPath, content =>
          content.replace(
            'return new ExceptionHandlingAsyncTaskExecutor(executor);',
            'executor.initialize();\nreturn new ExceptionHandlingAsyncTaskExecutor(executor);'
          )
        );
      },
      async jwt({ application: { authenticationTypeOauth2 } }) {
        if (authenticationTypeOauth2) return;
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/jwt/reflect-config.json',
          'src/main/resources/META-INF/native-image/jwt/reflect-config.json'
        );
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/jwt/resource-config.json',
          'src/main/resources/META-INF/native-image/jwt/resource-config.json'
        );

        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/common/reflect-config.json',
          'src/main/resources/META-INF/native-image/common/reflect-config.json'
        );
      },

      async caffeine({ application: { authenticationTypeOauth2 } }) {
        if (authenticationTypeOauth2) {
          await this.copyTemplate(
            'src/main/resources/META-INF/native-image/caffeine/reflect-config.json',
            'src/main/resources/META-INF/native-image/caffeine/reflect-config.json'
          );
        }
      },

      async liquibase({ application: { databaseTypeSql } }) {
        if (!databaseTypeSql) return;
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/liquibase/reflect-config.json',
          'src/main/resources/META-INF/native-image/liquibase/reflect-config.json'
        );
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/liquibase/resource-config.json',
          'src/main/resources/META-INF/native-image/liquibase/resource-config.json'
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
        const mainClassPath = `${JAVA_MAIN_SOURCES_DIR}${packageFolder}/${this.getMainClassName(baseName)}.java`;
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
        this.editFile(`${JAVA_MAIN_SOURCES_DIR}${packageFolder}/config/WebConfigurer.java`, content =>
          content.replace('setLocationForStaticAssets(server)', '// setLocationForStaticAssets(server)')
        );
      }, */

      async logoutResource({ application: { packageFolder, authenticationTypeOauth2, reactive } }) {
        if (!authenticationTypeOauth2) return;
        const filePath = `${JAVA_MAIN_SOURCES_DIR}${packageFolder}/web/rest/LogoutResource.java`;

        this.editFile(filePath, content =>
          content
            .replace('@AuthenticationPrincipal(expression = "idToken") OidcIdToken idToken', '@AuthenticationPrincipal OidcUser oidcUser')
            .replace(
              'import org.springframework.security.oauth2.core.oidc.OidcIdToken;',
              `import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;`
            )
            .replace('@param idToken the ID token.', '@param oidcUser the OIDC user.')
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
import reactor.core.publisher.Flux;`
              ),
            contents =>
              contents.replace(
                '\nclass ',
                `
@Component
class `
              )
          );
        }
      },

      cypress({ application: { cypressTests } }) {
        if (!cypressTests) return;
        this.editFile(`${TEMPLATES_JAVASCRIPT_TEST_DIR}/cypress/e2e/administration/administration.cy.ts`, contents =>
          contents
            .replace("describe('/metrics'", "describe.skip('/metrics'")
            .replace("describe('/logs'", "describe.skip('/logs'")
            .replace("describe('/configuration'", "describe.skip('/configuration'")
        );
      },
    };
  }

  get [ServerGenerator.POST_WRITING_ENTITIES]() {
    return this.asPostWritingTaskGroup({
      async entities({ application: { reactive, databaseTypeSql }, entities }) {
        for (const { name } of entities.filter(({ builtIn, embedded }) => !builtIn && !embedded)) {
          // Use entity from old location for more complete data.
          const entity = this.sharedData.getEntity(name);
          if (!entity) {
            this.log.warn(`Skipping entity generation, use '--with-entities' flag`);
            continue;
          }
          this.editFile(`${JAVA_MAIN_SOURCES_DIR}/${entity.entityAbsoluteFolder}/web/rest/${entity.entityClass}Resource.java`, content =>
            content
              .replaceAll(
                `@PathVariable(value = "${entity.primaryKey.name}", required = false) final ${entity.primaryKey.type} ${entity.primaryKey.name}`,
                `@PathVariable(name = "${entity.primaryKey.name}", value = "${entity.primaryKey.name}", required = false) final ${entity.primaryKey.type} ${entity.primaryKey.name}`
              )
              .replaceAll(
                `@PathVariable ${entity.primaryKey.type} ${entity.primaryKey.name}`,
                `@PathVariable("${entity.primaryKey.name}") ${entity.primaryKey.type} ${entity.primaryKey.name}`
              )
              .replaceAll(
                `@RequestParam(required = false, defaultValue = "false") boolean eagerload`,
                `@RequestParam(name = "eagerload", required = false, defaultValue = "false") boolean eagerload`
              )
              .replaceAll(
                `@RequestParam(required = false, defaultValue = "true") boolean eagerload`,
                `@RequestParam(name = "eagerload", required = false, defaultValue = "true") boolean eagerload`
              )
          );

          if (!reactive && databaseTypeSql && entity.containsBagRelationships) {
            this.editFile(
              `${JAVA_MAIN_SOURCES_DIR}${entity.entityAbsoluteFolder}/repository/${entity.entityClass}RepositoryWithBagRelationshipsImpl.java`,
              contents =>
                contents.replace(
                  'import org.springframework.beans.factory.annotation.Autowired;',
                  'import javax.persistence.PersistenceContext;'
                ),
              contents => contents.replace('@Autowired', '@PersistenceContext')
            );
          }

          if (reactive && databaseTypeSql) {
            this.editFile(
              `${JAVA_MAIN_SOURCES_DIR}${entity.entityAbsoluteFolder}/repository/${entity.entityClass}RepositoryInternalImpl.java`,
              contents =>
                contents.replace(
                  'import reactor.core.publisher.Flux;',
                  `import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;`
                ),
              contents =>
                contents.replace(
                  '\nclass ',
                  `
@Component
class `
                )
            );
          }
        }
      },
      async jsonFilter({ entities }) {
        // include user entity.
        const targetEntities = [
          ...entities.filter(({ builtIn, embedded }) => !builtIn && !embedded),
          this.sharedData.getEntity('User')
        ]
        for (const entity of targetEntities) {
          this.editFile(`${JAVA_MAIN_SOURCES_DIR}/${entity.entityAbsoluteFolder}/domain/${entity.entityClass}.java`, content =>
            content.includes('@JsonFilter("lazyPropertyFilter")') ? content :
            content.replace(
              '\npublic class ',
              '\n@JsonFilter("lazyPropertyFilter")\npublic class '
            )
            .replace(
              /(package[\s\S]*?)(import)/,              
              `$1import com.fasterxml.jackson.annotation.JsonFilter;$2`,
            )
          );
        }
      },      
    });
  }

  get [ServerGenerator.WRITING]() {
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
          `You can see some tips about running Spring Boot with GraalVM at https://github.com/mraible/spring-native-examples#readme.`
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
