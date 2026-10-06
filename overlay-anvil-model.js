/* Pure time-based model shared by preview and video frames. */
(function(root){
 const stats={attackDamage:['공격력','ad.png'],abilityPower:['주문력','ap.png'],armor:['방어력','armor.webp'],magicResistance:['마법 저항력','mr.webp'],health:['체력','health.svg'],abilityHaste:['스킬 가속','haste.webp'],attackSpeedPercent:['공격 속도','speed.webp'],criticalStrikeChancePercent:['치명타 확률','crit.webp'],flatMagicPenetration:['마법 관통력','magicpen.webp'],lethality:['물리 관통력','armorpen.webp'],magicPenetrationPercent:['마법 관통력','magicpen.webp'],armorPenetrationPercent:['방어구 관통력','armorpen.webp'],tenacityPercent:['강인함','tenacity.webp'],omnivampPercent:['모든 피해 흡혈','omnivamp.webp'],movementSpeedPercent:['이동 속도','move.webp'],maxHealthPercent:['최대 체력','health.svg'],healShieldPowerPercent:['회복·보호막','healshield.webp'],criticalStrikeDamagePercent:['치명타 피해','crit-dmg.webp']};
 function base(event,range){const r=event.statReference||{};if(event.overrideStats)return event.overrideStats;if(r.baseStats)return r.baseStats;if(r.baseStatsByRange)return r.baseStatsByRange[range]||{};if(r.grantedShards?.length)return r.grantedShards.reduce((a,g)=>add(a,g.baseStats||g.baseStatsByRange?.[range]||{}),{});return {};}
 function add(a,b,factor=1){for(const [key,value]of Object.entries(b))if(stats[key]&&Number.isFinite(value))a[key]=(a[key]||0)+value*factor;return a;}
 function state(events,rounds,time,options={}){
  const total={},pending={},current={},merging={};let lastMerge=-Infinity,lastPurchase=-Infinity;
  for(const event of events){if(event.excluded||event.time>time)continue;const round=rounds[(event.round||1)-1];const multiplier=1+Number(round?.shardbladePercent||0)/100;
   const gain=base(event,options.range||'melee'),combat=round?.combatTransition?options.seconds(round.combatTransition):Infinity;
   const merge=Math.max(event.time,combat);
   if(time>=merge){add(total,gain,multiplier);if(time-merge<.35)add(merging,gain,multiplier);lastMerge=Math.max(lastMerge,merge);}
   else if(time-event.time<1.2){add(current,gain,multiplier);lastPurchase=Math.max(lastPurchase,event.time);}
   else {add(pending,gain,multiplier);lastPurchase=Math.max(lastPurchase,event.time+1.2);}
  }
  const interval={};for(const e of events)if(!e.excluded&&e.time>=options.start&&e.time<=options.end)add(interval,base(e,options.range||'melee'),1+Number(rounds[(e.round||1)-1]?.shardbladePercent||0)/100);
  return {total,pending,current,merging,interval,mergeAge:time-lastMerge,purchaseAge:time-lastPurchase};
 }
 const model={stats,base,add,state};root.ArenaAnvil=model;if(typeof module!=='undefined')module.exports=model;
})(typeof window==='undefined'?globalThis:window);
