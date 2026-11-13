const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
execFileSync(process.platform==='win32'?'npx.cmd':'npx',['cap','sync','android'],{cwd:root,stdio:'inherit'});
const assets=path.join(root,'android/app/src/androidTest/assets');
fs.mkdirSync(assets,{recursive:true});
for(const name of ['sealed-v1.writely','book-bundle-v1.writely']) fs.copyFileSync(path.join(root,'tests/fixtures',name),path.join(assets,name));

const licenses=path.join(root,'android/app/src/main/assets/licenses');
fs.cpSync(path.join(root,'licenses'),licenses,{recursive:true});
fs.copyFileSync(path.join(root,'THIRD_PARTY_NOTICES.md'),path.join(root,'android/app/src/main/assets/THIRD_PARTY_NOTICES.md'));
