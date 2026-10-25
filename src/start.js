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

fs.writeFileSync(serverPath, source);
await import('./server.js');
