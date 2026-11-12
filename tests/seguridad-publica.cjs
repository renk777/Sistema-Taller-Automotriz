// GATEWAY_URL y ADMIN_PASS se reciben por entorno. No imprime credenciales.
const fs = require('node:fs');
const base = process.env.GATEWAY_URL;
if (!base || !process.env.ADMIN_PASS) throw Error('Configura GATEWAY_URL y ADMIN_PASS');
const results = [];
const check = (name, ok) => { results.push({name, ok: Boolean(ok)}); console.log(`${ok ? 'OK' : 'FALLO'} ${name}`); };
async function request(path, body, headers = {}, method) {
  const response = await fetch(base + path, {method:method || (body ? 'POST':'GET'),
    headers:{'Content-Type':'application/json',...headers},body:body ? JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  const text = await response.text();
  let data; try {data=JSON.parse(text);} catch {data=null;}
  return {response, text, data};
}
(async()=>{
  const home = await request('/');
  check('Página accesible',home.response.status===200);
  for (const [name, expected] of [['content-security-policy',"script-src 'self'"],['x-frame-options','DENY'],['x-content-type-options','nosniff'],['referrer-policy','no-referrer'],['strict-transport-security','max-age=']]) {
    check(`Cabecera ${name}`,(home.response.headers.get(name)||'').includes(expected));
  }
  check('Sin cabecera X-Powered-By',!home.response.headers.has('x-powered-by'));
  for (const path of ['/.env','/.git/config','/database/schema.sql','/deploy/init-db.js','/api-gateway/.env','/package.json','/api/servicios','/entidades','/%2e%2e/%2e%2e/etc/passwd']) {
    const r=await request(path); check(`Archivo/ruta privada ${path}`,r.response.status===404||r.response.status===403);
  }
  const anonymous=await request('/perfil'); check('Perfil sin sesión bloqueado',anonymous.response.status===401);
  const injection=await request('/login',{username:"admin' OR '1'='1' -- ",password:'qa-invalid'});
  check('Inyección SQL en login rechazada',injection.response.status===401);
  const malformed=await request('/login',{username:{'$ne':null},password:['x']}); check('Tipos de login inválidos rechazados',malformed.response.status===400);
  const login=await request('/login',{username:'admin',password:process.env.ADMIN_PASS});
  if(login.response.status!==200)throw Error('Login de pruebas falló');
  check('Login no almacenable en caché',/no-store/.test(login.response.headers.get('cache-control')||''));
  const token=login.data.token;
  const api=(rama,metodo,ruta,datos={},auth=token)=>request('/api',{TOKEN:auth,dat:{RAMA:rama,METODO:metodo,RUTA:ruta,DATOS:datos}});
  for (const ruta of ['/api/ordenes/../../etc/passwd','http://169.254.169.254/latest/meta-data/','/api/ordenes/1 OR 1=1','/api/ordenes/1?url=http://example.invalid']) {
    check(`Ruta no autorizada ${ruta}`,(await api('ORDENES','GET',ruta)).response.status===404);
  }
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const forged=`${b64({alg:'none',typ:'JWT'})}.${b64({sub:'1',rol:'ADMIN',exp:Math.floor(Date.now()/1000)+60})}.`;
  check('JWT sin firma bloqueado',(await api('ORDENES','GET','/api/ordenes',{},forged)).response.status===403);
  check('JWT alterado bloqueado',(await api('ORDENES','GET','/api/ordenes',{},token.slice(0,-8)+'xxxxxxxx')).response.status===403);
  const cors=await request('/perfil',undefined,{'Origin':'https://qa-attacker.invalid','Authorization':`Bearer ${token}`});
  check('CORS no permite origen ajeno',!cors.response.headers.has('access-control-allow-origin'));
  const csrf=await request('/usuarios',{username:'qa_csrf',password:'not-a-real-account',rol:'ADMIN'},{Origin:'https://qa-attacker.invalid'});
  check('Alta sin autenticación bloqueada',csrf.response.status===401);
  const big=await request('/login',{username:'x',password:'x'.repeat(1024*1024+1)});
  check('Límite de tamaño de JSON',big.response.status===413);
  const unknown=await request('/does-not-exist'); check('Errores sin trazas',!/(SQLSTATE|Traceback|node_modules|Error:)/.test(unknown.text));
  if(process.env.QA_XSS_CREATE==='1') {
    const payload='QA-XSS <img src=x onerror="document.body.dataset.qaXss=1">';
    const xss=await api('INVENTARIO','POST','/api/servicios',{nombre:payload,tarifaBase:1000});
    check('Registro XSS controlado creado',xss.response.status===201);
    if(xss.data?.idServicio)fs.writeFileSync(process.env.QA_RECORD_FILE||'qa-xss.json',JSON.stringify({idServicio:xss.data.idServicio,payload}));
  }
  await request('/logout',{refreshToken:login.data.refreshToken});
  fs.writeFileSync(process.env.QA_REPORT||'security-results.json',JSON.stringify(results,null,2));
  console.log(`${results.filter(r=>r.ok).length}/${results.length} verificaciones correctas`);
  if(results.some(r=>!r.ok))process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
