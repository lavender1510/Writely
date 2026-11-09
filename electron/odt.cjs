// The same ODF writer runs in Electron and Android.
async function exportOdt(document){return Buffer.from(await require('../core/odt-export.mjs').exportOdt(document));}
module.exports={exportOdt};
