import { FilmStaticApi } from "./dep.type.js"
import { globalConfig } from "./global.js"
import { isObject } from "./helper.js"
import { useStoreManager } from "./store.js"

export type FilmDependencyConfig = Record<
  string,
  {
    value?: unknown
    version?: string
    loader?: any
  }
>

export interface FilmDependencyGetConfig {
  version?: string
  params?: any
  force?: boolean
}

export interface FilmDependencyInfoConfig {
  state?: boolean
  appId?: boolean
  version?: boolean
  value?: boolean
}

export type FilmDefineDependencies = typeof defineDependencies
function defineDependencies<T extends FilmDependencyConfig = FilmDependencyConfig>(useAppId: string, config: T) {
  return setFilmDep(useAppId, config)
}

export type FilmGetDependency = typeof getDependency
function getDependency(key: string, config: Omit<FilmDependencyGetConfig, "force"> = {}): any {
  let _version = config.version ?? "default"
  let _params = config.params
  return getFilmDep(key, { version: _version, params: _params, force: false })
}

export type FilmResolveDependency = typeof resolveDependency
async function resolveDependency(key: string, config: FilmDependencyGetConfig = {}): Promise<any> {
  let _version = config.version ?? "default"
  let _params = config.params
  let _force = !!config.force
  return getFilmDep(key, {
    version: _version,
    params: _params,
    force: _force
  })
}

export type FilmGetDependencyInfo = typeof getDependencyInfo
export type FilmDependencyInfo = {
  name: string
  state: string
  appId: string
  version: string
  value: string
}
function getDependencyInfo(): FilmDependencyInfo[]
function getDependencyInfo(config: FilmDependencyInfoConfig): FilmDependencyInfo[]
function getDependencyInfo(keys: string[]): FilmDependencyInfo[]
function getDependencyInfo(keys: string[], config: FilmDependencyInfoConfig): FilmDependencyInfo[]
function getDependencyInfo(p1?: any, p2?: any) {
  let keys: string[] = []
  let config: FilmDependencyInfoConfig = { appId: true }

  if (Array.isArray(p1)) keys = p1
  else if (isObject(p1)) config = p2

  if (isObject(p2)) config = p2

  const { appId, state, value, version } = config
  const depKeys = [...filmDependencyMap.keys()]
  const result: any[] = []
  for (const k of depKeys) {
    const ks = k.split("-")
    const name = ks.slice(0, -1).join("-")
    const _version = ks.at(-1)
    if (keys.length === 0 || keys.includes(name)) {
      const info = filmDependencyMap.get(k)!
      result.push({
        name,
        appId: appId ? info.appId : null,
        version: version ? _version : null,
        state: state ? info.state : null,
        value: value ? info.value : null
      })
    }
  }
  return result
}

export type FilmUseDependencyManager = typeof useDependencyManager
export function useDependencyManager() {
  const { appId } = globalConfig
  if (appId.length === 0) throw globalConfig.unInitError
  const useAppId = arguments[0] ?? appId
  return { get: getDependency, resolve: resolveDependency, getDependencyInfo, define: defineDependencies.bind(null, useAppId) }
}

type FilmDependency = {
  state: "pending" | "loading" | "complete"
  appId: string
  name: string
  value: any
  loader: ((p: any) => Promise<any>) | null
  n: number
  [x: string]: any
}
const filmDependencyMap = new Map<string, FilmDependency>()

function getFilmDep(key: string, config: Required<FilmDependencyGetConfig>): any | Promise<any> {
  const { version, params, force } = config
  const _key = key + "-" + version
  const dep = filmDependencyMap.get(_key)
  if (!dep) return null

  let { state, value, loader, n } = dep
  if (force) {
    dep.state = state = "pending"
    dep.n += 1
  }
  if (state === "complete" || !loader || state === "loading") return value

  dep.state = "loading"
  return loader(params)
    .then(
      res => [false, res],
      err => [err, null]
    )
    .then(([err, res]) => {
      if (n !== dep.n) return dep.value
      let _res: any = (dep.value = res[1])
      dep.state === "complete"

      if (err) throw err

      const map: any = (globalThis as any)[globalConfig.gMapField]
      if (map[key]) {
        _res = map[key]({
          useFilmDependencyManager: useDependencyManager,
          useFilmStoreManager: useStoreManager
        } as FilmStaticApi)
        map[key] = null
      }
      return (dep.value = _res)
    })
}

function setFilmDep(appId: string, config: FilmDependencyConfig) {
  for (const key in config) {
    let { version, value, loader } = config[key]
    if (!version) version = "default"
    if (typeof version !== "string") continue

    const _key = key + "-" + version
    const depInfo: FilmDependency = {
      appId,
      name: key,
      state: "pending",
      value,
      loader: null,
      n: 0
    }
    if (typeof loader === "function") {
      depInfo.loader = loader
    } else {
      depInfo.state = "complete"
    }
    filmDependencyMap.set(_key, depInfo)
  }
}
