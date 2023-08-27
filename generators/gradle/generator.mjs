import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';

import { SPRING_NATIVE_VERSION } from '../../lib/constants.mjs';

export default class extends BaseApplicationGenerator {
  constructor(args, opts, features) {
    super(args, opts, { ...features, sbsBlueprint: true });
  }

  async _postConstruct() {
    await this.dependsOnJHipster('bootstrap-application');
  }

  get [BaseApplicationGenerator.POST_WRITING]() {
    return {
      async postWritingTemplateTask() {
        this.packageJson.merge({
          scripts: {
            'native-package': './gradlew nativeCompile -Pprod -x test -x integrationTest',
            'native-start': './build/native/nativeCompile/native-executable',
          },
        });

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
}`,
          ),
        );
      },
    };
  }
}
