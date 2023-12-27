import { FilmUseDependencyManager } from "./dep.js"
import { FilmUseStoreManager } from "./store.js"

export type FilmInitFactoryInfo = {
  rootApp: boolean
}
export interface FilmInitConfig {
  appId: string
  factory?: (info: FilmInitFactoryInfo) => any
}

export type FilmStaticApi = { useFilmDependencyManager: FilmUseDependencyManager; useFilmStoreManager: FilmUseStoreManager }
