const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),assert=require('assert/strict');
const source=fs.readFileSync('business-address-lookup.js','utf8');
const context={};vm.createContext(context);
vm.runInContext(source.split('async function fetchFactoryAddressSnapshot')[0],context);
let total=0;
for(const name of fs.readdirSync('factory-address-data').filter(n=>/^[0-9a-f]\.txt$/.test(n))){
 const snapshot=JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync('factory-address-data/'+name,'utf8'),'base64')));
 assert.equal(snapshot.period,'2026-09');
 for(const row of snapshot.rows){
  assert.equal((context.factoryAddressNameKey(row[0]).codePointAt(0)%16).toString(16)+'.txt',name);
  assert(row[1].trim());assert(row[2].trim());total++;
 }
}
assert.equal(total,101262);
const rows=[
 ['測試股份有限公司','桃園市一號','1','12345678'],
 ['測試股份有限公司','高雄市二號','2','12345678'],
 ['測試企業股份有限公司一廠','台中市三號','3','87654321']
];
let result=context.findFactoryAddressCandidates(rows,'測試(股)公司');
assert.equal(result.length,2);assert(result.every(x=>x.exact));
result=context.findFactoryAddressCandidates(rows,'測試有限公司');
assert.equal(result.length,2);assert(result.every(x=>!x.exact));
result=context.findFactoryAddressCandidates(rows,'測試企業股份有限公司');
assert.equal(result.length,1);assert.equal(result[0].exact,false);
assert.equal(context.findFactoryAddressCandidates(rows,'找不到這家公司').length,0);
assert.equal(context.factoryAddressNameKey('臺灣測試(股)公司'),context.factoryAddressNameKey('台灣測試股份有限公司'));
console.log('PASS: '+total+' official factory records; gzip, routing, aliases, legal-name distinction, multiple plants and no-match results.');
