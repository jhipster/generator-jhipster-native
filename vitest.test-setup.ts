import { fileURLToPath } from 'node:url';

import { defineDefaults } from 'generator-jhipster/testing';

await defineDefaults({
  blueprint: 'generator-jhipster-native',
  blueprintPackagePath: fileURLToPath(new URL('./', import.meta.url)),
});
