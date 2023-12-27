import { setFilmStaticApi } from "./api.js"
import { useDependencyManager } from "./dep.js"
import { FilmInitConfig } from "./dep.type.js"
import { globalConfig } from "./global.js"
import { useStoreManager } from "./store.js"

export function initFilm(config: FilmInitConfig): void {
  if (globalConfig.appId.length > 0) return
  const { appId, factory } = config
  if (typeof appId !== "string" || appId.length === 0) throw "defineFilm.initFilm.appId 必须是一个合法字符串"
  ;(globalThis as any)[globalConfig.gMapField] = {}
  globalConfig.appId = appId
  setFilmStaticApi({
    useFilmDependencyManager: useDependencyManager,
    useFilmStoreManager: useStoreManager
  })
  factory && factory({ rootApp: true })
}
