import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';

export default class extends BaseApplicationGenerator {
  constructor(args, opts, features) {
    super(args, opts, { ...features, sbsBlueprint: true });
  }

  async _postConstruct() {
    await this.dependsOnJHipster('bootstrap-application');
  }

  get [BaseApplicationGenerator.POST_WRITING]() {
    return {
      async postWritingTemplateTask({ source }) {
        this.packageJson.merge({
          scripts: {
            'native-package': './mvnw package -B -ntp -Pnative,prod -DskipTests',
            'native-start': './target/native-executable',
          },
        });

        source.addMavenProfile({
          id: 'native',
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
            .replace(/<plugin>\s*<groupId>org.gaul<\/groupId>\s*<artifactId>modernizer-maven-plugin<\/artifactId>[\s\S]*?<\/plugin>/g, '')
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
      },
    };
  }
}
