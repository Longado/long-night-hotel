import {remember} from './demo.js';
export const RECORDS={
 notice:{name:'前台 / 镇上通告',text:'今日北桥运款车劫案：司机死亡，一名押运员负伤后获救。警方正等待伤者补充证言，目前未公布嫌疑人姓名。请保留与案件有关的记录。'},
 wiring:{name:'配电箱 / 旧线路图',text:'客房 A、B 接老旧保险，受潮可能跳闸；酒吧照明由独立蓄电池供电。页边字迹：手电只能照路，客房必须有固定照明。不要把酒吧接回客房回路。'},
 tape:{name:'酒吧 / 前任经理录音',text:'客房失光后，我去修保险。开关旁先传来刮擦，随后有东西追来。躲回酒吧，声音才停。不要跟着声音走；先记住灯下的退路，再回去修灯。'},
 'shadow-boundary':{name:'逃生经历 / 酒吧门线',text:'你跨进酒吧的独立照明范围，追逐的脚步停止了。你还活着，仍可以回去修灯；这段经历没有告诉你身后东西的全貌。'},
 'wall-trace':{name:'现场观察 / 配电箱旁',text:'画中背影已经消失，画框下沿有向外擦出的深色颜料，墙面拖痕朝酒吧延伸。你回到现场检查了这些痕迹；它们不能说明任何住客的身份。'},
 contract:{name:'入职 / 钥匙签收联',text:'钥匙签收联写着：领钥匙者均须登记，代班者亦同。你签在“值夜经理”一栏，房号一格暂时空着。'}
};
export const MYSTERIES={
 case:{title:'北桥来客有什么关联？',prompt:'血迹说明发生过什么，但不能单独说明是谁伤了人。核对记录来历、隐瞒的信息和取走记录的要求，再选 5 条证据。',count:5,options:[['blood','唐宁卷入袭击，罗诚要取记录核对她的责任'],['silence','罗诚卷入袭击，要取走记录阻止证言送达'],['medicine','罗诚替人跑腿，要取走记录协助案件调查']],answer:'silence',groups:[['tang1'],['luo0'],['luo1'],['notice'],['gu0','verify-luo','luonight']],missing:['唐宁携带什么、准备送往哪里：接待时再问一句，或夜里向她补问。','罗诚的知识来源：核对他的说法与唐宁对记录的描述。','罗诚提出了什么要求：向他补问，并核对是否有凭据。','北桥案件的背景：读前台或酒吧留存的镇上通告。','独立佐证：顾远的照片、回拨原始预约或罗诚的猫眼物品。'],result:'你把几条记录连在一起：唐宁救下北桥伤者，准备把伤情记录送往北镇；罗诚隐瞒工具袋，又说出封存记录的缺角，并要求你取走记录，却拿不出警方委托。结合独立的行李佐证和劫案背景，阻止证言送达比受托核对更能解释这些矛盾。唐宁的血迹来自急救，不能据此把她当成凶手。这个推断足以提醒你保护她，但还不是一份判决。'},
 hotel:{title:'断电后发生了什么？',prompt:'把设备记录与亲历现象放在一起。选择一个解释，再选 4 条证据。',count:4,options:[['ghost','有人借断电掩护，装扮成影子驱赶维修者'],['body','酒店从墙面伸出肢体，驱赶试图修灯的人'],['guide','故障投出了移动影像，追逐只是声音巧合']],answer:'body',groups:[['wiring'],['tape'],['shadow-boundary'],['wall-trace']],missing:['配电箱里的旧线路图：说明酒吧为何不随客房断电。','酒吧的旧录音：前任经理描述过墙面与影子的连接。','你自己逃回酒吧的经历：预告不能代替亲历。','维修处的残留：逃脱后回来检查墙面。'],result:'画框外的颜料、通向酒吧的墙面拖痕，以及断电后追逐、到灯下停止的经历彼此吻合。你推断墙影是酒店伸进走廊的肢体：房间吞噬住客，它则驱赶试图恢复照明的人。人的罪行与酒店的捕食是两种危险。先退回酒吧，再修灯，才能夺回那些房间。'}
};
export function collect(s,id){const r=RECORDS[id];if(!r)return false;s.clues??=[];if(!s.clues.some(c=>c.id===id))s.clues.push({id,guest:'hotel',...r});return true;}
export function evidence(s,id){const m=MYSTERIES[id];if(!m)return [];return (s.clues||[]).filter(c=>m.groups.flat().includes(c.id)||['tang0','question-tang-dob','chen0'].includes(c.id));}
export function solve(s,id,answer,selected=[]){const m=MYSTERIES[id];if(!m)return {ok:false,text:'没有这页调查。'};const actual=new Set((s.clues||[]).map(c=>c.id));if(new Set(selected).size!==m.count||selected.length!==m.count||selected.some(id=>!actual.has(id)))return {ok:false,text:`请从亲自收集的记录中选出 ${m.count} 条不同证据。`};const missing=m.groups.findIndex(group=>!group.some(id=>selected.includes(id)));if(missing>=0)return {ok:false,text:'这条推理还缺少一环：'+m.missing[missing]};if(answer!==m.answer)return {ok:false,text:id==='case'?'这组证据没有证明血迹的主人伤了人，也没有指向药品失窃。谁在隐瞒行李，又在寻找记录？':'罗诚是否入住并不能解释旧录音。注意它从哪里出现、阻挡哪件事、又停在哪里。'};s.story??={};s.story[id]=true;remember(s,'deduction-'+id,id==='case'?'你将伤情记录、隐瞒的行李与北桥通告连在一起，推断唐宁正被追索证言。':'你将线路图、旧录音和逃生经历连在一起，认出了酒店阻止修灯的意图。');return {ok:true,text:m.result};}

export function ready(s,id){const m=MYSTERIES[id],ids=new Set((s.clues||[]).map(c=>c.id));return !!m&&m.groups.every(group=>group.some(key=>ids.has(key)));}
export function options(s,id){return ready(s,id)?MYSTERIES[id].options:[];}
export function question(s,id){if(ready(s,id))return MYSTERIES[id].prompt;const ids=new Set((s.clues||[]).map(c=>c.id));if(id==='case')return ids.has('tang1')?'记录的来历已经有了说法。其他人的陈述能与它相互印证吗？继续询问、核实资料，或保留尚未解释的疑点。':'先听来客的说法，再核对物品与预约。血迹和登记差异都不是定罪依据。';return '先了解电路和前任经历。你亲历危险后，还可以回现场检查留下的痕迹。调查没有完成，也可以修灯交班。';}
