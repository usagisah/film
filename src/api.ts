import { FilmUseDependencyManager } from "./dep.js"
import { FilmStaticApi } from "./dep.type.js"
import { globalConfig } from "./global.js"
import { FilmUseStoreManager } from "./store.js"

export type {
  FilmDefineDependencies,
  FilmDependencyConfig,
  FilmDependencyGetConfig,
  FilmDependencyInfo,
  FilmDependencyInfoConfig,
  FilmGetDependency,
  FilmGetDependencyInfo,
  FilmResolveDependency,
  FilmUseDependencyManager
} from "./dep.js"
export type * from "./dep.type.js"
export type { FilmDefineStore, FilmGetStore, FilmStoreActionInfo, FilmStoreConfig, FilmUseStoreManager, FilmWatchStore } from "./store.js"

const throwFn: any = () => {
  throw globalConfig.unInitError
}

export let useFilmDependencyManager: FilmUseDependencyManager = throwFn
export let useFilmStoreManager: FilmUseStoreManager = throwFn

export function setFilmStaticApi(api: Partial<FilmStaticApi>) {
  api.useFilmDependencyManager && (useFilmDependencyManager = api.useFilmDependencyManager)
  api.useFilmStoreManager && (useFilmStoreManager = api.useFilmStoreManager)
}

export function fetchJsLoader(url: string) {
  return new Function(`return import("${url}")`)
}
