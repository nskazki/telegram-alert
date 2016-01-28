'use strict'

import 'babel-polyfill'

import { isString, merge, isEqual } from 'lodash'
import { inspect }from 'util'
import { resolve } from 'path'
import natan from 'natan'
import commander from 'commander'
import P from 'bluebird'
import Logger from 'bellman'
import Server from './Server'

let toBool = v => /true/i.test(v)
let cResolve = p => resolve(process.cwd(), p)
let cInspect = v => inspect(v, { depth: null, colors: true })

let cliParams = commander
  .allowUnknownOption()
  .usage('[options]')
  .option('-c, --config <path>',
    'set config path.', cResolve)
  .option('-v, --verbose <level>',
    'set console logger verbose level.', /^(debug|info|warn|error)$/i)
  .option('-p, --print-config <bool>',
    'print config before start', toBool)
  .option('-e, --print-and-exit <bool>',
    'print config and exit', toBool)
  .parse(process.argv)

if (!isString(cliParams.config)) {
  commander.help()
  process.reallyExit(0)
}

let fsConfig = natan(cliParams.config)
let clConfig = { logger: { levelMin: cliParams.verbose } }
let config = merge(fsConfig, clConfig)

if (isEqual(cliParams.printAndExit, true)) {
  console.info('%s\n', cInspect(config))
  process.reallyExit(0)
} else if (isEqual(cliParams.printConfig, true)) {
  console.info('%s\n', cInspect(config))
}

let logger = new Logger(config.logger).reg()

process.on('uncaughtException', (err) => {
  logger.error('uncaughtException: %s', err)
  process.reallyExit(2)
})

P.try(() => {
  let server = new Server(config, logger)
  return server.init()
}).then(() => {
  logger.info('app server init - success')
}).catch((err) => {
  logger.error('app server init - problem: %s', err)
  process.reallyExit(1)
})
