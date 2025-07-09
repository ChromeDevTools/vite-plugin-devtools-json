import fs from 'fs';
import path from 'path';
import {v4, validate} from 'uuid';
import {Plugin} from 'vite';

// Plugin options
interface DevToolsJsonOptions {
  /**
   * Optional fixed UUID. If omitted the plugin will generate
   * (and cache) one automatically, which is the previous default behaviour.
   */
  uuid?: string;

  /**
   * Absolute (or relative) path that should be reported as the project root
   * in DevTools.  When omitted we fall back to Vite's `config.root` logic
   * – identical to the original implementation.
   */
  projectRoot?: string;

  /**
   * Whether to rewrite Linux paths to UNC form so Chrome running on Windows
   * (WSL or Docker Desktop) can mount them as a workspace.  Enabled by
   * default to preserve the original behaviour; pass `false` to opt-out.
   */
  normalizeForChrome?: boolean;
}

interface DevToolsJSON {
  workspace?: {
    root: string,
    uuid: string,
  }
}

const ENDPOINT = '/.well-known/appspecific/com.chrome.devtools.json';

const plugin = (options: DevToolsJsonOptions = {}): Plugin => ({
  name: 'devtools-json',
  enforce: 'post',

  configureServer(server) {
    const {config} = server;
    const {logger} = config;

    if (!config.env.DEV) {
      return;
    }

    const getOrCreateUUID = () => {
      if (options.uuid) {
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

    server.middlewares.use(ENDPOINT, async (_req, res) => {
      // Determine the project root that will be reported to DevTools.
      const resolveProjectRoot = (): string => {
        if (options.projectRoot) {
          return path.resolve(options.projectRoot);
        }
        // Fall back to Vite's root handling (original behaviour)
        let {root} = config;
        if (!path.isAbsolute(root)) {
          root = path.resolve(process.cwd(), root);
        }
        return root;
      };

      const maybeNormalizeForChrome = (absRoot: string): string => {
        if (options.normalizeForChrome === false) return absRoot;

        // WSL path rewrite
        if (process.env.WSL_DISTRO_NAME) {
          const distro = process.env.WSL_DISTRO_NAME;
          const withoutLeadingSlash = absRoot.replace(/^\//, '');
          return path
            .join('\\\\wsl.localhost', distro, withoutLeadingSlash)
            .replace(/\//g, '\\');
        }

        // Docker Desktop on Windows path rewrite
        if (process.env.DOCKER_DESKTOP && !absRoot.startsWith('\\\\')) {
          const withoutLeadingSlash = absRoot.replace(/^\//, '');
          return path
            .join('\\\\wsl.localhost', 'docker-desktop-data', withoutLeadingSlash)
            .replace(/\//g, '\\');
        }

        return absRoot;
      };

      let root = maybeNormalizeForChrome(resolveProjectRoot());
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
