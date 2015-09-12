import { readdir as nReaddir } from 'fs'
import { promisify } from 'bluebird'
import { join } from 'path'
import { uniqueId, includes } from 'lodash'

let readdir = promisify(nReaddir)

export default function randPath(dir, pattern = ':rand') {
  let file = pattern
    .replace(/:rand/g, uniqueId())

  return readdir(dir).then(ls => includes(ls, file)
      ? randPath(dir, pattern)
      : join(dir, file))
}
