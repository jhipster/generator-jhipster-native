import { RECOMMENDED_JAVA_VERSION, RECOMMENDED_NODE_VERSION } from 'generator-jhipster';

export const defaultMatrix = {
  os: ['ubuntu-20.04', 'macos-11', 'windows-2022'],
  'build-tool': ['maven', 'gradle'],
  'node-version': RECOMMENDED_NODE_VERSION,
  'java-version': RECOMMENDED_JAVA_VERSION,
  'default-environment': 'prod',
  include: [
    {
      os: 'windows-2022',
      'default-environment': dev,
      e2e: 'false',
      'jdl-extra-args': '--skip-install',
    },
  ],
};
