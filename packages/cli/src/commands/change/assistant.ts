import prompts from 'prompts';
import { IChangeFile } from 'evem-core';
import { cancelFlow } from '../../utils/command';

export async function askSelectVersionAndDesc(packages: string[]): Promise<IChangeFile[]> {
  const changeFiles: IChangeFile[] = [];
  // store description to reuse
  let description = '';

  for (const name of packages) {
    const res = await prompts(
      {
        type: 'select',
        name: 'value',
        message: `What change type of ${name}`,
        choices: [
          {
            title: 'Major',
            value: 'major',
            description: 'Used for changes that break compatibility'
          },
          {
            title: 'Minor',
            value: 'minor',
            description: 'Used for backwards compatible changes'
          },
          {
            title: 'Patch',
            value: 'patch',
            description: 'Used for changes that do not affect compatibility'
          },
          {
            title: 'None',
            value: 'none',
            description: 'Used for changes that not released for the time being'
          },
          { title: 'Skip', description: 'Skip this change', value: 'skip' }
        ],
        initial: 4
      },
      { onCancel: cancelFlow }
    );
    if (res.value === 'skip') {
      continue;
    }

    const { desc } = await prompts(
      {
        type: 'text',
        name: 'desc',
        message: `Write a description for the change`,
        validate: (value) => {
          if (!value?.trim()) return 'description can not be empty';
          return true;
        },
        initial: description
      },
      { onCancel: cancelFlow }
    );
    description = desc;

    changeFiles.push({
      packageName: name,
      changes: [
        {
          packageName: name,
          comment: desc,
          type: res.value
        }
      ]
    });
  }

  return changeFiles;
}
