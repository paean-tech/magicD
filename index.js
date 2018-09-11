#!/usr/bin/env node

const program = require('commander')
const glob = require('glob')
const path = require('path')
const transformFileSync = require('@babel/core').transformFileSync

function getConfig() {
  let config = {}
  try {
    config = require(path.join(process.cwd(), 'i18n.config.json'));
  } catch (e) {
    console.error(e)
  }
  return config
}

function run(path) {
  const config = getConfig()
  const exclude = config.exclude || []
  glob(`${path}/**/*.{js, jsx}`, { ignore: exclude.map(pattern => `${path}/${pattern}`)}, (error, files) => {
    files.forEach(filename => {
      if (filename.includes('node_modules')) return
      if (filename.indexOf('_') !== -1) return
      transformFileSync(filename, {
        presets: [require.resolve('babel-preset-umi')],
        plugins: [
          ['babel-plugin-magicd', Object.assign({}, config)]
        ]
      })
    })

  })
}
program.parse(process.argv)
run(program.args[0] || '.')
