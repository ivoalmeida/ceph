import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  name: 'about',
  exposes: {
    './Routes': 'apps/about/src/app/remote-entry/entry.routes.ts',
    './HelloComponent': 'apps/about/src/app/hello/hello.component.ts',
  }
};

export default config;
