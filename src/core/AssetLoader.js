import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class AssetLoaderSingleton {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.cache = {};
    this.pending = {};
  }

  async loadGLTF(url) {
    if (this.cache[url]) return this.cache[url];
    if (this.pending[url]) return this.pending[url];

    this.pending[url] = new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          this.cache[url] = gltf;
          delete this.pending[url];
          resolve(gltf);
        },
        undefined,
        (err) => {
          delete this.pending[url];
          reject(err);
        }
      );
    });

    return this.pending[url];
  }
}

export const AssetLoader = new AssetLoaderSingleton();
