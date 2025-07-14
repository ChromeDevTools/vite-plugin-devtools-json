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
   * in DevTools. When omitted, we fall back to Vite’s `config.root` logic.
   */
  projectRoot?: string;

  /**
   * @deprecated Use `normalizeForWindowsContainer` instead. Will be removed in a future major version.
   */
  normalizeForChrome?: boolean;
  /**
   * Whether to rewrite Linux paths to UNC form so Chrome running on Windows
   * (WSL or Docker Desktop) can mount them as a workspace. Enabled by default.
   */
  normalizeForWindowsContainer?: boolean;
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

    // Determine effective normalisation flag once so we can reuse it.
    const normalizePaths =
      options.normalizeForWindowsContainer ??
      (options.normalizeForChrome ?? true);

    // Emit deprecation warning if old option is used in isolation.
    if (
      Object.prototype.hasOwnProperty.call(options, 'normalizeForChrome') &&
      options.normalizeForWindowsContainer === undefined
    ) {
      logger.warn(
        '[vite-plugin-devtools-json] "normalizeForChrome" is deprecated – please rename to "normalizeForWindowsContainer".'
      );
    }

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

      const maybeNormalizePath = (absRoot: string): string => {
        if (!normalizePaths) return absRoot;

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

      let root = maybeNormalizePath(resolveProjectRoot());
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
