# Vite Plugin for DevTools Project Settings (devtools.json)

Vite plugin for generating the Chrome DevTools project settings file on-the-fly
in the devserver.

This enables seamless integration with the new Chrome DevTools features

1. [DevTools Project Settings (devtools.json)](https://goo.gle/devtools-json-design), and
1. [Automatic Workspace folders](http://goo.gle/devtools-automatic-workspace-folders).

## Installation

```bash
npm install -D https://github.com/bmeurer/vite-plugin-devtools-json
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

## License

The code is under [MIT License](LICENSE).
