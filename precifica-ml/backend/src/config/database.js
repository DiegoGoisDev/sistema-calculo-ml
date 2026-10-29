import fs from 'fs/promises';
import path from 'path';
import env from './env.js';
import { criarDadosIniciais } from './defaults.js';

/**
 * Armazenamento simples em arquivo JSON.
 * As escritas passam por uma fila para nunca se sobreporem,
 * e são gravadas em um arquivo temporário antes de substituir o original.
 * Para trocar por um banco de dados, mantenha a mesma interface: read() e update(fn), ambas async.
 */
class JsonDatabase {
  constructor(file) {
    this.file = file;
    this.data = null;
    this.queue = Promise.resolve();
  }

  async init() {
    try {
      this.data = JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.data = criarDadosIniciais();
      await this.persist();
    }
  }

  async read() {
    return structuredClone(this.data);
  }

  async update(mutator) {
    const run = async () => {
      const draft = structuredClone(this.data);
      const result = await mutator(draft);
      this.data = draft;
      await this.persist();
      return result;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => {});
    return next;
  }

  async persist() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.data, null, 2));
    await fs.rename(tmp, this.file);
  }
}

export default new JsonDatabase(env.dataFile);
