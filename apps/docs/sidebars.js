// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Repository roots',
      items: [
        'project/package-manifests',
        'project/env-and-git',
        'project/node-modules',
      ],
    },
    {
      type: 'category',
      label: 'Backend & shared assets',
      items: [
        'project/server',
        'project/lib',
        'project/config',
        'project/factory',
      ],
    },
    {
      type: 'category',
      label: 'Applications (apps/)',
      items: [
        'apps/overview',
        'apps/landing',
        'apps/ui-kit',
        'apps/factory-web',
        'apps/config-creator',
        'apps/config-manager',
        'apps/camera-stream',
        'apps/image-upload',
        'apps/server-detection',
        'apps/server-reasoning',
        'apps/compare',
        'apps/streaming',
        'apps/model-training',
        'apps/annotate',
        'apps/debug',
      ],
    },
  ],
};

export default sidebars;
