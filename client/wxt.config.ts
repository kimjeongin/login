import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const fixedDevExtensionManifestKey =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt7/K3d1vhYckYlZTa8rtU8DLnnjAoheiHb7wJCVfhjEwhqt+8QPHP0SFpw5pNXysS03o0x5O9VlnTh6+8xuTNPJ2VmYwHniaf+K6OWWrwmtZP5WjD5uiD753mK4uX3gYWGudmZJUs45icGaLY4eqCmRMtASi5YeAaJDUEvqMW5hYdVPk65zlKQCgTfyPENG7kRiwD2TX8RrMIq/GbXIALjuuVjoCKYhxg1O8fr10a3ieZnq7VL//0RmPjFBN7XBzG5ogG5qVg4uI86TfvCDcwF9G7rzm229AA3k8mj/PvlwsCEO/wn+mvOEXJsz+VIT/N9vZaaPgMiIHb4uFlnMuXQIDAQAB';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    key: fixedDevExtensionManifestKey,
    permissions: ['identity'],
    host_permissions: [
      'http://localhost:8000/*',
      'http://127.0.0.1:8000/*',
      'http://localhost:8080/*',
      'http://127.0.0.1:8080/*',
    ],
    action: {
      default_title: 'Project Side Panel',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
