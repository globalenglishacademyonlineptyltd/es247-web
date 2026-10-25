import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, migrate } from './db.js';
import { authenticate, requireRole, requirePasswordChanged, issueSession, createAccessToken, clearSession, hashPassword, verifyPassword } from './auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc:["'self'"], scriptSrc:["'self'","https://unpkg.com","https://cdnjs.cloudflare.com"],
  styleSrc:["'self'","'unsafe-inline'","https://unpkg.com"],
  imgSrc:["'self'","data:","https://tile.openstreetmap.org","https://*.tile.openstreetmap.org","https://tile.openstreetmap.fr","https://*.basemaps.cartocdn.com","https://server.arcgisonline.com","https://*.arcgisonline.com","https://gibs.earthdata.nasa.gov","https://unpkg.com"],
  connectSrc:["'self'","https://nominatim.openstreetmap.org"], fontSrc:["'self'","https://unpkg.com"]
}}}));
app.use(express.json({limit:'1mb'}));
app.use(cookieParser());
app.use(express.static(path.resolve(here,'../public'),{index:'index.html',maxAge:0}));
const limiter = rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many attempts. Wait 15 minutes and try again.'}});
const email = z.string().trim().email().max(254).transform(v=>v.toLowerCase());
const password = z.string().min(12).max(128);
const companyInput = z.object({
 registered_name:z.string().trim().min(2).max(180), cipc_number:z.string().trim().min(2).max(80),
 psira_number:z.string().trim().min(2).max(80), bbbee_level:z.string().trim().max(80).optional().nullable(),
 contact_number:z.string().trim().min(5).max(40), contact_email:email, temporary_password:password,
 covering_areas:z.string().trim().min(2).max(1000), tax_number:z.string().trim().min(2).max(80),
 vat_number:z.string().trim().max(80).optional().nullable()
});
const statuses = ['Acknowledged','Acknowledged - No Responder Available','Controller Responding','Response Dispatched','Response On Site','Incident Resolved'];
const htmlEscape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isMaster = req => ['master_admin','master_admin_2'].includes(req.user?.role);
const companyScope = req => req.user?.role === 'master_admin_2' ? req.companyContextId : req.user?.company_id;
const requireMaster = (req,res,next) => isMaster(req) ? next() : res.status(403).json({error:'You do not have permission to perform this action.'});
const requireCompanyAccess = (req,res,next) => (req.user?.role === 'controller' || (req.user?.role === 'master_admin_2' && req.companyContextId)) ? next() : res.status(403).json({error:'Select a company workspace first.'});
async function notifyCompanyOnPanic(companyId, incident, locationText) {
 if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
 try {
  const r=await pool.query("SELECT contact_email AS email FROM companies WHERE id=$1 UNION SELECT email FROM users WHERE company_id=$1 AND role='controller' AND active=true",[companyId]);
  const recipients=[...new Set(r.rows.map(x=>x.email).filter(Boolean))];
  if(!recipients.length)return;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({
   from:process.env.RESEND_FROM_EMAIL,to:recipients,subject:'ES 24/7 PANIC ALERT — Incident #'+incident.id,
   html:'<div style="font-family:Arial,sans-serif;line-height:1.6;color:#142137"><h2 style="color:#b42332">Emergency panic alert received</h2><p><strong>Incident:</strong> #'+htmlEscape(incident.id)+'</p><p><strong>Type:</strong> '+htmlEscape(incident.incident_type)+'</p><p><strong>Received:</strong> '+htmlEscape(incident.panic_at)+'</p><p><strong>Location:</strong> '+htmlEscape(locationText||'Location unavailable')+'</p><p>Sign in to the ES 24/7 company workspace to acknowledge and manage this incident.</p></div>'
  })});
  if(!response.ok)console.error('Panic notification email provider returned a non-success response.');
 } catch(e) { console.error('Panic notification could not be sent:',e.message); }
}

