# generator-jhipster-native

> JHipster blueprint, Spring Boot Native blueprint for JHipster

[![NPM version][npm-image]][npm-url]
[![Generator][github-generator-image]][github-generator-url]
[![Integration Test][github-integration-image]][github-integration-url]

# Introduction

This is a [JHipster](https://www.jhipster.tech/) blueprint.
For simplicity, it provides an embed generator-jhipster and a cli.

# Installation

To install or update this blueprint:

```bash
npm install -g generator-jhipster-native
```

# Usage

To use this blueprint, run the below command

```bash
jhipster-native
```

For available options, you can run

```bash
jhipster-native app --help
```

# Pre-release

To use an unreleased version, install it using npm + git repository.

```bash
npm install -g jhipster/generator-jhipster-native#main
jhipster-native --skip-jhipster-dependencies
```

# Updated (or pre-release) generator-jhipster

This blueprint embeds a compatible generator-jhipster version, but it's possible to use an updated generator-jhipster by running the `jhipster` cli with `blueprints` option instead of the builtin `jhipster-native`, like:

```bash
npm install -g jhipster@latest
jhipster --blueprints native
```

[npm-image]: https://img.shields.io/npm/v/generator-jhipster-native.svg
[npm-url]: https://npmjs.org/package/generator-jhipster-native
[github-generator-image]: https://github.com/jhipster/generator-jhipster-native/actions/workflows/generator.yml/badge.svg
[github-generator-url]: https://github.com/jhipster/generator-jhipster-native/actions/workflows/generator.yml
[github-integration-image]: https://github.com/jhipster/generator-jhipster-native/actions/workflows/integration.yml/badge.svg
[github-integration-url]: https://github.com/jhipster/generator-jhipster-native/actions/workflows/jdl.yml
