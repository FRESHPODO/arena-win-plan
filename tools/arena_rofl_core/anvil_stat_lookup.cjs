'use strict';
const table=require('./data/anvil_stats.json');
function identify(spell){
 const suffix=spell.split('_').at(-1);
 const tier=spell.includes('GoldStatAnvil_')?'gold':spell.includes('PrisStatAnvil_')||table.specialPrismaticSuffixes.includes(suffix)?'prismatic':'silver';
 return {suffix,tier};
}
function lookup(spell,tierOverride){
 const id=identify(spell),tier=tierOverride??id.tier,suffix=id.suffix;
 if(suffix==='Pristine')return {tier:'special',recordMode:'excluded',reason:'shardholder',baseStats:null};
 if(table.countOnly[suffix])return {tier,recordMode:'count_only',baseStats:null,effect:table.countOnly[suffix]};
 if(suffix==='Random')return {tier,recordMode:'derived_rewards',baseStats:null};
 const values=table[tier]?.[suffix];
 if(!values)return {tier,recordMode:['ShardBladeAnvils'].includes(suffix)?'no_direct_stats':'unresolved',baseStats:null};
 const filtered=x=>Object.fromEntries(Object.entries(x).filter(([key])=>!table.ignoredStats.includes(key)));
 return {tier,recordMode:'fixed_base_stats',baseStats:values.melee?null:filtered(values),...(values.melee?{baseStatsByRange:{melee:filtered(values.melee),ranged:filtered(values.ranged)},rangeAtSelectionRequired:true}:{})};
}
function recordNotifications(notifications){
 const selected=notifications[0].spellName,base=lookup(selected);
 if(identify(selected).suffix!=='Random')return {...base,grantedShards:[]};
 const counts=new Map();for(const n of notifications.slice(1))counts.set(n.spellName,(counts.get(n.spellName)||0)+1);
 // Distinct rewards emit two name notifications each. When both rewards
 // match, this build emits three or four notifications for that one type.
 // Reward multiplicity follows Random's two-grant rule, not raw packet count.
 const count=[...counts.values()].reduce((a,b)=>a+b,0);
 const sameReward=counts.size===1&&(count===3||count===4);
 if(!sameReward&&(count!==4||counts.size!==2||[...counts.values()].some(n=>n!==2)))return {...base,grantedShards:[],rewardDecodeStatus:'unresolved generated reward multiplicity'};
 const grantedShards=[];
 for(const [spellName,n]of counts)for(let i=0;i<(sameReward?table.random.rewardCount:n/2);i++)grantedShards.push({spellName,...lookup(spellName,base.tier)});
 const totals={};let complete=true;
 for(const g of grantedShards){if(!g.baseStats){complete=false;continue;}for(const [key,value]of Object.entries(g.baseStats))totals[key]=(totals[key]??0)+value;}
 return {...base,grantedShards,rewardDecodeStatus:'two rewards decoded; parent tier applied',rewardCountMethod:sameReward?'Single granted type with three/four notifications; parent Random guarantees two rewards':'Two granted types with two notifications each',baseStats:complete?totals:null};
}
module.exports={identify,lookup,recordNotifications};
