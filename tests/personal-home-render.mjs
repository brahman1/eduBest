// Run with node --import tsx tests/personal-home-render.mjs. No browser or network.
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import HomeModule from '../web/app/app/personal-home.tsx';
const Home=HomeModule.default??HomeModule;
const noop=()=>{};
const starts=new Date(Date.now()+3600000).toISOString(),ends=new Date(Date.now()+7200000).toISOString();
const lesson={id:'lesson',group_id:'g',group_name:'Maths collège',subject:'Mathématiques',teacher_name:'Enseignant de recette',room:'A1',starts_at:starts,ends_at:ends,status:'scheduled',student_count:12,children:[{id:'child',name:'Enfant de recette'}]};
const data={personal:{children:[{id:'child',name:'Enfant de recette',level:'2AM',group_ids:['g']}],agenda:[lesson],announcements:[],notices:[],absences:[]},remuneration:{earned_centimes:120000},outstanding_personal:[]};
const result=[];
await mkdir(new URL('../.local/personal-home-render-20261027/',import.meta.url),{recursive:true});
for(const role of ['STUDENT','PARENT','TEACHER'])for(const lang of ['fr','ar']){
 const html=renderToStaticMarkup(React.createElement(Home,{data,user:{id:role,role,name:'Compte de recette'},lang,navigate:noop,openSession:noop,openNotice:noop,attendance:noop}));
 assert.ok(html.includes('Mathématiques'));assert.ok(html.includes('A1'));assert.ok(html.includes(lang==='fr'?'Prochain cours':'الحصة القادمة'));
 assert.equal(html.includes('aria-pressed="true"'),true);
 assert.equal(html.includes('Tous mes enfants'),role==='PARENT'&&lang==='fr');
 assert.equal(html.includes('Ma rémunération du mois'),role==='TEACHER'&&lang==='fr');
 assert.equal(html.includes('Encaissé ce mois'),false);
 assert.equal(html.includes('Inscrire un élève'),false);
 assert.equal(html.includes('dir="rtl"'),lang==='ar');
 await writeFile(new URL(`../.local/personal-home-render-20261027/${role}-${lang}.html`,import.meta.url),html);
 result.push({role,lang,passed:true});
}
console.log(JSON.stringify({renders:result,browser_used:false}));
