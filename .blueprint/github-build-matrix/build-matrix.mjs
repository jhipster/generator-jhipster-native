import { readdir } from 'fs/promises';
import { RECOMMENDED_JAVA_VERSION, RECOMMENDED_NODE_VERSION } from 'generator-jhipster';
import { fromMatrix } from 'generator-jhipster/testing';

const defaultMatrix = {
  os: ['ubuntu-20.04', 'macos-11', 'windows-2022'],
  'build-tool': ['maven', 'gradle'],
  'node-version': [RECOMMENDED_NODE_VERSION],
  'java-version': [RECOMMENDED_JAVA_VERSION],
  'default-environment': ['prod'],
};

export const buildMatrix = async samplesFolder => {
  const samples = await readdir(samplesFolder);
  return {
    include: Object.values(
      fromMatrix({
        'sample-name': samples.filter(sample => !sample.includes('disabled')),
        ...defaultMatrix,
      }),
    ).map(value => ({
      ...value,
      ...(value.os === 'windows-2022'
        ? {
            'default-environment': 'dev',
            e2e: 'false',
            'jdl-extra-args': '--skip-install',
          }
        : {
            'default-environment': 'prod',
            e2e: 'true',
          }),
    })),
  };
};
