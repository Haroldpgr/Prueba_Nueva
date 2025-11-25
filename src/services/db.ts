import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'

type DB = {
  ready: boolean
  instance: any
}

let db: DB = { ready: false, instance: null }

export function initDB() {
  try {
    const Database = require('better-sqlite3')
    const file = path.join(app.getPath('userData'), 'drk.sqlite')
    db.instance = new Database(file)
    db.instance.pragma('journal_mode = WAL')
    db.instance.exec(`
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        name TEXT,
        version TEXT,
        loader TEXT,
        createdAt INTEGER,
        path TEXT,
        ramMb INTEGER,
        userProfile TEXT
      );
      CREATE TABLE IF NOT EXISTS crashes (
        id TEXT PRIMARY KEY,
        instanceId TEXT,
        createdAt INTEGER,
        summary TEXT,
        logPath TEXT,
        recommendation TEXT
      );
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT,
        ip TEXT,
        country TEXT,
        category TEXT,
        thumbnail TEXT,
        requiredVersion TEXT,
        modsHint TEXT,
        favorite INTEGER
      );
    `)
    db.ready = true
  } catch (e) {
    db.ready = false
  }
}

export function hasDB() { return db.ready }
export function sqlite() { return db.instance }
