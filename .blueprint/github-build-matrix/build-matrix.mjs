import { RECOMMENDED_JAVA_VERSION, RECOMMENDED_NODE_VERSION } from 'generator-jhipster';
import { fromMatrix } from 'generator-jhipster/testing';

const defaultMatrix = {
  // macos-14 doesn't support docker https://docs.github.com/en/actions/using-github-hosted-runners/about-larger-runners/about-larger-runners#limitations-for-macos-larger-runners
  os: ['ubuntu-latest', 'macos-13', 'windows-latest'],
  'build-tool': ['maven', 'gradle'],
  'node-version': [RECOMMENDED_NODE_VERSION],
  'java-version': [RECOMMENDED_JAVA_VERSION],
  'default-environment': ['prod'],
};

export const buildMatrix = ({ samples, samplesFolder }) => {
  return {
    include: Object.values(
      fromMatrix({
        ...defaultMatrix,
        'sample-name': samples.filter(sample => !sample.includes('disabled')),
      }),
    ).map(sample => ({
      ...sample,
      ...(sample.os.startsWith('windows-')
        ? { 'default-environment': 'dev', e2e: 'false' }
        : { 'default-environment': 'prod', e2e: 'true' }),
      'job-name': sample['sample-name'],
      'extra-args': `--samples-folder ${samplesFolder}`,
    })),
  };
};
