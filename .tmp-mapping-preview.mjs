import { build } from "esbuild";
import http from "node:http";
const entry = `import React from 'react'; import {createRoot} from 'react-dom/client'; import QuizEditor from './app/components/QuizEditor';
const profile={name:'Balanced',sub:'Test',essence:'',insight:'',heroClass:'',modal:'',products:[]};
const question={phase:'Question',text:'How does your skin feel?',sub:'',options:[{value:'vata',label:'Dry',hint:'',tags:['dry','hydration']},{value:'pitta',label:'Sensitive',hint:'',tags:['sensitive']}]};
const quiz={quick:[question],deep:[{...question,layer:1}],profiles:Object.fromEntries(['vata','pitta','kapha','balanced','dual-vata-pitta','dual-vata-kapha','dual-kapha-pitta'].map(k=>[k,profile])),mappings:[]};
const products=[{title:'Hydrating serum',handle:'serum',tags:['hydration'],productType:'Serum',image:'',price:'$12',variants:[{id:'gid://shopify/ProductVariant/123',title:'30 ml',price:'$12',image:''},{id:'gid://shopify/ProductVariant/124',title:'50 ml',price:'$18',image:''}]}];
createRoot(document.getElementById('root')).render(<QuizEditor initial={quiz} shop='test.myshopify.com' code='test' products={products}/>);`;
const result = await build({ stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd() }, bundle: true, write: false, define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "preview-router", setup(builder) {
  builder.onResolve({ filter: /^react-router$/ }, () => ({ path: "router", namespace: "preview" }));
  builder.onLoad({ filter: /.*/, namespace: "preview" }, () => ({ contents: `import {useState} from 'react'; export function useFetcher(){ const [data,setData]=useState(null); return {state:'idle',data,submit(quiz){setData({ok:true,quiz});}}; }`, resolveDir: process.cwd() }));
} }] });
const script = result.outputFiles[0].text;
http.createServer((req,res) => { res.setHeader("Content-Type", req.url === "/preview.js" ? "text/javascript" : "text/html"); res.end(req.url === "/preview.js" ? script : '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'); }).listen(4187,"127.0.0.1",()=>console.log("Mapping preview: http://127.0.0.1:4187"));
