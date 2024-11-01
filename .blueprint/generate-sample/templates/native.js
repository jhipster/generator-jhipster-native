import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fromMatrix } from 'generator-jhipster/testing';

const defaultMatrix = {
  // macos-14 doesn't support docker https://docs.github.com/en/actions/using-github-hosted-runners/about-larger-runners/about-larger-runners#limitations-for-macos-larger-runners
  os: ['ubuntu-latest', 'macos-latest', 'windows-latest'],
  'build-tool': ['maven', 'gradle'],
  sample: await readdir(fileURLToPath(new URL('./samples', import.meta.url))),
};

export default Object.fromEntries(
  Object.entries(fromMatrix(defaultMatrix)).map(([_job, spec]) => [
    `${spec.sample} (${spec['build-tool']}, ${spec.os})`,
    {
      ...spec,
      ...(!spec.os.startsWith('ubuntu-') ? { 'default-environment': 'dev', e2e: 'false' } : { 'default-environment': 'prod', e2e: 'true' }),
      'java-version': '21',
    },
  ]),
);
