# Vite Plugin for DevTools Project Settings (devtools.json)

Vite plugin for generating the Chrome DevTools project settings file on-the-fly
in the devserver.

This enables seamless integration with the new Chrome DevTools features

1. [DevTools Project Settings (devtools.json)](https://goo.gle/devtools-json-design), and
1. [Automatic Workspace folders](http://goo.gle/devtools-automatic-workspace-folders).

## Installation

```bash
npm install -D vite-plugin-devtools-json
```

## Usage

Add it to your Vite config

```js
import {defineConfig} from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';

export default defineConfig({
  plugins: [
    devtoolsJson(),
    // ...
  ]
});
```

While the plugin can generate a UUID and save it in vite cache, you can also
specify it in the options like in the following:

```
  plugins: [
    devtoolsJson({ uuid: "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b" }),
    // ...
  ]
```

### Options

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `projectRoot` | `string` | `config.root` | Absolute path that will be reported to DevTools. Useful for monorepos or when the Vite root is not the desired folder. |
| `normalizeForWindowsContainer` | `boolean` | `true` | Convert Linux paths to UNC form so Chrome on Windows (WSL / Docker Desktop) can mount them (e.g. via WSL or Docker Desktop). Pass `false` to disable. <br/>_Alias:_ `normalizeForChrome` (deprecated)_ |
| `uuid` | `string` | auto-generated | Fixed UUID if you prefer to control it yourself. |

Example with all options:

```js
import { defineConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';

export default defineConfig({
  plugins: [
    devtoolsJson({
      projectRoot: '/absolute/path/to/project',
      normalizeForWindowsContainer: true,
      uuid: '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b'
    })
  ]
});
```

The `/.well-known/appspecific/com.chrome.devtools.json` endpoint will serve the
project settings as JSON with the following structure

```json
{
  "workspace": {
    "root": "/path/to/project/root",
    "uuid": "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"
  }
}
```

where `root` is the absolute path to your `{projectRoot}` folder, and `uuid` is
a random v4 UUID, generated the first time that you start the Vite devserver
with the plugin installed (it is henceforth cached in the Vite cache folder).

Checkout [bmeurer/automatic-workspace-folders-vanilla] for a trivial example
project illustrating how to use the plugin in practice.

## Publishing

The package is published to npm by the
[`publish-on-tag`](.github/workflows/publish-on-tag.yml) GitHub Actions
workflow, which uses npm [trusted publishing](https://docs.npmjs.com/trusted-publishers)
(no npm tokens involved) and generates
[provenance attestations](https://docs.npmjs.com/generating-provenance-statements).

To publish a new version:

1. Bump the `version` in `package.json` and land that change on `main`.
2. Tag the release commit and push the tag:

   ```sh
   git tag v1.2.3
   git push origin v1.2.3
   ```

Pushing the tag triggers the workflow, which builds and tests the package and
then runs `npm publish`.

## License

The code is under [MIT License](LICENSE).

[bmeurer/automatic-workspace-folders-vanilla]: https://github.com/bmeurer/automatic-workspace-folders-vanilla
