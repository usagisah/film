function isObject(v: unknown): v is Record<string, any> {
  return Object.prototype.toString.call(v) === "[object Object]"
}

/* --------------  -------------- */

export interface DependencyConfig {
  [depName: string]: {
    value?: unknown
    version?: string
    loader?: any
  }
}

export interface DependencyGetConfig {
  version?: string
  params?: any
  force?: boolean
}

export interface DependencyInfoConfig {
  state?: boolean
  appId?: boolean
  version?: boolean
  value?: boolean
}

export interface DependencyLoadConfig {}

export function defineDependencies(config: DependencyConfig) {
  if (appId.length === 0) throw "film 尚未初始化"
  load(config)

  function get(key: string, config: Omit<DependencyGetConfig, "force"> = {}) {
    let _version = config.version ?? "default"
    let _params = config.params
    return getFilmDep(key, { version: _version, params: _params, force: false })
  }

  async function resolve(key: string, config: DependencyGetConfig = {}) {
    let _version = config.version ?? "default"
    let _params = config.params
    let _force = !!config.force
    return getFilmDep(key, {
      version: _version,
      params: _params,
      force: _force
    })
  }

  function getDependencyInfo(): any
  function getDependencyInfo(config: DependencyInfoConfig): any
  function getDependencyInfo(keys: string[]): any
  function getDependencyInfo(keys: string[], config: DependencyInfoConfig): any
  function getDependencyInfo(p1?: any, p2?: any) {
    let keys: string[] = []
    let config: DependencyInfoConfig = { appId: true }

    if (Array.isArray(p1)) keys = p1
    else if (isObject(p1)) config = p2

    if (isObject(p2)) config = p2

    if (keys.length === 0) return []
    const { appId, state, value, version } = config
    const depKeys = [...filmDependencyMap.keys()]
    const result: any[] = []
    for (const k of depKeys) {
      const [name, _version] = k.split("-")
      if (keys.includes(name)) {
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

  function load(config: DependencyConfig) {
    return setFilmDep(appId, config)
  }

  return { get, resolve, getDependencyInfo, load }
}

/* 
  const manager = defineDependencies({
    vue: {
      version
      value
    },
    "vue-router": {
      version
      value
    }
  })

  获取依赖
  manager.get("vue")
  manager.get("vue", { version: "1.1.0" })
  manager.("vue")
  manager.("vue", { version: "1.1.0" })

  获取所有依赖的名称
  manager.getDependencyInfos()
  manager.getDependencyInfos({ version: true, state: ["pending"] })
  manager.getDependencyInfos(["vue"], { version: true })

  拉取依赖
  await manager.load(["vue"], { params: [], force: true }) 拉取配置好的
  manager.load(defineConfig, {  })  自定义依赖合并
*/

/* --------------  -------------- */
export interface StoreActionInfo {
  appId: string
  storeId: string
  params: any
}
export interface StoreConfig<T> {
  id: string
  state: T
  getter?: (state: T, info: StoreActionInfo) => T
  setter?: (newState: T, oldState: T, info: StoreActionInfo) => T
  expose?: (info: StoreActionInfo) => boolean
  overwrite?: (
    newStore: FilmStore,
    oldStore: FilmStore,
    userAppId: string,
    config: StoreConfig<any>
  ) => FilmStore
  [x: string]: any
}
export function defineStore<T>(config: StoreConfig<T>) {
  if (appId.length === 0) throw "film 尚未初始化"
  createFilmStore(appId, config)

  function useStore<T = any>(id: string, params?: any): T
  function useStore<T = any>(appId: string, storeId: string, params?: any): T
  function useStore(p1: string, p2: any, params: any = null) {
    if (typeof p1 !== "string") throw "useStore.params[0] 必须是一个仓库id"

    let _appId = appId
    let _storeId = p1
    if (typeof p2 === "string") {
      _appId = p1
      _storeId = p2
    } else if (Array.isArray(p2)) {
      params = p2
    }
    const state = getFilmStore(_appId, _storeId, params)
    if (state === filmStoreEmptyState) return [null, () => false]

    const setter = (state: any) => setFilmStore(_appId, _storeId, state, params)
    return [state, setter]
  }
  return useStore
}

/* 
  defineStore({ 
    id,     标识
    expose, 暴露规则 Func<[作用域ID, 仓库ID, 访问参数, 父子级关系]>
    store   共享数据
    getter  获取时
    setter  修改时
  })

  默认使用自己作用域中指定 id 的
  useStore(id)

  尝试使用其他作用域的仓库
  useStore(scopeId, id, {})

  修改
  const [state, setState] = useStore(id)
*/

/* --------------  -------------- */
let appId = ""
let randomLen = 100000000

function randomId() {
  return ((Math.random() * randomLen + randomLen) >>> 0).toString(16)
}

export interface FilmInitConfig {
  appId?: string
}
export function initFilm(config: FilmInitConfig): void {
  if (appId.length > 0) return
  appId = config.appId ?? "__$_filmId_" + randomId() + "_"
}

export interface FilmInitApi {
  getFilmDep: typeof getFilmDep
  setFilmDep: typeof setFilmDep
  createFilmStore: typeof createFilmStore
  getFilmStore: typeof getFilmStore
  setFilmStore: typeof setFilmStore
}
export interface FilmSubApi {
  init: (config: FilmInitConfig) => void
}
export function defineFilm(config: FilmInitConfig, fn: () => any) {
  function playFilm(api: FilmInitApi) {
    getFilmDep = api.getFilmDep
    setFilmDep = api.setFilmDep
    createFilmStore = api.createFilmStore
    getFilmStore = api.getFilmStore
    setFilmStore = api.setFilmStore
    appId = config.appId ?? "__$_filmId_" + randomId() + "_"

    try {
      fn()
    } catch (e) {
      console.error(e)
    }
  }
  Object.defineProperty(playFilm, "__film_playFilm_", {
    enumerable: false,
    configurable: false,
    get: () => true
  })
  return playFilm
}

/* --------------  -------------- */
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

let getFilmDep = (
  key: string,
  config: Required<DependencyGetConfig>
): unknown | Promise<unknown> => {
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
  return (dep.value = Promise.resolve(loader(params)).then(
    res => [false, res],
    err => [err, null]
  )).then(res => {
    if (n !== dep.n) return dep.value
    if (res[0]) {
      console.error(res[0])
      dep.value = res[1]
      dep.state === "complete"
      return res[1]
    }
  })
}

let setFilmDep = (appId: string, config: DependencyConfig) => {
  for (const key in config) {
    const { version, value, loader } = config[key]
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

/* --------------  -------------- */

type FilmStore = {
  state: any
  appId: string
  storeId: string
  getters: ((state: any, info: StoreActionInfo) => any)[]
  setters: ((newState: any, oldState: any, info: StoreActionInfo) => any)[]
  exposes: ((info: StoreActionInfo) => boolean)[]
  overwrite: (
    newStore: FilmStore,
    oldStore: FilmStore,
    userAppId: string,
    config: StoreConfig<any>
  ) => FilmStore
}
const filmAppStoreMap = new Map<string, Map<string, FilmStore>>()
const filmStoreEmptyState = Symbol("filmStoreEmptyState")

let createFilmStore = (userAppId: string, config: StoreConfig<any>) => {
  const { id, state, getter, setter, expose, overwrite } = config

  let appStoreMap = filmAppStoreMap.get(userAppId)
  if (!appStoreMap) filmAppStoreMap.set(userAppId, (appStoreMap = new Map()))

  let newStore = {
    appId: userAppId,
    storeId: id,
    state,
    getters: (Array.isArray(getter) ? getter : getter) as any,
    setters: (Array.isArray(setter) ? setter : setter) as any,
    exposes: (Array.isArray(expose) ? expose : expose) as any,
    overwrite: typeof overwrite === "function" ? overwrite : (v: any) => v
  }
  const oldStore = appStoreMap.get(id)
  if (oldStore) {
    newStore = oldStore.overwrite(newStore, oldStore, userAppId, config)
  }
  appStoreMap.set(id, newStore)
}

let getFilmStore = (appId: string, storeId: string, params: any) => {
  const appStoreMap = filmAppStoreMap.get(appId)
  if (!appStoreMap) return filmStoreEmptyState
  const store = appStoreMap.get(storeId)
  if (!store) return filmStoreEmptyState

  const { exposes, getters, state } = store
  const info: StoreActionInfo = { appId, storeId, params }
  for (const fn of exposes) if (!fn(info)) return filmStoreEmptyState

  let result = state
  for (const fn of getters) result = fn(result, info)
  return result
}

let setFilmStore = (
  appId: string,
  storeId: string,
  newState: any,
  params: any
) => {
  const appStoreMap = filmAppStoreMap.get(appId)
  if (!appStoreMap) return null
  const store = appStoreMap.get(storeId)
  if (!store) return null

  const { state, setters } = store
  const info: StoreActionInfo = { appId, storeId, params }
  let result = state
  for (const fn of setters) result = fn(newState, state, info)
  store.state = result
}
