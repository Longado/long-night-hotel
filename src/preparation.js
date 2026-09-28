// One spare cell can be prepared for a room or fitted to the manager's torch.
export function buyPreparation(s,kind){if(s.phase!=='settlement'||s.day!==1||s.preparation||s.extraLamp||s.batteryMax>180)return false;const cost=kind==='lamp'?30:kind==='torch'?40:Infinity;if(s.cash<cost)return false;s.cash-=cost;s.preparation=kind;if(kind==='lamp')s.extraLamp=1;else s.batteryMax=240;return true;}
export function repairSetup(s,assisted=false){if(assisted){if(s.batteryMax<240||s.battery<45)return null;return {seconds:4,batteryCost:45};}return {seconds:8,batteryCost:0};}
