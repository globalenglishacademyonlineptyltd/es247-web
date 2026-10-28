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
  res.type('html').send(\`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#071226"><meta name="description" content="Official ES 24/7 Client App download"><title>ES 24/7 Client App</title><style>:root{color-scheme:dark}*{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%;background:#071226;color:#fff;font-family:Arial,sans-serif}body{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:18px 16px;overflow:hidden}.card{width:min(520px,100%);background:linear-gradient(145deg,#13223c,#0b1528);border:1px solid rgba(255,255,255,.12);border-radius:28px;padding:26px 28px 24px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.48)}.logo{display:block;width:min(210px,58vw);height:auto;max-height:150px;object-fit:contain;margin:0 auto 12px;border-radius:4px}.brand{font-size:clamp(28px,7vw,38px);line-height:1.08;font-weight:800;margin:0 0 10px}.subtitle{font-size:clamp(16px,4.2vw,19px);line-height:1.45;opacity:.82;margin:0 0 24px}.button{display:flex;align-items:center;justify-content:center;width:100%;min-height:58px;padding:15px 20px;border:0;border-radius:16px;background:linear-gradient(145deg,#ff3145,#c8081d);color:#fff;font-size:clamp(17px,4.5vw,20px);font-weight:800;cursor:pointer;text-decoration:none;box-shadow:inset 0 2px 0 rgba(255,255,255,.3),0 7px 0 #78000d,0 16px 28px rgba(0,0,0,.35)}.button:active{transform:translateY(5px);box-shadow:inset 0 2px 0 rgba(255,255,255,.25),0 2px 0 #78000d,0 8px 16px rgba(0,0,0,.3)}.status{min-height:22px;margin-top:15px;font-size:14px;opacity:.78}.note{margin:22px 0 0;font-size:12px;line-height:1.5;opacity:.58}.domain{font-weight:700;word-break:break-word}@media (max-height:700px){body{padding:10px 14px}.card{padding:18px 22px 16px;border-radius:24px}.logo{width:min(165px,48vw);max-height:105px;margin-bottom:7px}.brand{font-size:28px;margin-bottom:7px}.subtitle{font-size:15px;margin-bottom:17px}.button{min-height:52px;padding:12px 16px}.status{margin-top:11px}.note{margin-top:15px}}</style></head><body><main class="card"><img class="logo" src="/ChatGPT%20Image%20Oct%2028%2C%202026%2C%2012_54_29%20PM.png?v=es247-logo-20261028" alt="Emergency Service 24/7"><h1 class="brand">Emergency Service 24/7</h1><p class="subtitle">Official ES 24/7 Client App<br>Secure emergency assistance and location sharing.</p><a class="button" id="download" href="/app/download">Download ES 24/7 App</a><div class="status" id="status">Official app download</div><p class="note">Official app download<br><span class="domain">securitysolutionses247.co.za</span></p></main><script>document.getElementById('download').addEventListener('click',function(){document.getElementById('status').textContent='Preparing the secure download...';});</script></body></html>\`);
});
app.get('/app/download', async (_req,res) => {
  try {
    const response = await fetch('https://github.com/globalenglishacademyonlineptyltd/es247-andriod/releases/latest/download/ES-24-7-Client-App.apk',{redirect:'follow',cache:'no-store'});
    if(!response.ok) return res.status(502).send('The ES 24/7 app download is temporarily unavailable. Please try again.');
    const data = await response.arrayBuffer();
    res.setHeader('Content-Type','application/vnd.android.package-archive');
    res.setHeader('Content-Disposition','attachment; filename="ES-24-7-Client-App.apk"');
    res.setHeader('Content-Length',String(data.byteLength));
    res.setHeader('Cache-Control','no-store');
    res.send(Buffer.from(data));
  } catch (e) {
    console.error('App download failed:',e.message);
    res.status(502).send('The ES 24/7 app download is temporarily unavailable. Please try again.');
  }
});`;

// Keep the download page routes ahead of express.static so the legacy /app/index.html
// can never intercept the professional download page or APK endpoint.
source = source.replace(staticLine, appDownloadRoutes + '\n' + staticLine);

fs.writeFileSync(serverPath, source);
await import('./server.js');
