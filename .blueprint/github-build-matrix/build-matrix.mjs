import { readdir } from 'fs/promises';
import { RECOMMENDED_JAVA_VERSION, RECOMMENDED_NODE_VERSION } from 'generator-jhipster';
import { fromMatrix } from 'generator-jhipster/testing';

const defaultMatrix = {
  // macos-14 is m1 backed https://docs.github.com/pt/actions/using-github-hosted-runners/about-github-hosted-runners/about-github-hosted-runners
  // actions-setup-docker currently does not support arm64 https://github.com/docker-practice/actions-setup-docker/issues/38
  os: ['ubuntu-latest', 'macos-12', 'windows-latest'],
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
        ...defaultMatrix,
        'sample-name': samples.filter(sample => !sample.includes('disabled')),
      }),
    ).map(value => ({
      ...value,
      ...(value.os.startsWith('windows-')
        ? { 'default-environment': 'dev', e2e: 'false' }
        : { 'default-environment': 'prod', e2e: 'true' }),
    })),
  };
};