app.get('/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,service:'es247-web'});}catch{res.status(503).json({ok:false,service:'es247-web'});}});
app.post('/api/auth/login',limiter,async(req,res,next)=>{
 try{
  const p=z.object({email,password:z.string().min(1).max(128)}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Enter a valid email address and password.'});
  const r=await pool.query('SELECT id,email,password_hash,role,company_id,display_name,must_change_password,active FROM users WHERE email=$1',[p.data.email]);
  const u=r.rows[0];
  if(!u||!u.active||!(await verifyPassword(p.data.password,u.password_hash)))return res.status(401).json({error:'Incorrect email or password.'});if(u.company_id){const co=await pool.query('SELECT archived_at FROM companies WHERE id=$1',[u.company_id]);if(!co.rowCount||co.rows[0].archived_at)return res.status(403).json({error:'Your company account is archived or unavailable. Contact the master administrator.'});}
  issueSession(res,u);res.json({user:{id:u.id,email:u.email,role:u.role,company_id:u.company_id,display_name:u.display_name,must_change_password:u.must_change_password}});
 }catch(e){next(e);}
});
app.post('/api/mobile/auth/login',limiter,async(req,res,next)=>{
 try{
  const p=z.object({email,password:z.string().min(1).max(128)}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Enter a valid email address and password.'});
  const r=await pool.query('SELECT id,email,password_hash,role,company_id,display_name,must_change_password,active FROM users WHERE email=$1',[p.data.email]);
  const u=r.rows[0];if(!u||!u.active||!(await verifyPassword(p.data.password,u.password_hash)))return res.status(401).json({error:'Incorrect email or password.'});if(u.company_id){const co=await pool.query('SELECT archived_at FROM companies WHERE id=$1',[u.company_id]);if(!co.rowCount||co.rows[0].archived_at)return res.status(403).json({error:'Your company account is archived or unavailable. Contact the master administrator.'});}
  if(u.role!=='client')return res.status(403).json({error:'Mobile sign-in is for client accounts only.'});
  res.json({access_token:createAccessToken(u),token_type:'Bearer',expires_in:28800,user:{id:u.id,email:u.email,role:u.role,company_id:u.company_id,display_name:u.display_name,must_change_password:u.must_change_password}});
 }catch(e){next(e);}
});
app.post('/api/mobile/auth/change-password',authenticate,async(req,res,next)=>{
 try{
  if(req.user.role!=='client')return res.status(403).json({error:'Mobile password changes are for client accounts only.'});
  const p=z.object({current_password:z.string().min(1).max(128),new_password:password}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'New password must contain at least 12 characters.'});
  const r=await pool.query('SELECT password_hash FROM users WHERE id=$1',[req.user.id]);
  if(!r.rowCount||!(await verifyPassword(p.data.current_password,r.rows[0].password_hash)))return res.status(400).json({error:'Current password is incorrect.'});
  await pool.query('UPDATE users SET password_hash=$1,must_change_password=false WHERE id=$2',[await hashPassword(p.data.new_password),req.user.id]);
  res.json({ok:true,message:'Password updated successfully.'});
 }catch(e){next(e);}
});
app.post('/api/auth/logout',(_req,res)=>{clearSession(res);res.json({ok:true});});
app.get('/api/me',authenticate,(req,res)=>res.json({user:req.user}));
app.post('/api/auth/change-password',authenticate,async(req,res,next)=>{
 try{
  const p=z.object({current_password:z.string().min(1).max(128),new_password:password}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'New password must contain at least 12 characters.'});
  const r=await pool.query('SELECT password_hash FROM users WHERE id=$1',[req.user.id]);
  if(!r.rowCount||!(await verifyPassword(p.data.current_password,r.rows[0].password_hash)))return res.status(400).json({error:'Current password is incorrect.'});
  await pool.query('UPDATE users SET password_hash=$1,must_change_password=false WHERE id=$2',[await hashPassword(p.data.new_password),req.user.id]);
  res.json({ok:true});
 }catch(e){next(e);}
});
app.post('/api/auth/forgot-password',limiter,async(req,res,next)=>{
 try{
  const p=z.object({email}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Enter a valid email address.'});
  const found=await pool.query('SELECT id,email,display_name FROM users WHERE email=$1 AND active=true',[p.data.email]);
  if(found.rowCount&&process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL&&process.env.APP_BASE_URL){
   const u=found.rows[0],token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex');
   await pool.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',[u.id]);
   await pool.query("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 minutes')",[u.id,hash]);
   const link=process.env.APP_BASE_URL.replace(/\/$/,'')+'/?reset='+encodeURIComponent(token);
   const safeName=String(u.display_name||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[u.email],subject:'Reset your ES 24/7 password',html:'<h2>Reset your ES 24/7 password</h2><p>Hello '+safeName+',</p><p>This single-use link expires in 30 minutes.</p><p><a href="'+link+'">Reset password</a></p>'})});
   if(!sent.ok)await pool.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE token_hash=$1',[hash]);
  }
  res.json({message:'If an active account exists for that email, password-reset instructions will be sent.'});
 }catch(e){next(e);}
});
app.post('/api/auth/reset-password',limiter,async(req,res,next)=>{
 const db=await pool.connect();
 try{
  const p=z.object({token:z.string().min(20).max(200),new_password:password}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'The reset link or new password is invalid.'});
  const tokenHash=createHash('sha256').update(p.data.token).digest('hex');await db.query('BEGIN');
  const t=await db.query('SELECT id,user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE',[tokenHash]);
  if(!t.rowCount){await db.query('ROLLBACK');return res.status(400).json({error:'This reset link is invalid or expired. Request a new one.'});}
  await db.query('UPDATE users SET password_hash=$1,must_change_password=false WHERE id=$2',[await hashPassword(p.data.new_password),t.rows[0].user_id]);
  await db.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',[t.rows[0].user_id]);
  await db.query('COMMIT');res.json({ok:true,message:'Password reset successfully. You can now sign in.'});
 }catch(e){await db.query('ROLLBACK').catch(()=>{});next(e);}finally{db.release();}
});

