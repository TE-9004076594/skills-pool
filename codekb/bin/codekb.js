#!/usr/bin/env node
/**
 * CodeKB CLI 入口
 * 用法: codekb <command> [options]
 */
import { runCli } from '../src/cli/index.js';

runCli(process.argv.slice(2)).catch((err) => {
  console.error(`\n✗ ${err.message || err}`);
  process.exit(1);
});
