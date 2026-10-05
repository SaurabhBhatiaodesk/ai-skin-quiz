import { build } from "esbuild";
import fs from "node:fs";
import http from "node:http";
const entry = `import React from 'react'; import {createRoot} from 'react-dom/client'; import QuizEditor from './app/components/QuizEditor'; import Blocks from './app/routes/app.blocks'; import Login from './app/routes/_index/route';
const profile={name:'Balanced',sub:'Test',essence:'',insight:'',heroClass:'',modal:'',products:[]};
const question={phase:'Question',text:'How does your skin feel?',sub:'',options:[{value:'vata',label:'Dry',hint:'',tags:['dry','hydration']},{value:'pitta',label:'Sensitive',hint:'',tags:['sensitive']}]};
const quiz={layout:'three',quick:[question],deep:[{...question,layer:1}],profiles:Object.fromEntries(['vata','pitta','kapha','balanced','dual-vata-pitta','dual-vata-kapha','dual-kapha-pitta'].map(k=>[k,profile])),mappings:[]};
const products=[{title:'Hydrating serum',handle:'serum',tags:['hydration'],productType:'Serum',image:'',price:'$12',variants:[{id:'gid://shopify/ProductVariant/123',title:'30 ml',price:'$12',image:''},{id:'gid://shopify/ProductVariant/124',title:'50 ml',price:'$18',image:''}]}];
createRoot(document.getElementById('root')).render(location.pathname==='/blocks'?<Blocks/>:location.pathname==='/login'?<Login/>:<QuizEditor initial={quiz} shop='test.myshopify.com' code='test' products={products}/>);`;
const submissions = [];
const result = await build({ stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd() }, bundle: true, write: false, define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "preview", setup(builder) {
  builder.onResolve({ filter: /^react-router$/ }, () => ({ path: "router", namespace: "preview" }));
  builder.onLoad({ filter: /.*/, namespace: "preview" }, () => ({ contents: `import React,{useState} from 'react'; const send=data=>fetch('/submission',{method:'POST',body:JSON.stringify(data)}); export function useFetcher(){ const [data,setData]=useState(null); return {state:'idle',data,submit(quiz){send(quiz);setData({ok:true,quiz});}}; } export function useLoaderData(){return {showForm:true,quizzes:[{handle:'test',name:'Skin quiz',layout:'three',questions:2,addUrl:'#'}]};} export function useNavigation(){return {state:'idle'};} export function useSubmit(){return send;} export function useActionData(){return null;} export function Form(props){return React.createElement('form',props);} `, resolveDir: process.cwd() }));
  builder.onLoad({filter:/app\.blocks\.tsx$/},({path})=>({contents:`import {useState} from 'react'; import {Form,useLoaderData,useNavigation,useSubmit} from 'react-router';\n`+fs.readFileSync(path,'utf8').split('export default function Blocks()')[1].replace(/^/,'export default function Blocks()'),loader:'tsx',resolveDir:process.cwd()}));
  builder.onLoad({filter:/_index[\\/]route\.tsx$/},({path})=>({contents:`import {useState} from 'react'; import {Form,useLoaderData,useNavigation,useSubmit,useActionData} from 'react-router';\n`+fs.readFileSync(path,'utf8').split('export default function App()')[1].replace(/^/,'export default function App()'),loader:'tsx',resolveDir:process.cwd()}));
} }] });
const script = result.outputFiles[0].text;
http.createServer((req,res) => {
  if(req.url==='/submission'){let body='';req.on('data',data=>body+=data);req.on('end',()=>{submissions.push(JSON.parse(body));res.end('ok');});return;}
  if(req.url==='/submissions'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(submissions));return;}
  res.setHeader("Content-Type", req.url === "/preview.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/preview.js" ? script : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script></head><body><div id="root"></div><script src="/preview.js"></script></body></html>');
}).listen(4187,"127.0.0.1",()=>console.log("Polaris preview: http://127.0.0.1:4187"));
