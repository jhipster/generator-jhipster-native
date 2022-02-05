import chalk from 'chalk';
import { GeneratorBaseEntities, constants } from 'generator-jhipster';
import { PRIORITY_PREFIX, WRITING_PRIORITY, POST_WRITING_PRIORITY, END_PRIORITY } from 'generator-jhipster/esm/priorities';

const { SERVER_MAIN_SRC_DIR } = constants;

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

  get [WRITING_PRIORITY]() {
    return {
      async writingTemplateTask() {
        /*
        await this.writeFiles({
          sections: {
            files: [{ templates: ['template-file-server'] }],
          },
          context: this,
        });
        */
      },
    };
  }

  get [POST_WRITING_PRIORITY]() {
    return {
      async packageJson() {
        this.packageJson.merge({
          scripts: {
            'package-native': './mvnw package -Pnative,prod -DskipTests',
          },
        });
      },
      async customizePom({ application }) {
        if (!application.buildToolMaven) return;

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
        this.addMavenProperty('spring-native.version', '0.11.2');

        this.addMavenDependency('org.springframework.experimental', 'spring-native', '${spring-native.version}');
        this.addMavenDependency('org.springdoc', 'springdoc-openapi-native', '1.6.5');

        this.addMavenPlugin(
          'org.springframework.boot',
          'spring-boot-maven-plugin',
          undefined,
          `    <configuration>
        <classifier>\${repackage.classifier}</classifier>
        <image>
            <builder>paketobuildpacks/builder:tiny</builder>
            <env>
                <BP_NATIVE_IMAGE>true</BP_NATIVE_IMAGE>
            </env>
        </image>
    </configuration>`
        );
        this.addMavenPlugin(
          'org.springframework.experimental',
          'spring-aot-maven-plugin',
          '${spring-native.version}',
          `    <executions>
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
    </executions>`
        );

        this.addMavenProfile(
          'native',
          `            <properties>
                <repackage.classifier>exec</repackage.classifier>
                <native-buildtools.version>0.9.9</native-buildtools.version>
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
                    </plugin>
                </plugins>
            </build>`
        );
        let pomXml = this.readDestination('pom.xml');
        pomXml = pomXml.replaceAll('undertow', 'tomcat');
        this.writeDestination('pom.xml', pomXml);
      },

      async removeFiles() {
        this.deleteDestination('src/main/resources/logback-spring.xml');
        this.deleteDestination('src/test/resources/logback.xml');
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
    org.springframework: INFO
`
        );
      },

      async liquibase({ application }) {
        if (!application.databaseTypeSql) return;
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/liquibase/reflect-config.json',
          'src/main/resources/META-INF/native-image/liquibase/reflect-config.json'
        );
        await this.copyTemplate(
          'src/main/resources/META-INF/native-image/liquibase/resource-config.json',
          'src/main/resources/META-INF/native-image/liquibase/resource-config.json'
        );
        /*
@TypeHint(
    types = {
        ...
    })
        */
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

      async main({ application: { baseName, packageFolder, databaseTypeSql } }) {
        const mainClassPath = `${SERVER_MAIN_SRC_DIR}${packageFolder}/${this.getMainClassName(baseName)}.java`;
        let content = this.readDestination(mainClassPath);
        const liquibase = databaseTypeSql
          ? `liquibase.configuration.LiquibaseConfiguration.class,
        com.zaxxer.hikari.HikariDataSource.class,
        liquibase.change.core.LoadDataColumnConfig.class,
        tech.jhipster.domain.util.FixedPostgreSQL10Dialect.class,
        org.hibernate.type.TextType.class,
        `
          : '';
        content = content.replace(
          '@SpringBootApplication',
          `@org.springframework.nativex.hint.TypeHint(
    types = {
        ${liquibase}org.HdrHistogram.Histogram.class,
        org.HdrHistogram.ConcurrentHistogram.class
    }
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

      async logoutResource({ application: { packageFolder, authenticationTypeOauth2 } }) {
        if (!authenticationTypeOauth2) return;
        const filePath = `${SERVER_MAIN_SRC_DIR}${packageFolder}/web/rest/LogoutResource.java`;
        let content = this.readDestination(filePath);
        content = content
          .replace('@AuthenticationPrincipal(expression = "idToken") OidcIdToken idToken', '@AuthenticationPrincipal OidcUser oidcUser')
          .replace(
            'StringBuilder logoutUrl = new StringBuilder();',
            `StringBuilder logoutUrl = new StringBuilder();
    OidcIdToken idToken = oidcUser.getIdToken();`
          );
        this.writeDestination(filePath, content);
      },
    };
  }

  get [END_PRIORITY]() {
    return {
      async endTemplateTask() {
        this.warning(
          `You can see some tips about running SpringBoot with GraalVM at https://github.com/mraible/spring-native-examples#readme.`
        );
      },
    };
  }
}
