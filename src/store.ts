import { globalConfig } from "./global.js"

export interface FilmStoreActionInfo {
  appId: string
  storeId: string
  params: any
}

export interface FilmStoreConfig<T> {
  id: string
  state: T
  getter?: (state: T, info: FilmStoreActionInfo) => T
  setter?: (newState: T, oldState: T, info: FilmStoreActionInfo) => T
  expose?: (info: FilmStoreActionInfo) => boolean
  overwrite?: (newStore: FilmStore, oldStore: FilmStore, userAppId: string, config: FilmStoreConfig<any>) => FilmStore
  [x: string]: any
}

export type FilmDefineStore = typeof defineStore
function defineStore<T>(config: FilmStoreConfig<T>) {
  const { appId } = globalConfig
  createFilmStore(appId, config)
}

export type FilmUseStore = typeof getStore
function getStore<T = any>(id: string, params?: any): T
function getStore<T = any>(appId: string, storeId: string, params?: any): T
function getStore(p1: string, p2: any, params: any = null) {
  const { appId } = globalConfig
  if (appId.length === 0) throw globalConfig.unInitError
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

export type FilmUseStoreManager = typeof useStoreManager
export function useStoreManager() {
  const { appId } = globalConfig
  if (appId.length === 0) throw globalConfig.unInitError
  return { define: defineStore, get: getStore }
}

type FilmStore = {
  state: any
  appId: string
  storeId: string
  getters: ((state: any, info: FilmStoreActionInfo) => any)[]
  setters: ((newState: any, oldState: any, info: FilmStoreActionInfo) => any)[]
  exposes: ((info: FilmStoreActionInfo) => boolean)[]
  overwrite: (newStore: FilmStore, oldStore: FilmStore, userAppId: string, config: FilmStoreConfig<any>) => FilmStore
}
const filmAppStoreMap = new Map<string, Map<string, FilmStore>>()
const filmStoreEmptyState = Symbol("filmStoreEmptyState")

let createFilmStore = (userAppId: string, config: FilmStoreConfig<any>) => {
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
  const info: FilmStoreActionInfo = { appId, storeId, params }
  for (const fn of exposes) if (!fn(info)) return filmStoreEmptyState

  let result = state
  for (const fn of getters) result = fn(result, info)
  return result
}

let setFilmStore = (appId: string, storeId: string, newState: any, params: any) => {
  const appStoreMap = filmAppStoreMap.get(appId)
  if (!appStoreMap) return null
  const store = appStoreMap.get(storeId)
  if (!store) return null

  const { state, setters } = store
  const info: FilmStoreActionInfo = { appId, storeId, params }
  let result = state
  for (const fn of setters) result = fn(newState, state, info)
  store.state = result
}
