function dateOnly(value) {
 if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
 return String(value).slice(0,10);
}
function todayManila(now = new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value; }
function nextDue(anchor, frequency, after) {
 if(!validDate(anchor)||!validDate(after)||!['daily','monthly'].includes(frequency)) throw new Error('Invalid lease billing schedule.');
 const a=new Date(anchor+'T00:00:00Z'),from=new Date(after+'T00:00:00Z');
 if(frequency==='daily') {const next=new Date(Math.max(a.getTime(),from.getTime()));next.setUTCDate(next.getUTCDate()+1);return next.toISOString().slice(0,10);}
 let offset=Math.max(1,(from.getUTCFullYear()-a.getUTCFullYear())*12+from.getUTCMonth()-a.getUTCMonth());
 for(;;offset++) {const first=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+offset,1));const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();first.setUTCDate(Math.min(a.getUTCDate(),last));const value=first.toISOString().slice(0,10);if(value>after)return value;}
}
function initialDue(anchor,frequency,today) {
 const yesterday=new Date(today+'T00:00:00Z');yesterday.setUTCDate(yesterday.getUTCDate()-1);
 return nextDue(anchor,frequency,anchor>=today?anchor:yesterday.toISOString().slice(0,10));
}
module.exports={dateOnly,todayManila,validDate,nextDue,initialDue};
