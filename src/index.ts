import fs from 'fs';
import path from 'path';
import {v4, validate} from 'uuid';
import {Plugin} from 'vite';

interface DevToolsJSON {
  workspace?: {
    root: string,
    uuid: string,
  }
}

const ENDPOINT = '/.well-known/appspecific/com.chrome.devtools.json';

const plugin = (options?: {uuid: string}): Plugin => ({
  name: 'devtools-json',
  enforce: 'post',

  configureServer(server) {
    const {config} = server;
    const {logger} = config;

    if (!config.env.DEV) {
      return;
    }

    const getOrCreateUUID = () => {
      if (options?.uuid) {
        return options.uuid;
      }
      // Per https://vite.dev/config/shared-options.html#cachedir
      // the `config.cacheDir` can be either an absolute path, or
      // a path relative to project root (which in turn can be
      // either an absolute path, or a path relative to the current
      // working directory).
      let {cacheDir} = config;
      if (!path.isAbsolute(cacheDir)) {
        let {root} = config;
        if (!path.isAbsolute(root)) {
          root = path.resolve(process.cwd(), root);
        }
        cacheDir = path.resolve(root, cacheDir);
      }
      const uuidPath = path.resolve(cacheDir, 'uuid.json');
      if (fs.existsSync(uuidPath)) {
        const uuid = fs.readFileSync(uuidPath, {encoding: 'utf-8'});
        if (validate(uuid)) {
          return uuid;
        }
      }
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, {recursive: true});
      }
      const uuid = v4();
      fs.writeFileSync(uuidPath, uuid, {encoding: 'utf-8'});
      logger.info(`Generated UUID '${uuid}' for DevTools project settings.`);
      return uuid;
    };

    server.middlewares.use(ENDPOINT, async (req, res) => {
      // Per https://vite.dev/config/shared-options.html#root the
      // `config.root` can either be an absolute path, or a path
      // relative to the current working directory.
      let {root} = config;
      if (!path.isAbsolute(root)) {
        root = path.resolve(process.cwd(), root);
      }

      // WSL case detection
      if (process.env.WSL_DISTRO_NAME) {
        // Convert Linux path to Windows path format for WSL
        root = path
          .join("\\\\wsl.localhost", process.env.WSL_DISTRO_NAME, root)
          .replace(/\//g, "\\");
      }

      const uuid = getOrCreateUUID();
      const devtoolsJson: DevToolsJSON = {
        workspace: {
          root,
          uuid,
        }
      };
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(devtoolsJson, null, 2));
    });
  }
});

export default plugin;
