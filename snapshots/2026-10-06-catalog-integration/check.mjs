import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import addFormats2019 from 'ajv-formats-draft2019';
import {query,paths} from 'jsonpath-rfc9535';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const cache=path.join(root,'.cache/catalog-integration-2026-10-06');
const require=createRequire(import.meta.url);
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=await read(path.join(here,'sources.json'));
const jobs=manifest.sources.flatMap(source=>source.files.map(file=>({source,file})));
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
  while(cursor<jobs.length){
    const {source,file}=jobs[cursor++];
    const destination=path.join(cache,source.id,file.path);
    let bytes;
    try{bytes=await readFile(destination);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(bytes){assert.equal(digest(bytes),file.sha256,`Cached source differs: ${source.id}/${file.path}`);assert.equal(bytes.length,file.bytes);continue;}
    const response=await fetch(file.url,{signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error(`${response.status}: ${file.url}`);
    bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(digest(bytes),file.sha256,`Downloaded source differs: ${file.url}`);assert.equal(bytes.length,file.bytes);
    await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,bytes);
  }
}));

async function validator(source){
  const schemaRoot=path.join(cache,source,'schema');
  const ajv=new Ajv2020({strict:false,allErrors:true,validateFormats:true,keywords:['meta:enum'],allowUnionTypes:true});
  ajv.addMetaSchema(require('ajv/dist/refs/json-schema-draft-07.json'));addFormats(ajv);addFormats2019(ajv);
  for(const name of await readdir(schemaRoot)){
    if(!name.endsWith('.schema.json'))continue;
    const schema=await read(path.join(schemaRoot,name));ajv.addSchema(schema);
    for(const prefix of ['https://cyclonedx.org/schema/','http://cyclonedx.org/schema/'])if(prefix+name!==schema.$id)ajv.addSchema({...schema,$id:prefix+name});
  }
  for(const name of await readdir(path.join(schemaRoot,'2.0/model')))if(name.endsWith('.json'))ajv.addSchema(await read(path.join(schemaRoot,'2.0/model',name)));
  return ajv.compile(await read(path.join(schemaRoot,'2.0/cyclonedx-2.0.schema.json')));
}
const validate990=await validator('pr990');
const validate1067=await validator('pr1067');
const schemaPass=(validate,document,label)=>assert.equal(validate(document),true,`${label}: ${JSON.stringify(validate.errors)}`);
const sourceText=await readFile(path.join(cache,'pr1067/perspectives/model-card-perspective.json'),'utf8');
const original=JSON.parse(sourceText);
const proposed=structuredClone(original);
const changeSet=await read(path.join(here,'changes.json'));
for(const [name,changes] of Object.entries(changeSet.mappings)){
  const mapping=proposed.perspectives[0].mappings.find(m=>m.nativeName===name);assert(mapping,name);Object.assign(mapping,changes);
}
schemaPass(validate1067,original,'Original catalog');schemaPass(validate1067,proposed,'Proposed catalog');
const mappings=doc=>Object.fromEntries(doc.perspectives[0].mappings.filter(m=>Object.hasOwn(changeSet.mappings,m.nativeName)).map(m=>[m.nativeName,m]));
const before=mappings(original),after=mappings(proposed);
// Bounded local refs selection only: root-evaluated paths restricted to an explicit
// source subtree, then unique local reference targets, then the final expression.
// This is not a scope engine or an implementation of dependencies/referrers.
const inside=(candidate,prefix)=>prefix==='$'||candidate===prefix||candidate.startsWith(prefix+'[');
function project(bom,mapping,prefix='$'){
  const expressionPaths=paths(bom,mapping.expression);
  if(!mapping.via)return {selected_paths:expressionPaths.filter(p=>inside(p,prefix))};
  assert.equal(mapping.via.length,1);assert.deepEqual(Object.keys(mapping.via[0]),['refs']);
  const refPaths=paths(bom,mapping.via[0].refs).filter(p=>inside(p,prefix));
  const refs=refPaths.flatMap(p=>query(bom,p));
  const allIds=paths(bom,"$..['bom-ref']");
  const targets=[];
  for(const ref of refs){
    assert.equal(typeof ref,'string');assert(!ref.startsWith('urn:cdx:'),'External references are outside these tests');
    const matches=allIds.filter(p=>query(bom,p)[0]===ref);assert.equal(matches.length,1,`Expected one local target for ${ref}`);
    targets.push(matches[0].slice(0,-"['bom-ref']".length));
  }
  return {reference_paths:refPaths,reference_values:refs,target_paths:[...new Set(targets)],selected_paths:expressionPaths.filter(p=>targets.some(t=>inside(p,t)))};
}
function selection(bom,map,prefix){return Object.fromEntries(Object.entries(map).map(([name,mapping])=>[name,project(bom,mapping,prefix)]));}
const official=[];
for(const name of ['valid-ai-ml-model-2.0.json','valid-ai-ml-risk-integration-2.0.json']){
  const bom=await read(path.join(cache,'pr990/tools/src/test/resources/2.0',name));schemaPass(validate990,bom,name);
  const old=selection(bom,before),candidate=selection(bom,after);
  for(const value of Object.values(old))assert.equal(value.selected_paths.length,0);
  assert.equal(candidate['Quantitative Analysis'].selected_paths.length,3);assert.equal(candidate['Environmental Considerations'].selected_paths.length,2);
  const n=name.includes('risk-integration')?1:0;
  assert.equal(candidate['Intended Use'].selected_paths.length,n);assert.equal(candidate['Use Case Definitions'].selected_paths.length,n);
  official.push({file:name,schema_valid:true,before:old,proposed:candidate});
}

