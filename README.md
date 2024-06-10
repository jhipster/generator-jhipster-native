# JHipster Native

> JHipster blueprint, Spring Boot Native blueprint for JHipster

[![NPM version][npm-image]][npm-url]
[![Generator][github-generator-image]][github-generator-url]
[![Integration Test][github-samples-image]][github-samples-url]

# Introduction

This is a [JHipster](https://www.jhipster.tech/) blueprint based on the research done by [@mraible](https://github.com/mraible) and [@joshlong](https://github.com/joshlong) in their [spring-native-examples repository](https://github.com/mraible/spring-native-examples).

For simplicity, it provides an embedded generator-jhipster and a CLI. To learn more, see the following blog posts:

- [Introducing Spring Native for JHipster: Serverless Full-Stack Made Easy](https://developer.okta.com/blog/2022/03/03/spring-native-jhipster)
- [Use GitHub Actions to Build GraalVM Native Images](https://developer.okta.com/blog/2022/04/22/github-actions-graalvm)

# Installation

To install or update this blueprint:

```bash
npm install -g generator-jhipster-native
```

To build a native image, you need to install a JDK that is compatible with GraalVM. Please refer to the [GraalVM Release Notes](https://www.graalvm.org/release-notes/) and install the appropriate JDK. Using SDKMAN simplifies the installation process.

```
sdk install java 21-graalce
```

# Usage

## How to Generate Code

To use this blueprint, run the below command

```bash
jhipster-native
```

When building a new application, we recommend enabling e2e testing with Cypress to ensure that no runtime errors occur.

```
? Besides Jest/Vitest, which testing frameworks would you like to use? (Press <space> to select, <a> to
 toggle all, <i> to invert selection, and <enter> to proceed)
❯◉ Cypress
```

For available options, you can run

```bash
jhipster-native app --help
```

## How to Build a Native Image

To build a native image, execute the following command:

```bash
npm run native-package
```

After that, set up peripheral services like PostgreSQL using `npm run services:up` and ensure everything is ready.

Lastly, run the Native image and experience its fast startup 😊.

```bash
npm run native-start
```

If you've enabled e2e testing with Cypress, you can verify its operation using the following command:

```bash
npm run native-e2e
```

## Native binary runtime errors

GraalVM uses metadata to generate AOT compilation.

A metadata is designed to support an specific version. Missing library range will be added as best bet and will fall back to latest version.

Metadata errors are only catch in runtime. It’s recommended to have cypress e2e tests enabled.

Refer to [GraalVM Reachability Metadata Repository](https://github.com/oracle/graalvm-reachability-metadata/)

# Pre-release

To use an unreleased version, install it using npm + git repository.

```bash
npm install -g jhipster/generator-jhipster-native
jhipster-native --skip-jhipster-dependencies
```

# Updated (or pre-release) generator-jhipster

This blueprint embeds a compatible generator-jhipster version, but it's possible to use an updated generator-jhipster by running the `jhipster` cli with `blueprints` option instead of the builtin `jhipster-native`, like:

```bash
npm install -g generator-jhipster@latest
jhipster --blueprints native
```

[npm-image]: https://img.shields.io/npm/v/generator-jhipster-native.svg
[npm-url]: https://npmjs.org/package/generator-jhipster-native
[github-generator-image]: https://github.com/jhipster/generator-jhipster-native/actions/workflows/generator.yml/badge.svg
[github-generator-url]: https://github.com/jhipster/generator-jhipster-native/actions/workflows/generator.yml
[github-samples-image]: https://github.com/jhipster/generator-jhipster-native/actions/workflows/samples.yml/badge.svg
[github-samples-url]: https://github.com/jhipster/generator-jhipster-native/actions/workflows/samples.yml
