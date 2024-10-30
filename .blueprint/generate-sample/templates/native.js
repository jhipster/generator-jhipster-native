import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fromMatrix } from 'generator-jhipster/testing';

const defaultMatrix = {
  // macos-14 doesn't support docker https://docs.github.com/en/actions/using-github-hosted-runners/about-larger-runners/about-larger-runners#limitations-for-macos-larger-runners
  sample: await readdir(fileURLToPath(new URL('./samples', import.meta.url))),
  'build-tool': ['maven', 'gradle'],
  os: ['ubuntu-latest', 'macos-13', 'windows-latest'],
};

export default Object.fromEntries(
  Object.entries(fromMatrix(defaultMatrix)).map(([_job, spec]) => [
    `${spec.sample} (${spec['build-tool']}, ${spec.os})`,
    {
      ...spec,
      ...(spec.os.startsWith('windows-') ? { 'default-environment': 'dev', e2e: 'false' } : { 'default-environment': 'prod', e2e: 'true' }),
    },
  ]),
);