// Literal expected cases exercise the semantic choice independently of schema enum order.
const relationCases=[['extends',0],['implements',1],['inhibits',0],['not-applicable',0],['not-assessed',0],['other',0],['participates-in',0],['supports',0],['triggers',0],['validates',0]];
const enumSchema=await read(path.join(cache,'pr990/schema/2.0/model/cyclonedx-usecase-2.0.schema.json'));
assert.deepEqual(query(enumSchema,'$..assertionType.enum')[0],relationCases.map(([type])=>type));
const minimal=(type)=>({specFormat:'CycloneDX',specVersion:'2.0',components:[{type:'machine-learning-model','bom-ref':'model-a',name:'Model A',modelProperties:{},useCaseAssertions:[{assertionType:type,useCaseRefs:['use-a']}]}],definitions:{useCases:[{'bom-ref':'use-a',name:'Use A'},{'bom-ref':'unrelated',name:'Unrelated use'}]}});
const checks=[];
for(const [type,count] of relationCases){
  const bom=minimal(type);schemaPass(validate990,bom,type);const result=selection(bom,after);
  assert.equal(result['Intended Use'].selected_paths.length,count);assert.equal(result['Use Case Definitions'].selected_paths.length,count);
  assert.deepEqual(result['Use Case Definitions'].reference_values,count?['use-a']:[]);
  checks.push({case:`assertion-${type}`,schema_valid:true,expected_selected_references:count?['use-a']:[],actual:result});
}
const two=minimal('implements');
two.components.push({type:'machine-learning-model','bom-ref':'model-b',name:'Model B',modelProperties:{},useCaseAssertions:[{assertionType:'implements',useCaseRefs:['use-b']},{assertionType:'not-applicable',useCaseRefs:['use-a']}]});
two.definitions.useCases.push({'bom-ref':'use-b',name:'Use B'});schemaPass(validate990,two,'Two-model fixture');
await writeFile(path.join(here,'two-model-fixture.json'),JSON.stringify(two,null,2)+'\n');
for(const [prefix,expected] of [["$['components'][0]",['use-a']],["$['components'][1]",['use-b']],['$',['use-a','use-b']]]){
  const result=selection(two,after,prefix);assert.deepEqual(result['Use Case Definitions'].reference_values,expected);
  assert.equal(result['Use Case Definitions'].selected_paths.length,expected.length);
  checks.push({case:`source-subtree-${prefix}`,schema_valid:true,expected_selected_references:expected,actual:result});
}
const empty=minimal('implements');empty.components[0].useCaseAssertions[0].useCaseRefs=[];schemaPass(validate990,empty,'Empty reference array');
const emptyResult=selection(empty,after);assert.equal(emptyResult['Intended Use'].selected_paths.length,1);assert.equal(emptyResult['Use Case Definitions'].selected_paths.length,0);
checks.push({case:'empty-reference-array',schema_valid:true,meaning:'One selected collection, no resolved definition; no new non-empty completeness policy.',actual:emptyResult});
const sourceLines=sourceText.trimEnd().split('\n');
const normalizedOriginal=JSON.stringify(original,null,2).split('\n');
const normalizedProposed=JSON.stringify(proposed,null,2).split('\n');
assert.equal(sourceLines.length,normalizedOriginal.length);assert.equal(sourceLines.length,normalizedProposed.length);
// Keep unchanged original text, including numeric spellings such as 1.0.
const proposedLines=sourceLines.map((line,i)=>normalizedOriginal[i]===normalizedProposed[i]?line:normalizedProposed[i]);
const proposedText=proposedLines.join('\n')+'\n';assert.deepEqual(JSON.parse(proposedText),proposed);
await writeFile(path.join(cache,'proposed.catalog.json'),proposedText);
const ranges=[{id:'performance-measurements',start:167,end:167},{id:'implemented-use-cases',start:175,end:186},{id:'energy-measurements',start:238,end:238}];
const changed=[];
for(let i=0;i<sourceLines.length;i++)if(sourceLines[i]!==proposedLines[i]){assert(ranges.some(r=>i+1>=r.start&&i+1<=r.end),`Unreviewed line change ${i+1}`);changed.push(i+1);}
const suggestions=ranges.map(r=>({...r,path:'perspectives/model-card-perspective.json',side:'RIGHT',original:sourceLines.slice(r.start-1,r.end).join('\n'),replacement:proposedLines.slice(r.start-1,r.end).join('\n')}));
await writeFile(path.join(here,'line-suggestions.json'),JSON.stringify(suggestions,null,2)+'\n');
const result={source_heads:Object.fromEntries(manifest.sources.map(s=>[s.id,s.commit])),status:'proposal-tested-not-upstream-accepted',policy:'Only implements is proposed for Intended Use; other relationships are preserved in the BOM and not inferred to be intended use.',validator:{name:'Ajv 2020',strict_lint:false,formats:true,ajv_version:require('ajv/package.json').version,jsonpath_version:'1.3.0'},catalog_schema_validation:{original:true,proposed:true,source:'pr1067'},changed_lines:changed,official_fixtures:official,additional_checks:checks,boundary:'Four catalog mappings only. Reference tests use unique local IDs and explicit source-subtree restrictions. Not a full perspective scope/closure/referrers/dependency conformance test. No Required or empty-value policy is defined.'};
await writeFile(path.join(here,'results.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({catalog_schema_validation:result.catalog_schema_validation,official:official.map(r=>({file:r.file,before:Object.fromEntries(Object.entries(r.before).map(([k,v])=>[k,v.selected_paths.length])),proposed:Object.fromEntries(Object.entries(r.proposed).map(([k,v])=>[k,v.selected_paths.length]))})),additional_checks:checks.length,changed_lines:changed},null,2));
