import { Database as DatabaseInstance } from 'better-sqlite3';
import { getDatabase } from '../database/index.js';

export abstract class BaseRepository {
  protected get db(): DatabaseInstance {
    return getDatabase();
  }
}
