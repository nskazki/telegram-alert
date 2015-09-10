'use strict'

import { has, findKey, keys, values } from 'lodash'
import { debugMethods } from 'simple-debugger'
import { readFile as nReadFile, writeFile as nWriteFile, exists as nExists } from 'fs'
import P, { promisify } from 'bluebird'
import { dirname } from 'path'
import nMkdirp from 'mkdirp'

let mkdirp = promisify(nMkdirp)
let writeFile = promisify(nWriteFile)
let readFile = promisify(nReadFile)
let exists = p => new P(resolve => nExists(p, resolve))

export default class FsKV {
  constructor(path) {
    debugMethods(this)

    this.data = {}
    this.path = path
  }

  async init() {
    try {
      if (!await exists(this.path)) return
      await this._read()
    } catch (err) {
      err.message = `FsKV init - problem from ${this.path}: ${err.message}`
      throw err
    }
  }

  async has(key) {
    return has(this.data, key)
  }
  async get(key) {
    if (!await this.has(key))
      throw new Error(`FsKV get - problem by ${key}: key not found`)

    return this.data[key]
  }
  async set(key, value) {
    this.data[key] = value
    return await this._write()
  }
  async delete(key) {
    if (!await this.has(key))
      throw new Error(`FsKV delete - problem by ${key}: key not found`)

    delete this.data[key]
    return await this._write()
  }
  async size() {
    return keys(this.data).length
  }

  async hasByValue(value) {
    return values(this.data).some(v => v === value)
  }
  async getByValue(value) {
    if (!await this.hasByValue(value))
      throw new Error(`FsKV getByValue - problem by ${value}: value not found`)

    return findKey(this.data, v => v === value)
  }
  async deleteByValue(value) {
    if (!await this.hasByValue(value))
      throw new Error(`FsKV deleteByValue - problem by ${value}: value not found`)

    delete this.data[await this.getByValue(value)]
    return await this._write()
  }

  async _read() {
    let dataStr = await readFile(this.path, 'utf8')
    this.data = JSON.parse(dataStr)
    return this
  }
  async _write() {
    let dataStr = JSON.stringify(this.data)
    let dir = dirname(this.path)
    await mkdirp(dir)
    await writeFile(this.path, dataStr)
    return this
  }
}
