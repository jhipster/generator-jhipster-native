import { fileURLToPath } from 'node:url';
import { defineDefaults } from 'generator-jhipster/testing';

defineDefaults({
  blueprint: 'generator-jhipster-native',
  blueprintPackagePath: fileURLToPath(new URL('./', import.meta.url)),
});
