import { fromMatrix } from 'generator-jhipster/testing';

const defaultMatrix = {
  // macos-14 doesn't support docker https://docs.github.com/en/actions/using-github-hosted-runners/about-larger-runners/about-larger-runners#limitations-for-macos-larger-runners
  os: ['ubuntu-latest', 'macos-13', 'windows-latest'],
  'build-tool': ['maven', 'gradle'],
};

export default Object.fromEntries(
  Object.entries(fromMatrix(defaultMatrix)).map(([sample, spec]) => [
    sample,
    {
      ...spec,
      ...(spec.os.startsWith('windows-') ? { 'default-environment': 'dev', e2e: 'false' } : { 'default-environment': 'prod', e2e: 'true' }),
      'job-name': sample,
    },
  ]),
);
