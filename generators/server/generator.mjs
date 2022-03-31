import chalk from 'chalk';
import { GeneratorBaseEntities, constants } from 'generator-jhipster';
import { PRIORITY_PREFIX, POST_WRITING_PRIORITY, POST_WRITING_ENTITIES_PRIORITY, END_PRIORITY } from 'generator-jhipster/esm/priorities';

const { SERVER_MAIN_SRC_DIR, SERVER_TEST_SRC_DIR, CLIENT_TEST_SRC_DIR } = constants;

export default class extends GeneratorBaseEntities {
  constructor(args, opts, features) {
    super(args, opts, { taskPrefix: PRIORITY_PREFIX, ...features });

    if (this.options.help) return;

    if (!this.options.jhipsterContext) {
      throw new Error(`This is a JHipster blueprint and should be used only like ${chalk.yellow('jhipster --blueprints native')}`);
    }

    this.sbsBlueprint = true;
  }

  async _postConstruct() {
    await this.dependsOnJHipster('bootstrap-application');
  }

  get [POST_WRITING_PRIORITY]() {
    return {
      async packageJson() {
        this.packageJson.merge({
          scripts: {
            'native-e2e': 'concurrently -k -s first "npm run native-start" "npm run e2e:headless"',
            'native-package': './mvnw package -Pnative,prod -DskipTests',
            'prenative-start': 'npm run docker:db:await --if-present && npm run docker:others:await --if-present',
            'native-start': './target/native-executable',
          },
        });
      },

      async removeFiles() {
        this.deleteDestination('src/main/resources/logback-spring.xml');
        this.deleteDestination('src/test/resources/logback.xml');
      },

      async pomXml({ application: { buildToolMaven } }) {
        if (!buildToolMaven) return;

        this.addMavenRepository(
          'spring-releases',
          'https://repo.spring.io/release',
          `            <name>Spring Releases</name>
            <snapshots>
                <enabled>false</enabled>
            </snapshots>`
        );
        this.addMavenPluginRepository(
          'spring-releases',
          'https://repo.spring.io/release',
          `            <name>Spring Releases</name>
            <snapshots>
                <enabled>false</enabled>
            </snapshots>`
        );

        this.addMavenProperty('repackage.classifier');
        this.addMavenProperty('spring-native.version', '0.11.3');

        this.addMavenDependency('org.springframework.experimental', 'spring-native', '${spring-native.version}');
        this.addMavenDependency('org.springdoc', 'springdoc-openapi-native', '1.6.6');

        const buildArgs = ['--no-fallback'];
        if (process.env.GITHUB_ACTIONS) {
          buildArgs.push('--verbose', process.platform === 'darwin' ? '-J-Xmx13g' : '-J-Xmx7g');
        }
        this.addMavenProfile(
          'native',
          `            <properties>
                <repackage.classifier>exec</repackage.classifier>
                <native-buildtools.version>0.9.11</native-buildtools.version>
            </properties>
            <dependencies>
                <dependency>
                    <groupId>org.junit.platform</groupId>
                    <artifactId>junit-platform-launcher</artifactId>
                    <scope>test</scope>
                </dependency>
            </dependencies>
            <build>
                <plugins>
                    <plugin>
                        <groupId>org.springframework.experimental</groupId>
                        <artifactId>spring-aot-maven-plugin</artifactId>
                        <version>\${spring-native.version}</version>
                        <executions>
                            <execution>
                                <id>test-generate</id>
                                <goals>
                                    <goal>test-generate</goal>
                                </goals>
                            </execution>
                            <execution>
                                <id>generate</id>
                                <goals>
                                    <goal>generate</goal>
                                </goals>
                            </execution>
                        </executions>
                    </plugin>
                    <plugin>
                        <groupId>org.graalvm.buildtools</groupId>
                        <artifactId>native-maven-plugin</artifactId>
                        <version>\${native-buildtools.version}</version>
                        <extensions>true</extensions>
                        <executions>
                            <execution>
                                <id>test-native</id>
                                <phase>test</phase>
                                <goals>
                                    <goal>test</goal>
                                </goals>
                            </execution>
                            <execution>
                                <id>build-native</id>
                                <phase>package</phase>
                                <goals>
                                    <goal>build</goal>
                                </goals>
                            </execution>
                        </executions>
                        <configuration>
                            <imageName>native-executable</imageName>
                            <buildArgs>
${buildArgs.map(buildArg => `                                <buildArg>${buildArg}</buildArg>`).join('/n')}
                            </buildArgs>
                        </configuration>
                    </plugin>
                </plugins>
            </build>`
        );
        let pomXml = this.readDestination('pom.xml');
        pomXml = pomXml
          .replace(
            `
        <dependency>
            <groupId>io.netty</groupId>
            <artifactId>netty-tcnative-boringssl-static</artifactId>
        </dependency>`,
            ''
          )
          .replace(
            `
                <artifactId>spring-boot-maven-plugin</artifactId>`,
            `
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <classifier>\${repackage.classifier}</classifier>
                    <image>
                        <builder>paketobuildpacks/builder:tiny</builder>
                        <env>
                            <BP_NATIVE_IMAGE>true</BP_NATIVE_IMAGE>
                        </env>
                    </image>
                </configuration>`
          );
        this.writeDestination('pom.xml', pomXml);
      },

      async customizeConfig() {
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

        this.fs.append(
          this.destinationPath('src/main/resources/config/application.yml'),
          `
---
spring:
  sql:
    init:
      mode: never
`
        );
      },

      async mainClass({ application: { baseName, packageFolder, databaseTypeSql, prodDatabaseTypePostgres, reactive } }) {
        const mainClassPath = `${SERVER_MAIN_SRC_DIR}${packageFolder}/${this.getMainClassName(baseName)}.java`;
        let content = this.readDestination(mainClassPath);
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
        content = content.replace(
          '@SpringBootApplication',
          `@org.springframework.nativex.hint.TypeHint(
    types = {
${types.join('        ,\n')}
    }${typeNamesContent}
)
@SpringBootApplication`
        );
        this.writeDestination(mainClassPath, content);
      },

      async webConfigurer({ application: { packageFolder } }) {
        const filePath = `${SERVER_MAIN_SRC_DIR}${packageFolder}/config/WebConfigurer.java`;
        let content = this.readDestination(filePath);
        content = content.replace('setLocationForStaticAssets(server)', '// setLocationForStaticAssets(server)');
        this.writeDestination(filePath, content);
      },

      async logoutResource({ application: { packageFolder, authenticationTypeOauth2, reactive } }) {
        if (!authenticationTypeOauth2) return;
        const filePath = `${SERVER_MAIN_SRC_DIR}${packageFolder}/web/rest/LogoutResource.java`;

        let content = this.readDestination(filePath);
        content = content
          .replace('@AuthenticationPrincipal(expression = "idToken") OidcIdToken idToken', '@AuthenticationPrincipal OidcUser oidcUser')
          .replace(
            'import org.springframework.security.oauth2.core.oidc.OidcIdToken;',
            `import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;`
          )
          .replace('@param idToken the ID token.', '@param oidcUser the OIDC user.');
        if (reactive) {
          content = content.replace(', idToken)', ', oidcUser.getIdToken())');
        } else {
          content = content.replace(
            '// Okta',
            `// Okta
        OidcIdToken idToken = oidcUser.getIdToken();`
          );
        }

        this.writeDestination(filePath, content);
      },

      userRepository({ application: { packageFolder, reactive, databaseTypeSql } }) {
        if (reactive && databaseTypeSql) {
          this.editFile(
            `${SERVER_MAIN_SRC_DIR}${packageFolder}/repository/UserRepository.java`,
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

      replaceUndertowWithTomcat({ application: { reactive, packageFolder } }) {
        if (!reactive) {
          this.editFile('pom.xml', contents => contents.replaceAll('undertow', 'tomcat'));

          this.editFile(`${SERVER_TEST_SRC_DIR}${packageFolder}/config/WebConfigurerTest.java`, contents =>
            contents
              .replace('import org.springframework.boot.web.embedded.undertow.UndertowServletWebServerFactory;\n', '')
              .replace(/    @Test\n    void shouldCustomizeServletContainer\(\)([\s\S]*?)\n    }/, '')
          );
        }
      },

      cypress({ application: { cypressTests } }) {
        if (!cypressTests) return;
        this.editFile(`${CLIENT_TEST_SRC_DIR}/cypress/integration/administration/administration.spec.ts`, contents =>
          contents
            .replace("describe('/metrics'", "describe.skip('/metrics'")
            .replace("describe('/logs'", "describe.skip('/logs'")
            .replace("describe('/configuration'", "describe.skip('/configuration'")
        );
      },
    };
  }

  get [POST_WRITING_ENTITIES_PRIORITY]() {
    return {
      async entities({ application: { reactive, databaseTypeSql }, entities }) {
        for (const { name } of entities.filter(({ builtIn, embedded }) => !builtIn && !embedded)) {
          // Use entity from old location for more complete data.
          const entity = this.configOptions.sharedEntities[name];
          if (!entity) {
            this.warning(`Skipping entity generation, use '--with-entities' flag`);
            continue;
          }
          const resourcePath = `${SERVER_MAIN_SRC_DIR}/${entity.entityAbsoluteFolder}/web/rest/${entity.entityClass}Resource.java`;
          let content = this.readDestination(resourcePath);

          content = content
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
            );

          this.writeDestination(resourcePath, content);
          if (!reactive && databaseTypeSql && entity.containsBagRelationships) {
            this.editFile(
              `${SERVER_MAIN_SRC_DIR}${entity.entityAbsoluteFolder}/repository/${entity.entityClass}RepositoryWithBagRelationshipsImpl.java`,
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
              `${SERVER_MAIN_SRC_DIR}${entity.entityAbsoluteFolder}/repository/${entity.entityClass}RepositoryInternalImpl.java`,
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
    };
  }

  get [END_PRIORITY]() {
    return {
      async checkCompatibility({
        application: {
          reactive,
          buildToolMaven,
          databaseTypeNo,
          prodDatabaseTypePostgres,
          cacheProviderNo,
          enableHibernateCache,
          websocket,
          searchEngine,
        },
      }) {
        if (!buildToolMaven) {
          this.warning('JHipster Native is only tested with Maven build tool');
        }
        if (!databaseTypeNo && !prodDatabaseTypePostgres) {
          this.warning('JHipster Native is only tested with PostgreSQL database');
        }
        if (searchEngine) {
          this.warning('JHipster Native is only tested without a search engine');
        }
        if (!reactive) {
          if (!cacheProviderNo) {
            this.warning('JHipster Native is only tested without a cache provider');
          }
          if (enableHibernateCache) {
            this.warning('JHipster Native is only tested without Hibernate second level cache');
          }
          if (websocket) {
            this.warning('JHipster Native is only tested without WebSocket support');
          }
        }
      },

      async endTemplateTask() {
        this.info(
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