app.use('/api',authenticate,requirePasswordChanged,(req,res,next)=>{
 const context=req.get('x-company-context');
 if(!context)return next();
 if(req.user.role!=='master_admin_2')return res.status(403).json({error:'Company workspace switching is restricted.'});
 if(!/^\d+$/.test(context))return res.status(400).json({error:'Invalid company workspace.'});
 pool.query('SELECT id FROM companies WHERE id=$1 AND archived_at IS NULL',[context]).then(r=>{
  if(!r.rowCount)return res.status(404).json({error:'Active company not found.'});
  req.companyContextId=Number(context);next();
 }).catch(next);
});
app.get('/api/dashboard',async(req,res,next)=>{
 try{
  if(req.user.role==='master_admin' || (req.user.role==='master_admin_2' && !req.companyContextId)){
   const companies=await pool.query(`SELECT c.id,c.registered_name,c.cipc_number,c.psira_number,c.bbbee_level,c.contact_number,c.contact_email,c.covering_areas,c.tax_number,c.vat_number,c.created_at,(SELECT COUNT(*)::int FROM clients cl WHERE cl.company_id=c.id AND cl.archived_at IS NULL) AS total_clients FROM companies c WHERE c.archived_at IS NULL ORDER BY c.registered_name`);
   const archived=await pool.query('SELECT id,registered_name,archived_at FROM companies WHERE archived_at IS NOT NULL ORDER BY archived_at DESC');
   const counts=await pool.query("SELECT (SELECT COUNT(*)::int FROM companies WHERE archived_at IS NULL) AS companies,(SELECT COUNT(*)::int FROM clients cl JOIN companies c ON c.id=cl.company_id WHERE c.archived_at IS NULL AND cl.archived_at IS NULL) AS clients");
   return res.json({role:req.user.role,companies:companies.rows,archived:archived.rows,counts:counts.rows[0]});
  }
  if(req.user.role==='controller' || (req.user.role==='master_admin_2' && req.companyContextId)){
   const scope=companyScope(req);
   const c=await pool.query('SELECT id,registered_name,covering_areas FROM companies WHERE id=$1 AND archived_at IS NULL',[scope]);
   if(!c.rowCount)return res.status(403).json({error:'Your company is unavailable. Contact the platform administrator.'});
   const counts=await pool.query("SELECT (SELECT COUNT(*)::int FROM clients WHERE company_id=$1 AND archived_at IS NULL) AS clients,(SELECT COUNT(*)::int FROM incidents WHERE company_id=$1 AND status<>'Incident Resolved') AS open_incidents",[scope]);
   return res.json({role:'controller',company:c.rows[0],counts:counts.rows[0],workspace_admin:req.user.role==='master_admin_2'});
  }
  const r=await pool.query('SELECT id,incident_type,status,location_text,panic_at,updated_at FROM incidents WHERE client_id=(SELECT id FROM clients WHERE user_id=$1) ORDER BY panic_at DESC LIMIT 100',[req.user.id]);
  res.json({role:req.user.role,incidents:r.rows});
 }catch(e){next(e);}
});
app.post('/api/master/companies',requireMaster,async(req,res,next)=>{
 const db=await pool.connect();
 try{
  const p=companyInput.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Please complete all required company fields. The temporary password must contain at least 12 characters.',details:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  const d=p.data;
  await db.query('BEGIN');
  const r=await db.query('INSERT INTO companies(registered_name,cipc_number,psira_number,bbbee_level,contact_number,contact_email,covering_areas,tax_number,vat_number) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,registered_name',[d.registered_name,d.cipc_number,d.psira_number,d.bbbee_level||null,d.contact_number,d.contact_email,d.covering_areas,d.tax_number,d.vat_number||null]);
  const controller=await db.query("INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password) VALUES($1,$2,'controller',$3,$4,true) RETURNING id,email,display_name,company_id",[d.contact_email,await hashPassword(d.temporary_password),r.rows[0].id,d.registered_name]);
  await db.query('COMMIT');
  res.status(201).json({company:r.rows[0],controller:controller.rows[0],message:'Company registered. The company login uses the contact email and must change the temporary password at first sign-in.'});
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(e.code==='23505')return res.status(409).json({error:'CIPC number or PSIRA number already exists, or the contact email is already registered as a user.'});next(e);}finally{db.release();}
});
app.post('/api/master/companies/:id/controllers',requireMaster,async(req,res,next)=>{
 try{
  const p=z.object({display_name:z.string().trim().min(2).max(160),email,password}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Enter a name, valid email and temporary password of at least 12 characters.'});
  const co=await pool.query('SELECT id FROM companies WHERE id=$1 AND archived_at IS NULL',[req.params.id]);if(!co.rowCount)return res.status(404).json({error:'Active company not found.'});
  const r=await pool.query("INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password) VALUES($1,$2,'controller',$3,$4,true) RETURNING id,email,display_name,company_id",[p.data.email,await hashPassword(p.data.password),req.params.id,p.data.display_name]);
  res.status(201).json({controller:r.rows[0]});
 }catch(e){if(e.code==='23505')return res.status(409).json({error:'That email is already in use.'});next(e);}
});
app.post('/api/master/clients',requireMaster,async(req,res,next)=>{
 const db=await pool.connect();
 try{
  const p=z.object({company_id:z.coerce.number().int().positive(),full_name:z.string().trim().min(2).max(160),email,phone:z.string().trim().min(5).max(40).optional().nullable(),alternate_phone:z.string().trim().max(40).optional().nullable(),address:z.string().trim().max(500).optional().nullable(),latitude:z.coerce.number().min(-90).max(90).optional().nullable(),longitude:z.coerce.number().min(-180).max(180).optional().nullable(),vehicles:z.array(z.object({make:z.string().trim().max(100).optional().default(''),color:z.string().trim().max(80).optional().default(''),registration:z.string().trim().max(40).optional().default(''),vin:z.string().trim().max(100).optional().default('')})).max(10).optional().default([]),app_download_url:z.string().url().max(1000).optional().nullable(),temporary_password:password}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Complete required client fields. Temporary passwords must have at least 12 characters.',details:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  const d=p.data;const co=await db.query('SELECT id FROM companies WHERE id=$1 AND archived_at IS NULL',[d.company_id]);if(!co.rowCount)return res.status(404).json({error:'Active company not found.'});
  await db.query('BEGIN');const u=await db.query("INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password) VALUES($1,$2,'client',$3,$4,true) RETURNING id,email,display_name",[d.email,await hashPassword(d.temporary_password),d.company_id,d.full_name]);
  const c=await db.query('INSERT INTO clients(company_id,user_id,full_name,phone,alternate_phone,email,address,latitude,longitude,vehicles,app_download_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) RETURNING id,full_name,email',[d.company_id,u.rows[0].id,d.full_name,d.phone||null,d.alternate_phone||null,d.email,d.address||null,d.latitude??null,d.longitude??null,JSON.stringify(d.vehicles||[]),d.app_download_url||null]);
  await db.query('COMMIT');res.status(201).json({client:c.rows[0],message:'Client created. Share the temporary password securely; it must be changed at first sign-in.'});
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(e.code==='23505')return res.status(409).json({error:'That email is already in use.'});next(e);}finally{db.release();}
});
app.get('/api/master/active-companies',requireMaster,async(_req,res,next)=>{try{const r=await pool.query('SELECT id,registered_name FROM companies WHERE archived_at IS NULL ORDER BY registered_name');res.json({companies:r.rows});}catch(e){next(e);}});
app.post('/api/master/companies/:id/archive',requireMaster,async(req,res,next)=>{try{const r=await pool.query('UPDATE companies SET archived_at=NOW() WHERE id=$1 AND archived_at IS NULL RETURNING id',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Active company not found.'});res.json({ok:true});}catch(e){next(e);}});
app.post('/api/master/companies/:id/restore',requireMaster,async(req,res,next)=>{try{const r=await pool.query('UPDATE companies SET archived_at=NULL WHERE id=$1 AND archived_at IS NOT NULL RETURNING id',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Archived company not found.'});res.json({ok:true});}catch(e){next(e);}});
app.delete('/api/master/companies/:id',requireMaster,async(req,res,next)=>{try{
 const co=await pool.query('SELECT id FROM companies WHERE id=$1 AND archived_at IS NOT NULL',[req.params.id]);if(!co.rowCount)return res.status(404).json({error:'Archive the company before permanent deletion.'});
 const counts=await pool.query('SELECT (SELECT COUNT(*)::int FROM users WHERE company_id=$1) AS users,(SELECT COUNT(*)::int FROM clients WHERE company_id=$1) AS clients,(SELECT COUNT(*)::int FROM incidents WHERE company_id=$1) AS incidents',[req.params.id]);
 const c=counts.rows[0];if(c.users||c.clients||c.incidents)return res.status(409).json({error:'This company has linked users, clients or incidents. Its history must be retained; keep it archived instead.'});
 await pool.query('DELETE FROM companies WHERE id=$1',[req.params.id]);res.json({ok:true});
 }catch(e){next(e);}});
app.get('/api/company/clients',requireCompanyAccess,async(req,res,next)=>{try{const r=await pool.query("SELECT c.id,c.full_name,c.phone,c.alternate_phone,c.email,c.address,c.latitude,c.longitude,c.vehicles,c.family_group_id,c.app_download_url,c.created_at,COALESCE(u.active,true) AS active,(SELECT COUNT(*)::int FROM clients fam WHERE fam.family_group_id=c.id OR fam.id=c.id) AS family_count FROM clients c LEFT JOIN users u ON u.id=c.user_id WHERE c.company_id=$1 AND c.archived_at IS NULL ORDER BY c.full_name",[companyScope(req)]);res.json({clients:r.rows});}catch(e){next(e);}});
app.get('/api/company/clients/archived',requireCompanyAccess,async(req,res,next)=>{try{const r=await pool.query("SELECT c.id,c.full_name,c.phone,c.email,c.address,c.created_at,c.archived_at FROM clients c WHERE c.company_id=$1 AND c.archived_at IS NOT NULL ORDER BY c.archived_at DESC",[companyScope(req)]);res.json({clients:r.rows});}catch(e){next(e);}});
app.post('/api/company/clients/:id/pause',requireCompanyAccess,async(req,res,next)=>{try{const r=await pool.query("UPDATE users SET active=false WHERE id=(SELECT user_id FROM clients WHERE id=$1 AND company_id=$2 AND archived_at IS NULL) RETURNING id",[req.params.id,companyScope(req)]);if(!r.rowCount)return res.status(404).json({error:'Active client not found.'});res.json({ok:true,active:false});}catch(e){next(e);}});
app.post('/api/company/clients/:id/unpause',requireCompanyAccess,async(req,res,next)=>{try{const r=await pool.query("UPDATE users SET active=true WHERE id=(SELECT user_id FROM clients WHERE id=$1 AND company_id=$2 AND archived_at IS NULL) RETURNING id",[req.params.id,companyScope(req)]);if(!r.rowCount)return res.status(404).json({error:'Active client not found.'});res.json({ok:true,active:true});}catch(e){next(e);}});
app.post('/api/master/clients/:id/archive',requireMaster,async(req,res,next)=>{try{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid client.'});const params=[id];let scope='';if(req.user.role==='master_admin_2'){if(!req.companyContextId)return res.status(403).json({error:'Select a company before archiving a client.'});params.push(req.companyContextId);scope=' AND company_id=$2';}const r=await pool.query("UPDATE clients SET archived_at=NOW() WHERE id=$1"+scope+" AND archived_at IS NULL RETURNING id,user_id",params);if(!r.rowCount)return res.status(404).json({error:'Active client not found in the selected company.'});if(r.rows[0].user_id)await pool.query('UPDATE users SET active=false WHERE id=$1',[r.rows[0].user_id]);res.json({ok:true,message:'Client archived. The client remains in the company archived-clients list.'});}catch(e){next(e);}});
app.post('/api/company/clients',requireCompanyAccess,async(req,res,next)=>{
 const db=await pool.connect();try{
  const p=z.object({full_name:z.string().trim().min(2).max(160),email,phone:z.string().trim().min(5).max(40),alternate_phone:z.string().trim().max(40).optional().nullable(),address:z.string().trim().min(3).max(500),vehicles:z.array(z.object({make:z.string().trim().max(100).optional().default(''),color:z.string().trim().max(80).optional().default(''),registration:z.string().trim().max(40).optional().default(''),vin:z.string().trim().max(100).optional().default('')})).max(10).optional().default([]),temporary_password:password}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Complete the required client fields. Password must be at least 12 characters.',details:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  const d=p.data,co=companyScope(req);await db.query('BEGIN');
  const u=await db.query("INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password) VALUES($1,$2,'client',$3,$4,true) RETURNING id,email",[d.email,await hashPassword(d.temporary_password),co,d.full_name]);
  const cl=await db.query("INSERT INTO clients(company_id,user_id,full_name,phone,alternate_phone,email,address,vehicles) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id,full_name",[co,u.rows[0].id,d.full_name,d.phone,d.alternate_phone||null,d.email,d.address,JSON.stringify(d.vehicles)]);
  await db.query('COMMIT');res.status(201).json({client:cl.rows[0],message:'Client account created. The client must change the temporary password at first sign-in.'});
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(e.code==='23505')return res.status(409).json({error:'That email is already in use.'});next(e);}finally{db.release();}
});
app.post('/api/company/clients/:id/family',requireCompanyAccess,async(req,res,next)=>{
 const db=await pool.connect();try{
  const p=z.object({full_name:z.string().trim().min(2).max(160),email,phone:z.string().trim().min(5).max(40),alternate_phone:z.string().trim().max(40).optional().nullable(),address:z.string().trim().min(3).max(500),vehicles:z.array(z.object({make:z.string().trim().max(100).optional().default(''),color:z.string().trim().max(80).optional().default(''),registration:z.string().trim().max(40).optional().default(''),vin:z.string().trim().max(100).optional().default('')})).max(10).optional().default([]),temporary_password:password}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Complete the family member fields. Password must be at least 12 characters.',details:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  const d=p.data,co=companyScope(req);await db.query('BEGIN');
  const parent=await db.query('SELECT id,family_group_id FROM clients WHERE id=$1 AND company_id=$2 AND archived_at IS NULL FOR UPDATE',[req.params.id,co]);
  if(!parent.rowCount){await db.query('ROLLBACK');return res.status(404).json({error:'Primary client not found.'});}
  const root=parent.rows[0].family_group_id||parent.rows[0].id;
  const u=await db.query("INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password) VALUES($1,$2,'client',$3,$4,true) RETURNING id,email",[d.email,await hashPassword(d.temporary_password),co,d.full_name]);
  const cl=await db.query("INSERT INTO clients(company_id,user_id,full_name,phone,alternate_phone,email,address,vehicles,family_group_id,is_family_primary) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,false) RETURNING id,full_name",[co,u.rows[0].id,d.full_name,d.phone,d.alternate_phone||null,d.email,d.address,JSON.stringify(d.vehicles),root]);
  await db.query('COMMIT');res.status(201).json({client:cl.rows[0],message:'Family member account created and linked to the primary client.'});
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(e.code==='23505')return res.status(409).json({error:'That email is already in use.'});next(e);}finally{db.release();}
});
app.put('/api/company/clients/:id',requireCompanyAccess,async(req,res,next)=>{
 const db=await pool.connect();try{
  const p=z.object({full_name:z.string().trim().min(2).max(160),email,phone:z.string().trim().min(5).max(40),alternate_phone:z.string().trim().max(40).optional().nullable(),address:z.string().trim().min(3).max(500),vehicles:z.array(z.object({make:z.string().trim().max(100).optional().default(''),color:z.string().trim().max(80).optional().default(''),registration:z.string().trim().max(40).optional().default(''),vin:z.string().trim().max(100).optional().default('')})).max(10).optional().default([])}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Complete the required client fields.',details:p.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
  const d=p.data,co=companyScope(req);await db.query('BEGIN');
  const old=await db.query('SELECT user_id FROM clients WHERE id=$1 AND company_id=$2 AND archived_at IS NULL FOR UPDATE',[req.params.id,co]);
  if(!old.rowCount){await db.query('ROLLBACK');return res.status(404).json({error:'Active client not found.'});}
  await db.query('UPDATE clients SET full_name=$1,phone=$2,alternate_phone=$3,email=$4,address=$5,vehicles=$6::jsonb WHERE id=$7 AND company_id=$8',[d.full_name,d.phone,d.alternate_phone||null,d.email,d.address,JSON.stringify(d.vehicles),req.params.id,co]);
  if(old.rows[0].user_id)await db.query('UPDATE users SET email=$1,display_name=$2 WHERE id=$3',[d.email,d.full_name,old.rows[0].user_id]);
  await db.query('COMMIT');res.json({ok:true});
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(e.code==='23505')return res.status(409).json({error:'That email is already in use.'});next(e);}finally{db.release();}
});
app.post('/api/incidents/:id/resolve',requireCompanyAccess,async(req,res,next)=>{
 const db=await pool.connect();try{
  const p=z.object({statement:z.string().trim().min(5).max(2000),ob_number:z.string().trim().min(1).max(100)}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'A resolution statement and OB number are required.'});
  await db.query('BEGIN');const incident=await db.query('SELECT id,status FROM incidents WHERE id=$1 AND company_id=$2 FOR UPDATE',[req.params.id,companyScope(req)]);
  if(!incident.rowCount){await db.query('ROLLBACK');return res.status(404).json({error:'Incident not found.'});}
  if(incident.rows[0].status==='Incident Resolved'){await db.query('ROLLBACK');return res.status(409).json({error:'This panic is already resolved.'});}
  await db.query("UPDATE incidents SET status='Incident Resolved',ob_number=$1,updated_at=NOW(),resolved_at=NOW() WHERE id=$2",[p.data.ob_number,req.params.id]);
  await db.query("INSERT INTO incident_events(incident_id,actor_user_id,event_type,note) VALUES($1,$2,'Panic Resolved',$3)",[req.params.id,req.user.id,'OB number: '+p.data.ob_number+' | Statement: '+p.data.statement]);
  await db.query('COMMIT');res.json({ok:true,status:'Incident Resolved'});
 }catch(e){await db.query('ROLLBACK').catch(()=>{});next(e);}finally{db.release();}
});
app.post('/api/incidents/:id/acknowledge',requireCompanyAccess,async(req,res,next)=>{
 try{const own=await pool.query('SELECT status FROM incidents WHERE id=$1 AND company_id=$2',[req.params.id,companyScope(req)]);if(!own.rowCount)return res.status(404).json({error:'Incident not found.'});if(own.rows[0].status==='Incident Resolved')return res.status(409).json({error:'This panic is already resolved.'});if(own.rows[0].status==='Panic Received'){await pool.query("UPDATE incidents SET status='Acknowledged',updated_at=NOW() WHERE id=$1",[req.params.id]);await pool.query("INSERT INTO incident_events(incident_id,actor_user_id,event_type,note) VALUES($1,$2,'Acknowledged','Company acknowledged the panic.')",[req.params.id,req.user.id]);}res.json({ok:true});}catch(e){next(e);}
});
app.post('/api/incidents/:id/reject',requireCompanyAccess,async(req,res,next)=>{
 try{const p=z.object({reason:z.string().trim().min(3).max(1000)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Enter a reason for rejecting the panic.'});const own=await pool.query('SELECT status FROM incidents WHERE id=$1 AND company_id=$2',[req.params.id,companyScope(req)]);if(!own.rowCount)return res.status(404).json({error:'Incident not found.'});if(own.rows[0].status==='Incident Resolved')return res.status(409).json({error:'This panic is already resolved.'});await pool.query("UPDATE incidents SET status='Acknowledged - No Responder Available',updated_at=NOW() WHERE id=$1",[req.params.id]);await pool.query("INSERT INTO incident_events(incident_id,actor_user_id,event_type,note) VALUES($1,$2,'Panic Rejected',$3)",[req.params.id,req.user.id,p.data.reason]);res.json({ok:true});}catch(e){next(e);}
});

app.get('/api/incidents',requireCompanyAccess,async(req,res,next)=>{try{const r=await pool.query(`SELECT i.id,i.incident_type,i.status,i.ob_number,i.latitude,i.longitude,i.location_text,i.device_ip,i.client_activated_at,i.panic_at,i.updated_at,i.resolved_at,c.full_name AS client_name,c.phone AS client_phone,c.alternate_phone AS client_alternate_phone,c.email AS client_email,c.address AS client_address,c.vehicles,c.id AS client_id FROM incidents i LEFT JOIN clients c ON c.id=i.client_id WHERE i.company_id=$1 ORDER BY i.panic_at DESC LIMIT 250`,[companyScope(req)]);res.json({incidents:r.rows});}catch(e){next(e);}});
app.get('/api/incidents/:id/events',requireCompanyAccess,async(req,res,next)=>{try{const own=await pool.query('SELECT id FROM incidents WHERE id=$1 AND company_id=$2',[req.params.id,companyScope(req)]);if(!own.rowCount)return res.status(404).json({error:'Incident not found.'});const r=await pool.query('SELECT e.id,e.event_type,e.note,e.created_at,u.display_name AS actor_name FROM incident_events e LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.incident_id=$1 ORDER BY e.created_at',[req.params.id]);res.json({events:r.rows});}catch(e){next(e);}});
app.post('/api/incidents/:id/status',requireCompanyAccess,async(req,res,next)=>{
 const db=await pool.connect();try{
  const p=z.object({status:z.enum(statuses),ob_number:z.string().trim().max(100).optional(),note:z.string().trim().max(3000).optional()}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Choose a valid status.'});
  await db.query('BEGIN');const cur=await db.query('SELECT id,status,ob_number FROM incidents WHERE id=$1 AND company_id=$2 FOR UPDATE',[req.params.id,companyScope(req)]);
  if(!cur.rowCount){await db.query('ROLLBACK');return res.status(404).json({error:'Incident not found.'});}
  const ob=p.data.ob_number?.trim()||cur.rows[0].ob_number||null;if(p.data.status==='Incident Resolved'){await db.query('ROLLBACK');return res.status(400).json({error:'Use Panic Resolved and provide the required statement and OB number.'});}
  if(cur.rows[0].status==='Incident Resolved'){await db.query('ROLLBACK');return res.status(409).json({error:'Resolved incidents cannot be changed.'});}
  await db.query("UPDATE incidents SET status=$1,ob_number=COALESCE($2,ob_number),updated_at=NOW() WHERE id=$3",[p.data.status,ob,req.params.id]);
  await db.query('INSERT INTO incident_events(incident_id,actor_user_id,event_type,note) VALUES($1,$2,$3,$4)',[req.params.id,req.user.id,p.data.status,p.data.note||null]);await db.query('COMMIT');res.json({ok:true,status:p.data.status,ob_number:ob});
 }catch(e){await db.query('ROLLBACK').catch(()=>{});next(e);}finally{db.release();}
});
app.post('/api/incidents/:id/notes',requireCompanyAccess,async(req,res,next)=>{try{const p=z.object({note:z.string().trim().min(1).max(3000)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Enter a note.'});const own=await pool.query('SELECT id FROM incidents WHERE id=$1 AND company_id=$2',[req.params.id,companyScope(req)]);if(!own.rowCount)return res.status(404).json({error:'Incident not found.'});await pool.query("INSERT INTO incident_events(incident_id,actor_user_id,event_type,note) VALUES($1,$2,'Controller Note',$3)",[req.params.id,req.user.id,p.data.note]);await pool.query('UPDATE incidents SET updated_at=NOW() WHERE id=$1',[req.params.id]);res.status(201).json({ok:true});}catch(e){next(e);}});
app.post('/api/client/panic',requireRole('client'),async(req,res,next)=>{
 const db=await pool.connect();try{
  const p=z.object({incident_type:z.enum(['Emergency Service','Accident','Fire Panic','Other']),latitude:z.coerce.number().min(-90).max(90).optional().nullable(),longitude:z.coerce.number().min(-180).max(180).optional().nullable(),location_text:z.string().trim().max(500).optional().nullable(),activated_at:z.string().datetime().optional()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Choose a valid panic type.'});
  const c=await db.query('SELECT id,company_id FROM clients WHERE user_id=$1',[req.user.id]);if(!c.rowCount||Number(c.rows[0].company_id)!==Number(companyScope(req)))return res.status(403).json({error:'No company is assigned to this client.'});
  await db.query('BEGIN');const d=p.data;const i=await db.query("INSERT INTO incidents(company_id,client_id,incident_type,status,latitude,longitude,location_text,device_ip,client_activated_at) VALUES($1,$2,$3,'Panic Received',$4,$5,$6,$7,COALESCE($8::timestamptz,NOW())) RETURNING id,incident_type,status,panic_at,client_activated_at",[companyScope(req),c.rows[0].id,d.incident_type,d.latitude??null,d.longitude??null,d.location_text||null,req.ip||null,d.activated_at||null]);
  await db.query("INSERT INTO incident_events(incident_id,actor_user_id,event_type,note) VALUES($1,$2,'Panic Received','Panic alert submitted by client.')",[i.rows[0].id,req.user.id]);await db.query('COMMIT');void notifyCompanyOnPanic(companyScope(req),i.rows[0],d.location_text||null);res.status(201).json({incident:i.rows[0],message:'Panic alert received.'});
 }catch(e){await db.query('ROLLBACK').catch(()=>{});next(e);}finally{db.release();}
});
app.get('/api/client/incidents',requireRole('client'),async(req,res,next)=>{try{const r=await pool.query('SELECT i.id,i.incident_type,i.status,i.location_text,i.panic_at,i.updated_at FROM incidents i JOIN clients c ON c.id=i.client_id WHERE c.user_id=$1 ORDER BY i.panic_at DESC LIMIT 100',[req.user.id]);res.json({incidents:r.rows});}catch(e){next(e);}});
app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found.'}));
app.get('*',(_req,res)=>res.sendFile(path.resolve(here,'../public/index.html')));
app.use((err,_req,res,_next)=>{console.error('Request failed:',err.message);if(!res.headersSent)res.status(500).json({error:'Something went wrong. Please try again. If the issue continues, contact support.'});});
async function start(){
 await migrate();
 if(process.env.MASTER_ADMIN_2_EMAIL){
   const e=email.parse(process.env.MASTER_ADMIN_2_EMAIL);
   const target=await pool.query('SELECT id,role FROM users WHERE LOWER(email)=LOWER($1)',[e]);
   if(target.rowCount){
    // The configured address is explicitly designated Master Admin 2.
    // Promote only this exact target account; preserve its password hash.
    await pool.query("UPDATE users SET email=$1,role='master_admin_2',company_id=NULL,display_name='Chanelle',active=true WHERE id=$2",[e,target.rows[0].id]);
    console.log('Second master administrator account role verified and enforced; existing password preserved.');
   } else {
    const current=await pool.query("SELECT id FROM users WHERE role='master_admin_2' ORDER BY id LIMIT 1");
    if(current.rowCount){
     await pool.query('UPDATE users SET email=$1,role=\'master_admin_2\',company_id=NULL,display_name=\'Chanelle\',active=true WHERE id=$2',[e,current.rows[0].id]);
     console.log('Second master administrator email updated and role enforced; existing password preserved.');
    } else {
     const oneTimePassword=randomBytes(48).toString('base64url');
     await pool.query("INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password,active) VALUES($1,$2,'master_admin_2',NULL,'Chanelle',true,true)",[e,await hashPassword(oneTimePassword)]);
     console.log('Second master administrator provisioned; password change required.');
    }
   }
  }
  const count=await pool.query('SELECT COUNT(*)::int AS n FROM users');
 if(count.rows[0].n===0&&process.env.INITIAL_ADMIN_EMAIL&&process.env.INITIAL_ADMIN_PASSWORD){
  const e=email.parse(process.env.INITIAL_ADMIN_EMAIL),p=password.parse(process.env.INITIAL_ADMIN_PASSWORD);
  await pool.query("INSERT INTO users(email,password_hash,role,company_id,display_name,must_change_password) VALUES($1,$2,'master_admin',NULL,'Master Administrator',false)",[e,await hashPassword(p)]);
  console.log('Initial master administrator created from environment configuration.');
 }
 const port=Number(process.env.PORT||8080);app.listen(port,'0.0.0.0',()=>console.log('ES 24/7 listening on '+port));
}
start().catch(e=>{console.error('Startup failed:',e.message);process.exit(1);});
