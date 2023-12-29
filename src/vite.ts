import { existsSync } from "fs"
import { rm } from "fs/promises"
import MS from "magic-string"
import { dirname, resolve } from "path"
import { Plugin, build } from "vite"
import { useFilmDependencyManager } from "./api.js"

export type FilmPluginConfig = {
  root: string
}

export default function FilmVitePlugin(config: FilmPluginConfig): Plugin | void {
  const { root } = config
  const cwd = process.cwd()
  let syncImporter: string[] = []

  const entry = resolve(cwd, root)
  if (!existsSync(entry)) return

  const name = "_film"
  const outDir = dirname(entry)
  const outFile = resolve(outDir, name + ".js")

  const init = build({
    configFile: false,
    build: {
      lib: { entry, fileName: name, formats: ["es"] },
      rollupOptions: { external: [/ufilm/] },
      minify: false,
      outDir,
      emptyOutDir: false
    },
    publicDir: false,
    logLevel: "silent"
  })
    .then(() => import(outFile))
    .then(() => {
      syncImporter = useFilmDependencyManager()
        .getDependencyInfo()
        .map(v => v.name)
      console.log(syncImporter)
      rm(outFile, { force: true })
    })
    .catch(() => {})

  const exts = [".ts", ".tsx", ".vue", ".js", ".jsx"]

  return {
    name: "film",
    async transform(code, id, options) {
      if (syncImporter.length === 0 || id === entry || !exts.some(e => id.endsWith(e))) {
        return
      }

      await init
      const importers = parseImporter(code)
      const props: { m: string; d: boolean; ps: string[] }[] = []
      const ms = new MS(code)
      for (const imp of importers) {
        if (imp.type === "static") {
          const importedName = imp.from.value
          if (!syncImporter.includes(importedName)) continue
          const def: string[] = []
          const ps: string[] = []
          for (const { value, alias } of imp.props) {
            if (value === "default") def.push(alias)
            else ps.push(value === alias ? value : `${value}:${alias}`)
          }
          if (ps.length > 0) props.push({ m: imp.from.value, d: false, ps })
          if (def.length > 0) props.push({ m: imp.from.value, d: true, ps: def })
          ms.overwrite(imp.start, imp.end, "")
        }
      }

      if (props.length > 0) {
        let _code = `import{useFilmDependencyManager as _UDM}from'ufilm';var _fd=_UDM();`
        for (const { m, d, ps } of props) {
          _code += `var ${d ? `${ps[1]}` : `{${ps.join(",")}}`}=_fd.get('${m}');`
        }
        const index = code.indexOf("\n")
        ms.appendRight(index === -1 ? 0 : index, _code)
        return ms.toString()
      }
    }
  }
}

import { parse, traverse } from "@babel/core"
type StaticImporterProps = {
  start: number
  end: number
  value: string
  alias: string
}

type StaticImporter = {
  type: "static"
  start: number
  end: number
  props: StaticImporterProps[]
  from: {
    start: number
    end: number
    value: string
  }
}
type DynamicImporter = {
  type: "dynamic"
  start: number
  end: number
  from: {
    type: "string" | "variable"
    value: string
    start: number
    end: number
  }
}
type Importer = StaticImporter | DynamicImporter
function parseImporter(code: string) {
  const result: Importer[] = []
  traverse(
    parse(code, {
      plugins: ["@babel/plugin-syntax-jsx", ["@babel/plugin-syntax-typescript", { isTSX: true }]]
    }) as any,
    {
      ImportDeclaration({ node }) {
        const { specifiers, source, start, end } = node
        const from: StaticImporter["from"] = {
          value: source.value,
          start: source.start! + 1,
          end: source.end! - 1
        }
        const props: StaticImporterProps[] = []
        for (const spec of specifiers) {
          // import {} from ""
          if (spec.type === "ImportSpecifier" && spec.imported.type === "Identifier") {
            props.push({
              start: spec.start!,
              end: spec.end!,
              value: spec.imported.name,
              alias: spec.local.name
            })
          }
          // import d from "" / import d,{} from ""
          else if (spec.type === "ImportDefaultSpecifier") {
            props.push({
              start: spec.start!,
              end: spec.end!,
              value: "default",
              alias: spec.local.name
            })
          }
          // import * as d from ""
          else if (spec.type === "ImportNamespaceSpecifier") {
            props.push({
              start: spec.start!,
              end: spec.end!,
              value: "*",
              alias: spec.local.name
            })
          } else {
            throw "存在未知情况"
          }
        }
        result.push({ type: "static", props, from, start: start!, end: end! })
      },
      CallExpression({ node }) {
        const { callee, arguments: arg, start, end } = node
        if (callee.type !== "Import" || !["StringLiteral", "Identifier"].includes(arg[0].type)) return

        const f = arg[0]
        let from: DynamicImporter["from"] | null = null
        if (f.type === "StringLiteral") {
          from = {
            type: "string",
            start: f.start!,
            end: f.end!,
            value: f.value
          }
        } else if (f.type === "Identifier") {
          from = {
            type: "variable",
            start: f.start!,
            end: f.end!,
            value: f.name
          }
        }
        if (from) result.push({ type: "dynamic", from, start: start!, end: end! })
      }
    }
  )
  return result
}
