#!/usr/bin/env node
const program = require('commander')
const glob = require('glob')
const path = require('path')
const { isEmpty, startsWith, mapKeys, chain, pick, pickBy, merge, template, omit, keys, includes, get, uniq } = require('lodash')
const { readFileSync, existsSync, writeFileSync } = require('fs')
const mkdirp = require('mkdirp')
const diff = require('diff')
const chalk = require('chalk')
const transformFileSync = require('@babel/core').transformFileSync
let scannedKeyList = []

function getConfig() {
  return getConfig._config = (getConfig._config || (() => {
    let config = {}
    const cwd = process.cwd()
    try {
      config = require(path.join(cwd, 'i18n.config.json'))
    } catch (e) { console.error(e) }
    return {
      moduleSourceName: config.moduleSourceName || 'i18next',
      format: {
        funcList: get(config, 'format.funcList', ['t'])
      },
      messageDir: config.messageDir || path.join(cwd, './i18n/{{lng}}/{{ns}}.json'),
      removeUnusedKey: config.removeUnusedKey || false,
      exclude: config.exclude || [],
      dirtyPrefix: config.dirtyPrefix != null ? config.dirtyPrefix : '~',
      sort: config.sort || true,
      lngs: config.lngs || [],
      ns: config.ns || 'translation',
      defaultVal: config.defaultVal || '',
      keySeparator: config.keySeparator || '.',
      interpolate: config.interpolate || /{{([\s\S]+?)}}/g,
      dest: config.dest || '.i18n/{{lng}}/{{ns}}.json',
    }
  })())
 }

function run(loc) {
  const config = getConfig()
  glob(`${loc}/**/*.{js, jsx}`, { ignore: config.exclude.map(pattern => `${loc}/${pattern}`)}, (error, files) => {
    files.forEach(filename => {
      if (filename.includes('node_modules')) return
      if (filename.indexOf('_') !== -1) return
      transformFileSync(filename, {
        presets: [require.resolve('babel-preset-umi')],
        plugins: [scan]
      })
    })
    let isNone = true
    config.lngs.forEach(lng => {
      const loc = path.relative(process.cwd(), template(config.dest, { interpolate: config.interpolate })({ lng, ns: config.ns }))
      let prefix = loc
      const oldTranslations = existJsonFile(loc)
      const newTranslations = saveJsonFile(loc, scannedKeyList)
      const diffLines = diff.diffJson(oldTranslations, newTranslations)
      diffLines.forEach(line => {
        if (line.value != null && line.added != null || line.removed != null) {
          isNone = false
          const color = line.added === true ? 'green' : 'red'
          const diffSymbol = line.added === true ? '+' : '-'
          console.log(chalk.keyword(color)(prefix + '\n' + diffSymbol + ' ' + line.value))
          prefix = ''
       }
      })
    })
    isNone && console.log('Pick result: Noting')
  })
}

function referencesImport(loc, mod, importedNames) {
  if (!(loc.isIdentifier() || loc.isJSXIdentifier())) {
    return false;
  }
  return importedNames.some((name) => loc.referencesImport(mod, name));
}

function existJsonFile (loc) {
  const exist = existsSync(loc)
  let translations = {}
  if (exist) {
    try {
      translations = JSON.parse(readFileSync(loc))
    } catch (e) {}
  }
  return translations
}

function saveJsonFile(loc, newKeys) {
  const config = getConfig()
  const oldTranslations = existJsonFile(loc)
  let newTranslations = mapKeys(oldTranslations, (v, k) => {
    if (config.removeUnusedKey === false) {
      const nk = k.replace(new RegExp('^' + config.dirtyPrefix), '')
      if (!includes(newKeys, nk)) {
        return config.dirtyPrefix + nk
      }
      return nk
    }
    return k
  })
  newKeys.forEach(k => newTranslations[k] == null && (newTranslations[k] = config.defaultVal))

  if (config.removeUnusedKey === true) newTranslations = pick(newTranslations, scannedKeyList)
  if (config.sort === true) {
    newTranslations = chain(newTranslations).toPairs().sortBy(0).fromPairs().value()
  }
  const dirtyTranslations = pickBy(newTranslations, (v, k) => startsWith(k, config.dirtyPrefix))
  newTranslations = merge({}, dirtyTranslations, omit(newTranslations, keys(dirtyTranslations)))
  mkdirp.sync(path.dirname(loc))
  writeFileSync(loc, JSON.stringify(newTranslations, null, 2))
  return newTranslations
}


function scan({ types: t }) {
  return {
    visitor: {
      CallExpression (path, state) {
        const config = getConfig()
        if (referencesImport(path.get('callee'), config.moduleSourceName, config.format.funcList)){
          const args = path.get('arguments')
          if (!t.isStringLiteral(args[0])) return
          const key = get(args, '[0].node.value', null)
          if (key != null) {
            scannedKeyList = uniq(scannedKeyList.concat([key]))
          }
        }
      }
    }
  }
}

program.parse(process.argv)
run(program.args[0] || '.')
