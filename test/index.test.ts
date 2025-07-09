import request from 'supertest';
import {createServer} from 'vite';
import {describe, expect, it} from 'vitest';
import path from 'path';

import VitePluginDevToolsJson from '../src';

const port = 8089;

describe('#VitePluginDevToolsJson', () => {
  describe('#configureServer', () => {
    it('should serve a `devtools.json`', async () => {
      const server = await createServer({
        plugins: [VitePluginDevToolsJson()],
        server: {
          port,
          host: true,
        },
      });

      await server.listen();

      const response =
          await request(server.httpServer!)
              .get('/.well-known/appspecific/com.chrome.devtools.json');
      const devtoolsJson = JSON.parse(response.text);

      expect(response.status).to.equal(200);
      expect(response.type).to.equal('application/json');
      expect(devtoolsJson).to.haveOwnProperty('workspace');
      expect(devtoolsJson.workspace).to.haveOwnProperty('root');
      expect(devtoolsJson.workspace.root).to.be.a.string;
      expect(devtoolsJson.workspace).to.haveOwnProperty('uuid');
      expect(devtoolsJson.workspace.uuid).to.be.a.string;

      await server.close();
    });

    it('should cache the UUID', async () => {
      const server = await createServer({
        plugins: [VitePluginDevToolsJson()],
        server: {
          port,
          host: true,
        },
      });

      await server.listen();

      const [response1, response2] = await Promise.all([
        request(server.httpServer!)
            .get('/.well-known/appspecific/com.chrome.devtools.json'),
        request(server.httpServer!)
            .get('/.well-known/appspecific/com.chrome.devtools.json'),
      ]);

      expect(response1.text).to.equal(response2.text);

      await server.close();
    });

    it("should detect WSL", async () => {
      // fake this data for the test.
      process.env.WSL_DISTRO_NAME = "my-wsl-distro.7-11";

      const server = await createServer({
        plugins: [VitePluginDevToolsJson()],
        server: {
          port,
          host: true,
        },
      });

      await server.listen();

      const response1 = await request(server.httpServer!).get(
        "/.well-known/appspecific/com.chrome.devtools.json"
      );

      expect(response1.text).include("wsl.localhost");
      expect(response1.text).include("my-wsl-distro.7-11");
      expect(response1.text).include("vite-plugin-devtools-json");

      await server.close();
    });

    it('should respect the `projectRoot` option', async () => {
      delete process.env.WSL_DISTRO_NAME;
      const customRoot = path.resolve('/tmp/custom-project-root');
      const server = await createServer({
        plugins: [VitePluginDevToolsJson({ projectRoot: customRoot })],
        server: { port, host: true },
      });

      await server.listen();

      const response = await request(server.httpServer!)
        .get('/.well-known/appspecific/com.chrome.devtools.json');
      const json = JSON.parse(response.text);
      expect(json.workspace.root).to.equal(customRoot);

      await server.close();
    });

    it('should skip path normalization when `normalizeForChrome` is false', async () => {
      process.env.WSL_DISTRO_NAME = 'fake-distro';
      const server = await createServer({
        plugins: [VitePluginDevToolsJson({ normalizeForChrome: false })],
        server: { port, host: true },
      });
      await server.listen();

      const response = await request(server.httpServer!)
        .get('/.well-known/appspecific/com.chrome.devtools.json');
      const json = JSON.parse(response.text);
      expect(json.workspace.root).to.not.include('wsl.localhost');

      await server.close();
      delete process.env.WSL_DISTRO_NAME;
    });
  });
});
