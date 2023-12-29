import { setFilmStaticApi } from "./api.js"
import { FilmInitConfig, FilmStaticApi } from "./dep.type.js"
import { globalConfig } from "./global.js"
import { isObject } from "./helper.js"

export async function defineFilm(config: FilmInitConfig) {
  const { appId, factory } = config
  if (typeof appId !== "string" || appId.length === 0) throw "defineFilm.config.appId 必须是一个合法字符串"

  const { gMapField } = globalConfig
  const map: any = (globalThis as any)[gMapField]
  if (isObject(map)) {
    map[appId] = function playFilm(api: FilmStaticApi) {
      if (globalConfig.appId.length > 0) return
      globalConfig.appId = appId!
      setFilmStaticApi({
        useFilmDependencyManager: (api.useFilmDependencyManager as any).bind(null, appId),
        useFilmStoreManager: (api.useFilmStoreManager as any).bind(null, appId)
      })
      return factory && factory({ rootApp: false })
    }
  } else {
    const { initFilm } = await import("./root.js")
    initFilm(config)
  }
}
