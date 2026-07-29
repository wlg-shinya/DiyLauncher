import fs from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = pkg.version;

// tauri.conf.json のバージョンを更新
const tauriConfPath = './src-tauri/tauri.conf.json';
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = version;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
}

// Cargo.toml のバージョンを更新
const cargoPath = './src-tauri/Cargo.toml';
if (fs.existsSync(cargoPath)) {
  let cargo = fs.readFileSync(cargoPath, 'utf8');
  cargo = cargo.replace(/^version = ".*?"/m, `version = "${version}"`);
  fs.writeFileSync(cargoPath, cargo);
}

// package-lock.json の自動更新
try {
  execSync('npm install --package-lock-only', { stdio: 'ignore' });
} catch (e) {
  console.warn('[sync-version][ERROR] package-lock.json の更新に失敗しました');
}

// Cargo.lock の自動更新
try {
  execSync('cargo check --quiet', { cwd: './src-tauri', stdio: 'ignore' });
} catch (e) {
  console.warn('[sync-version][ERROR] Cargo.lock の更新に失敗しました');
}

console.log(`[sync-version] ${version} synced`);