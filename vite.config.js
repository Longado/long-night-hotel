import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        game: fileURLToPath(new URL('./index.html', import.meta.url)),
        visualLab: fileURLToPath(new URL('./visual-lab.html', import.meta.url)),
        characterPreview: fileURLToPath(new URL('./character-preview.html', import.meta.url)),
        scenePreview: fileURLToPath(new URL('./scene-preview.html', import.meta.url)),
      },
    },
  },
});
