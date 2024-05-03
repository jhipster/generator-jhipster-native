import { NATIVE_BUILDTOOLS_VERSION, GRAALVM_VERSION } from '../../../lib/constants.js';

export const mavenDefinition = ({ reactive }) => ({
  properties: [
    { property: 'repackage.classifier' },
    { property: 'native-image-name', value: 'native-executable' },
    { property: 'native-build-args', value: '--verbose -J-Xmx10g' },
  ],
  plugins: [
    {
      inProfile: 'prod',
      groupId: 'org.graalvm.buildtools',
      artifactId: 'native-maven-plugin',
    },
    ...(reactive
      ? []
      : [
          {
            inProfile: 'prod',
            groupId: 'org.hibernate.orm.tooling',
            artifactId: 'hibernate-enhance-maven-plugin',
            additionalContent: `              <executions>
                  <execution>
                      <configuration>
                          <enableLazyInitialization>true</enableLazyInitialization>
                      </configuration>
                      <goals>
                          <goal>enhance</goal>
                      </goals>
                  </execution>
              </executions>`,
          },
        ]),
  ],
  dependencyManagement: reactive
    ? [
        {
          artifactId: 'commons-beanutils',
          groupId: 'commons-beanutils',
          additionalContent: `<exclusions>
      <exclusion>
          <groupId>commons-logging</groupId>
          <artifactId>commons-logging</artifactId>
      </exclusion>
  </exclusions>`,
        },
      ]
    : [],
  profiles: [
    {
      id: 'native',
      content: `            <properties>
          <repackage.classifier>exec</repackage.classifier>
          <native-buildtools.version>${NATIVE_BUILDTOOLS_VERSION}</native-buildtools.version>
          <graalvm.version>${GRAALVM_VERSION}</graalvm.version>
          <modernizer.skip>true</modernizer.skip>
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
    },
    {
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
    },
  ],
});
