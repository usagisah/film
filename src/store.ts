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
}

export type FilmDefineStore = typeof defineStore
function defineStore<T>(useAppId: string, config: FilmStoreConfig<T>) {
  createFilmStore(useAppId, config)
}

export type FilmGetStore = typeof getStore
function getStore<T = any>(id: string, params?: any): T
function getStore<T = any>(appId: string, storeId: string, params?: any): T
function getStore(useAppId: any, p1: any, p2: any = null, params: any = null) {
  const { appId } = globalConfig
  if (appId.length === 0) throw globalConfig.unInitError
  if (typeof p1 !== "string") throw "useStore.params[0] 必须是一个仓库id"
  let _appId = useAppId ?? appId
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

export type FilmWatchStore = typeof watchStore
function watchStore<T = any>(storeId: string, handle: (newStates: T, oldStates: T) => any): () => any
function watchStore<T = any>(appId: string, storeId: string, handle: (newStates: T, oldStates: T) => any): () => any
function watchStore(p0?: any, p1?: any, p2?: any, p3?: any): any {
  let appId = ""
  let storeId = ""
  let handle: any
  if (typeof p2 === "string") {
    appId = p1
    storeId = p2
    handle = p3
  } else {
    appId = p0
    storeId = p1
    handle = p2
  }
  const res = watchFilmStore(appId, storeId, handle)
  return res ?? function unWatch() {}
}

export type FilmUseStoreManager = typeof useStoreManager
export function useStoreManager() {
  const { appId } = globalConfig
  if (appId.length === 0) throw globalConfig.unInitError
  const useAppId = arguments[0] ?? appId
  return {
    define: defineStore.bind(null, useAppId),
    get: getStore.bind(null, useAppId) as FilmGetStore,
    watch: watchStore.bind(null, useAppId) as FilmWatchStore
  }
}

type FilmStore = {
  state: any
  appId: string
  storeId: string
  getter?: (state: any, info: FilmStoreActionInfo) => any
  setter?: (newState: any, oldState: any, info: FilmStoreActionInfo) => any
  subscribers: ((newStates: any, oldStates: any) => any)[]
  overwrite: (newStore: FilmStore, oldStore: FilmStore, userAppId: string, config: FilmStoreConfig<any>) => FilmStore
}
const filmAppStoreMap = new Map<string, Map<string, FilmStore>>()
const filmStoreEmptyState = Symbol("filmStoreEmptyState")

function createFilmStore(userAppId: string, config: FilmStoreConfig<any>) {
  const { id, state, getter, setter, expose, overwrite } = config

  let appStoreMap = filmAppStoreMap.get(userAppId)
  if (!appStoreMap) filmAppStoreMap.set(userAppId, (appStoreMap = new Map()))

  let newStore: FilmStore = {
    appId: userAppId,
    storeId: id,
    state,
    getter,
    setter,
    subscribers: [],
    overwrite: typeof overwrite === "function" ? overwrite : (v: any) => v
  }
  const oldStore = appStoreMap.get(id)
  if (oldStore) {
    newStore = oldStore.overwrite(newStore, oldStore, userAppId, config)
  }
  appStoreMap.set(id, newStore)
}

function getFilmStore(appId: string, storeId: string, params: any) {
  const appStoreMap = filmAppStoreMap.get(appId)
  if (!appStoreMap) return filmStoreEmptyState
  const store = appStoreMap.get(storeId)
  if (!store) return filmStoreEmptyState

  const { getter, state } = store
  const info: FilmStoreActionInfo = { appId, storeId, params }
  return getter ? getter(state, info) : state
}

function setFilmStore(appId: string, storeId: string, newState: any, params: any) {
  const appStoreMap = filmAppStoreMap.get(appId)
  if (!appStoreMap) return null
  const store = appStoreMap.get(storeId)
  if (!store) return null

  const { state, setter, subscribers } = store
  const info: FilmStoreActionInfo = { appId, storeId, params }
  const result = setter ? setter(newState, state, info) : state
  if (result === undefined) return

  for (const fn of subscribers) fn(result, state)
  store.state = result
}

function watchFilmStore(appId: string, storeId: string, handle: any) {
  const appStoreMap = filmAppStoreMap.get(appId)
  if (!appStoreMap) return false
  const store = appStoreMap.get(storeId)
  if (!store) return false

  const { subscribers, state, getter } = store
  subscribers.push(handle)

  const info: FilmStoreActionInfo = { appId, storeId, params: null }
  const _state = getter ? getter(state, info) : state
  handle(_state, undefined)

  return function unWatch() {
    const index = subscribers.indexOf(handle)
    if (index > -1) subscribers.splice(index, 1)
  }
}
