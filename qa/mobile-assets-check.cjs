const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async()=>{
 const root=fs.realpathSync(path.join(__dirname,'../mobileapp/node_modules'));
 const dirs=['@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts','react-native/Libraries/LogBox/UI/LogBoxImages','@react-navigation/elements/lib/module/assets'];
 const results=[];
 for(const folder of dirs){
  for(const name of fs.readdirSync(path.join(root,folder)).filter(n=>/\.(ttf|png)$/.test(n))){
   const file=path.join(root,folder,name).replaceAll('\\','/');
   for(const platform of ['android','ios']){
    const url='http://127.0.0.1:8081/assets/?unstable_path='+encodeURIComponent('./'+file)+'&platform='+platform;
    const res=await fetch(url);const bytes=Buffer.from(await res.arrayBuffer());
    assert.equal(res.status,200,platform+' '+name+': '+bytes.toString().slice(0,180));assert.ok(bytes.length>0);
    results.push({asset:folder+'/'+name,platform,status:res.status,bytes:bytes.length});
   }
  }
 }
 fs.writeFileSync(path.join(__dirname,'mobile-assets-results.json'),JSON.stringify(results,null,2));console.log('PASS '+results.length+' real font/image HTTP downloads on Android and iOS');
})().catch(e=>{console.error(e);process.exitCode=1});
