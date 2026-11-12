const test = require('node:test');
const assert = require('node:assert/strict');
const headers = require('../api-gateway/src/middlewares/securityHeaders');

function run(req) {
  const result = {};
  let next = false;
  headers(req, {setHeader:(key,value)=>{result[key]=value;}}, ()=>{next=true;});
  assert.equal(next,true);
  return result;
}
test('CSP bloquea scripts inline, marcos y plugins; permite recursos locales',()=>{
  const h=run({method:'GET',path:'/',secure:true});
  const csp=h['Content-Security-Policy'];
  for(const rule of ["script-src 'self'", "script-src-attr 'none'", "frame-ancestors 'none'", "object-src 'none'"]) assert.ok(csp.split('; ').includes(rule));
  assert.equal(h['X-Frame-Options'],'DENY');
  assert.equal(h['X-Content-Type-Options'],'nosniff');
  assert.ok(h['Strict-Transport-Security']);
});
test('HSTS no afecta desarrollo HTTP',()=>assert.equal(run({method:'GET',path:'/',secure:false})['Strict-Transport-Security'],undefined));
test('Sesiones y API no se almacenan en caché',()=>{
  for(const [method,path] of [['POST','/login'],['POST','/api'],['GET','/perfil'],['GET','/usuarios']]) assert.equal(run({method,path,secure:true})['Cache-Control'],'no-store');
});
test('Archivos estáticos mantienen su política de caché',()=>assert.equal(run({method:'GET',path:'/motion.css',secure:true})['Cache-Control'],undefined));
