import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');

const companyOld = "(SELECT COUNT(*)::int FROM clients cl WHERE cl.company_id=c.id AND cl.archived_at IS NULL) AS total_clients";
const companyNew = companyOld + ", (SELECT COUNT(*)::int FROM clients cl JOIN users u ON u.id=cl.user_id WHERE cl.company_id=c.id AND cl.archived_at IS NULL AND u.active=false) AS paused_clients";
source = source.replace(companyOld, companyNew);

const countsOld = "(SELECT COUNT(*)::int FROM clients cl JOIN companies c ON c.id=cl.company_id WHERE c.archived_at IS NULL AND cl.archived_at IS NULL) AS clients";
const countsNew = countsOld + ", (SELECT COUNT(*)::int FROM clients cl JOIN companies c ON c.id=cl.company_id JOIN users u ON u.id=cl.user_id WHERE c.archived_at IS NULL AND cl.archived_at IS NULL AND u.active=false) AS paused_clients";
source = source.replace(countsOld, countsNew);

const companyCountsOld = "(SELECT COUNT(*)::int FROM clients WHERE company_id=$1 AND archived_at IS NULL) AS clients,(SELECT COUNT(*)::int FROM incidents WHERE company_id=$1 AND status<>'Incident Resolved') AS open_incidents";
const companyCountsNew = "(SELECT COUNT(*)::int FROM clients WHERE company_id=$1 AND archived_at IS NULL) AS clients,(SELECT COUNT(*)::int FROM clients cl JOIN users u ON u.id=cl.user_id WHERE cl.company_id=$1 AND cl.archived_at IS NULL AND u.active=false) AS paused_clients,(SELECT COUNT(*)::int FROM incidents WHERE company_id=$1 AND status<>'Incident Resolved') AS open_incidents";
source = source.replace(companyCountsOld, companyCountsNew);

const staticLine = "app.use(express.static(path.resolve(here,'../public'),{index:'index.html',maxAge:0}));";
const appDownloadRoutes = `
app.get(['/app','/app/','/download','/download/'], (_req,res) => {
  res.type('html').send(\`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#071226"><meta name="description" content="Official ES 24/7 Client App download"><title>ES 24/7 Client App</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Arial,sans-serif;background:linear-gradient(160deg,#071226,#0c1c35);color:#fff;display:flex;align-items:center;justify-content:center;padding:24px}.card{width:min(500px,100%);background:#101d36;border:1px solid rgba(255,255,255,.14);border-radius:26px;padding:36px 30px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.4)}.logo{width:86px;height:86px;border-radius:22px;object-fit:cover;margin-bottom:18px}.brand{font-size:32px;font-weight:800;margin:0 0 8px}.subtitle{font-size:17px;line-height:1.55;opacity:.84;margin:0 0 28px}.button{display:block;width:100%;padding:17px 20px;border:0;border-radius:15px;background:#e53935;color:#fff;font-size:19px;font-weight:800;text-decoration:none;cursor:pointer;box-shadow:0 8px 24px rgba(229,57,53,.28)}.button:active{transform:translateY(1px)}.secure{margin-top:22px;font-size:12px;line-height:1.5;opacity:.58}.secure strong{color:#fff;opacity:.9}</style></head><body><main class="card"><img class="logo" src="/app-icon.png" alt="ES 24/7" onerror="this.style.display='none'"><h1 class="brand">ES 24/7</h1><p class="subtitle">Official Client App<br>Secure emergency assistance and location sharing.</p><a class="button" href="/app/download">Install ES 24/7 App</a><p class="secure">Official secure download<br><strong>securitysolutionses247.co.za</strong></p></main></body></html>\`);
});
app.get('/app/download', async (_req,res) => {
  try {
    const response = await fetch('https://github.com/globalenglishacademyonlineptyltd/es247-andriod/releases/download/android-latest/app-release.apk',{redirect:'follow',cache:'no-store'});
    if(!response.ok) return res.status(502).send('The ES 24/7 app download is temporarily unavailable. Please try again.');
    const data = await response.arrayBuffer();
    res.setHeader('Content-Type','application/vnd.android.package-archive');
    res.setHeader('Content-Disposition','attachment; filename="ES-24-7-App.apk"');
    res.setHeader('Content-Length',String(data.byteLength));
    res.setHeader('Cache-Control','no-store');
    res.send(Buffer.from(data));
  } catch (e) {
    console.error('App download failed:',e.message);
    res.status(502).send('The ES 24/7 app download is temporarily unavailable. Please try again.');
  }
});`;
source = source.replace(staticLine, staticLine + appDownloadRoutes);

fs.writeFileSync(serverPath, source);
await import('./server.js');
