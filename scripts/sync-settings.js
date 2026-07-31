import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const SCRIPT_NAME = path.parse(fileURLToPath(import.meta.url)).name;

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = pkg.version || "";
const description = pkg.description || "";
const author = pkg.author || "";
const license = pkg.license || "";
const { productName, identifier } = pkg.appConfig || {};

// tauri.conf.json の更新
const tauriConfPath = './src-tauri/tauri.conf.json';
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  
  if (productName) {
    tauriConf.productName = productName;
    if (tauriConf.app?.windows?.[0]) {
      tauriConf.app.windows[0].title = productName;
    }
  }
  if (identifier) {
    tauriConf.identifier = identifier;
  }
  
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
}

// Cargo.toml の設定を更新
const cargoPath = './src-tauri/Cargo.toml';
if (fs.existsSync(cargoPath)) {
  let cargo = fs.readFileSync(cargoPath, 'utf8');
  cargo = cargo.replace(/^authors = \[.*?\]/m, `authors = ["${author}"]`);
  cargo = cargo.replace(/^description = ".*?"/m, `description = "${description}"`);
  cargo = cargo.replace(/^license = ".*?"/m, `license = "${license}"`);
  cargo = cargo.replace(/^name = ".*?"/m, `name = "${productName}"`);
  cargo = cargo.replace(/^version = ".*?"/m, `version = "${version}"`);
  fs.writeFileSync(cargoPath, cargo);
}

// Cargo.lock の自動更新
try {
  execSync('cargo check --quiet', { cwd: './src-tauri', stdio: 'ignore' });
} catch (e) {
  console.warn(`[${SCRIPT_NAME}][ERROR] Cargo.lock の更新に失敗しました`);
}

// package-lock.json の自動更新
try {
  execSync('npm install --package-lock-only', { stdio: 'ignore' });
} catch (e) {
  console.warn(`[${SCRIPT_NAME}][ERROR] package-lock.json の更新に失敗しました`);
}

console.log(`[${SCRIPT_NAME}] Settings synced (version: ${version})`);